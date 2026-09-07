import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { buildAlerts, normalizeAlertSettings, reconcileAlertReads } from '../src/utils/alerts.js'

export function pushConfigured(env = process.env) {
  return Boolean((env.SUPABASE_URL || env.VITE_SUPABASE_URL) && env.SUPABASE_SERVICE_ROLE_KEY
    && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT && env.PUSH_CRON_SECRET)
}

export function getPushAdmin() {
  return createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) },
  })
}

export function validCronAuthorization(header, secret) {
  if (!secret || secret.length < 32 || typeof header !== 'string') return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(header)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function validPushEndpoint(endpoint) {
  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false
    // Impide utilizar el emisor para hacer peticiones a destinos arbitrarios.
    return url.hostname === 'fcm.googleapis.com'
      || url.hostname === 'updates.push.services.mozilla.com'
      || url.hostname.endsWith('.push.services.mozilla.com')
      || url.hostname.endsWith('.push.apple.com')
      || url.hostname.endsWith('.notify.windows.com')
  } catch { return false }
}

export function makePushPlan(data, subscription, now = Date.now()) {
  const alerts = buildAlerts(data, normalizeAlertSettings(subscription.settings), now)
  const previous = subscription.notified ?? {}
  const notified = reconcileAlertReads(previous, alerts)
  const fresh = alerts.filter((alert) => notified[alert.id] !== alert.revision)
  for (const alert of fresh) notified[alert.id] = alert.revision
  return {
    notified,
    payload: fresh.length ? {
      title: 'PacaControl',
      body: `${fresh.length} ${fresh.length === 1 ? 'alerta nueva necesita' : 'alertas nuevas necesitan'} tu atención. Abre la aplicación para revisar inventario, entregas o pacas.`,
      url: '/alertas',
      tag: 'pacacontrol-alertas',
    } : null,
  }
}

export async function sendPush(subscription, payload) {
  if (!validPushEndpoint(subscription.endpoint)) throw new Error('Unsupported push endpoint')
  return webpush.sendNotification({
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  }, JSON.stringify(payload), {
    vapidDetails: { subject: process.env.VAPID_SUBJECT, publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY },
    TTL: 300, timeout: 8000, urgency: 'normal',
  })
}

async function allRows(query, deadline) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    if (Date.now() > deadline) throw new Error('Dispatch time budget reached')
    const { data, error } = await query().range(offset, offset + 499)
    if (error) throw error
    rows.push(...data)
    if (data.length < 500) return rows
  }
}

export async function loadOwnerAlertsData(admin, ownerId, deadline) {
  const [categories, bales, sales] = await Promise.all([
    allRows(() => admin.from('inventory_summary').select('category_id,name,received_pieces,available_pieces').eq('owner_id', ownerId).order('category_id'), deadline),
    allRows(() => admin.from('bale_summary').select('id,code,received_pieces,sold_pieces,damaged_pieces,available_pieces').eq('owner_id', ownerId).order('id'), deadline),
    allRows(() => admin.from('sales').select('*,customer:customers(name)').eq('owner_id', ownerId).not('customer_id', 'is', null).order('id'), deadline),
  ])
  return {
    categories: categories.map((row) => ({ id: row.category_id, name: row.name, receivedPieces: row.received_pieces, availablePieces: row.available_pieces })),
    bales: bales.map((row) => ({ id: row.id, code: row.code, receivedPieces: row.received_pieces, soldPieces: row.sold_pieces, damagedPieces: row.damaged_pieces, availablePieces: row.available_pieces })),
    sales: sales.map((row) => ({ id: row.id, customerId: row.customer_id, customerName: row.customer?.name ?? 'Cliente', soldAt: row.sold_at,
      dateLabel: '', hasDeliveryStatus: ['paid', 'on_the_way', 'delivered'].includes(row.delivery_status), deliveryStatus: row.delivery_status })),
  }
}

export async function processPushSubscription(admin, subscription, data, send = sendPush) {
  const plan = makePushPlan(data, subscription)
  try {
    if (plan.payload) await send(subscription, plan.payload)
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410 || !validPushEndpoint(subscription.endpoint)) {
      const { error: deleteError } = await admin.from('push_subscriptions').delete().eq('id', subscription.id)
      if (deleteError) throw deleteError
      return 'expired'
    }
    throw error
  }
  // Solo confirmar el envío después de que el servicio push lo acepte.
  const { error } = await admin.from('push_subscriptions')
    .update({ notified: plan.notified, last_checked_at: new Date().toISOString() })
    .eq('id', subscription.id)
  if (error) throw error
  return plan.payload ? 'sent' : 'unchanged'
}

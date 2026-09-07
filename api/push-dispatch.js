import { randomUUID } from 'node:crypto'
import { getPushAdmin, loadOwnerAlertsData, processPushSubscription, pushConfigured, validCronAuthorization } from '../server/push.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' })
  if (!validCronAuthorization(req.headers.authorization, process.env.PUSH_CRON_SECRET)) return res.status(401).json({ error: 'No autorizado.' })
  if (!pushConfigured()) return res.status(503).json({ error: 'Falta configurar el servicio de avisos.' })
  const admin = getPushAdmin()
  const token = randomUUID()
  const deadline = Date.now() + 40000
  const counts = { sent: 0, unchanged: 0, expired: 0, failed: 0 }
  let acquired = false
  try {
    const lock = await admin.rpc('acquire_push_dispatch_lock', { p_token: token })
    if (lock.error) throw lock.error
    if (!lock.data) return res.status(200).json({ skipped: true })
    acquired = true
    const { data: subscriptions, error } = await admin.from('push_subscriptions').select('*')
      .order('last_checked_at', { nullsFirst: true }).order('id').limit(100)
    if (error) throw error
    const owners = new Map()
    for (const subscription of subscriptions) {
      if (Date.now() > deadline) break
      try {
        if (!owners.has(subscription.owner_id)) owners.set(subscription.owner_id, await loadOwnerAlertsData(admin, subscription.owner_id, deadline))
        const outcome = await processPushSubscription(admin, subscription, owners.get(subscription.owner_id))
        counts[outcome] += 1
      } catch {
        counts.failed += 1
        // Rotar también los fallidos para que no bloqueen a otros dispositivos.
        await admin.from('push_subscriptions').update({ last_checked_at: new Date().toISOString() }).eq('id', subscription.id)
      }
    }
    const heartbeat = await admin.from('push_dispatch_state').update({ last_run_at: new Date().toISOString() }).eq('id', true).eq('lock_token', token)
    if (heartbeat.error) throw heartbeat.error
    return res.status(200).json(counts)
  } catch {
    return res.status(503).json({ error: 'No fue posible revisar los avisos. Se reintentará en la siguiente ejecución.' })
  } finally {
    if (acquired) await admin.from('push_dispatch_state').update({ lock_token: null, locked_until: null }).eq('id', true).eq('lock_token', token)
  }
}

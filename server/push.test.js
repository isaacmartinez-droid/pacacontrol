import assert from 'node:assert/strict'
import test from 'node:test'
import { createECDH, randomBytes } from 'node:crypto'
import webpush from 'web-push'
import { makePushPlan, processPushSubscription, pushConfigured, validCronAuthorization, validPushEndpoint, validVapidKeyPair } from './push.js'
import dispatchHandler from '../api/push-dispatch.js'

const data = {
  categories: [{ id: 'cat', name: 'Camisas', receivedPieces: 100, availablePieces: 5 }],
  sales: [], bales: [],
}
const subscription = { id: 'sub', endpoint: 'https://fcm.googleapis.com/fcm/send/test', settings: {}, notified: {} }

test('el servicio necesita todas las variables de servidor', () => {
  assert.equal(pushConfigured({}), false)
  const vapid = webpush.generateVAPIDKeys()
  const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-key', VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'https://example.com', PUSH_CRON_SECRET: 'x'.repeat(64) }
  assert.equal(pushConfigured(env), true)
  for (const key of Object.keys(env)) assert.equal(pushConfigured({ ...env, [key]: '' }), false, key)
})

test('rechaza claves VAPID dañadas o que no pertenecen a la misma pareja', () => {
  const first = webpush.generateVAPIDKeys()
  const second = webpush.generateVAPIDKeys()
  assert.equal(validVapidKeyPair(first.publicKey, first.privateKey), true)
  assert.equal(validVapidKeyPair(first.publicKey, second.privateKey), false)
  assert.equal(validVapidKeyPair('public', 'private'), false)
})

test('el emisor exige el secreto completo y no acepta credenciales públicas', () => {
  const secret = 'x'.repeat(64)
  assert.equal(validCronAuthorization(`Bearer ${secret}`, secret), true)
  for (const header of [undefined, 'Bearer public-key', secret, `Bearer ${secret}extra`]) assert.equal(validCronAuthorization(header, secret), false)
  assert.equal(validCronAuthorization('Bearer undefined', undefined), false)
  assert.equal(validCronAuthorization('Bearer short', 'short'), false)
})

test('no hace peticiones a localhost, IPs ni hosts que imitan servicios push', () => {
  for (const endpoint of [
    'http://fcm.googleapis.com/send', 'https://127.0.0.1/send', 'https://169.254.169.254/',
    'https://fcm.googleapis.com.attacker.example/send', 'https://push.apple.com.attacker.example/',
    'https://user:pass@fcm.googleapis.com/send', 'https://fcm.googleapis.com:444/send', 'not-a-url',
  ]) assert.equal(validPushEndpoint(endpoint), false, endpoint)
  for (const endpoint of [subscription.endpoint, 'https://updates.push.services.mozilla.com/wpush/v2/key', 'https://web.push.apple.com/Qkey', 'https://wns.notify.windows.com/w/?token=key']) assert.equal(validPushEndpoint(endpoint), true, endpoint)
})

test('envía un resumen y no vuelve a avisar por un cambio menor de stock', () => {
  const first = makePushPlan(data, subscription)
  assert.equal(first.payloads.length, 1)
  assert.equal(first.payloads[0].url, '/inventario?categoria=cat')
  const nextData = { ...data, categories: [{ ...data.categories[0], availablePieces: 4 }] }
  assert.equal(makePushPlan(nextData, { ...subscription, notified: first.notified }).payloads.length, 0)
  const empty = makePushPlan({ ...data, categories: [{ ...data.categories[0], availablePieces: 0 }] }, { ...subscription, notified: first.notified })
  assert.equal(empty.payloads.length, 1)
})

test('resolver y volver a caer por debajo del límite crea un nuevo aviso', () => {
  const first = makePushPlan(data, subscription)
  const resolved = makePushPlan({ ...data, categories: [{ ...data.categories[0], availablePieces: 50 }] }, { ...subscription, notified: first.notified })
  assert.deepEqual(resolved.notified, {})
  assert.equal(resolved.payloads.length, 0)
  assert.equal(makePushPlan(data, { ...subscription, notified: resolved.notified }).payloads.length, 1)
})

test('cada dispositivo conserva sus propios límites y el mensaje no contiene datos del cliente', () => {
  assert.equal(makePushPlan(data, { ...subscription, settings: { stockEnabled: false } }).payloads.length, 0)
  const withCustomer = { ...data, sales: [{ id: 'sale', customerId: 'customer', customerName: 'Nombre privado', soldAt: '2026-09-01T00:00:00Z', dateLabel: '1 sept', hasDeliveryStatus: true, paymentStatus: 'paid', deliveryStatus: 'to_prepare' }] }
  const plan = makePushPlan(withCustomer, subscription, Date.parse('2026-09-07T00:00:00Z'))
  assert.equal(plan.payloads.length, 2)
  assert.doesNotMatch(JSON.stringify(plan.payloads), /Nombre privado|Camisas/)
})

function fakeAdmin() {
  const calls = []
  return {
    calls,
    from(table) {
      return {
        update(values) { calls.push({ method: 'update', table, values }); return { eq: async (column, id) => { calls.push({ column, id }); return { error: null } } } },
        delete() { calls.push({ method: 'delete', table }); return { eq: async (column, id) => { calls.push({ column, id }); return { error: null } } } },
      }
    },
  }
}

test('un envío fallido no se marca como enviado y se puede reintentar', async () => {
  const admin = fakeAdmin()
  await assert.rejects(processPushSubscription(admin, subscription, data, async () => { throw new Error('temporary') }))
  assert.deepEqual(admin.calls, [])
  const outcome = await processPushSubscription(admin, subscription, data, async () => ({}))
  assert.equal(outcome, 'sent')
  assert.equal(admin.calls[0].values.notified['stock:cat'], 'low')
})

test('las suscripciones vencidas se eliminan sin marcar un envío exitoso', async () => {
  const admin = fakeAdmin()
  assert.equal(await processPushSubscription(admin, subscription, data, async () => { throw { statusCode: 410 } }), 'expired')
  assert.equal(admin.calls[0].method, 'delete')
  assert.deepEqual(admin.calls[1], { column: 'id', id: 'sub' })
})

test('el endpoint de la tarea rechaza llamadas anónimas antes de tocar la base', async () => {
  const response = { code: null, setHeader() {}, status(code) { this.code = code; return this }, json(value) { this.body = value } }
  await dispatchHandler({ method: 'POST', headers: {} }, response)
  assert.equal(response.code, 401)
  await dispatchHandler({ method: 'GET', headers: {} }, response)
  assert.equal(response.code, 405)
})

test('la biblioteca genera una petición Web Push cifrada sin enviarla a la red', () => {
  const vapid = webpush.generateVAPIDKeys()
  const receiver = createECDH('prime256v1')
  receiver.generateKeys()
  const receiverSubscription = { endpoint: subscription.endpoint, keys: { p256dh: receiver.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } }
  const payload = JSON.stringify(makePushPlan(data, subscription).payloads[0])
  const request = webpush.generateRequestDetails(receiverSubscription, payload, {
    vapidDetails: { subject: 'https://example.com', publicKey: vapid.publicKey, privateKey: vapid.privateKey }, TTL: 300,
  })
  assert.equal(request.method, 'POST')
  assert.equal(request.headers['Content-Encoding'], 'aes128gcm')
  assert.equal(request.body.includes(Buffer.from('Tienda J&F')), false)
})

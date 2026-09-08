import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAlerts, defaultAlertSettings, normalizeAlertSettings, parseAlertPreferences, reconcileAlertReads } from './alerts.js'

const now = Date.parse('2026-09-07T18:00:00Z')
const store = (overrides = {}) => ({ categories: [], bales: [], sales: [], ...overrides })
const category = (overrides = {}) => ({ id: 'cat-1', name: 'Camisas', receivedPieces: 100, availablePieces: 10, ...overrides })
const sale = (overrides = {}) => ({ id: 'sale-1', customerId: 'customer-1', customerName: 'Cliente de prueba', hasDeliveryStatus: true, paymentStatus: 'paid', deliveryStatus: 'to_prepare', soldAt: '2026-09-06T18:00:00Z', dateLabel: '6 sept 2026', ...overrides })
const bale = (overrides = {}) => ({ id: 'bale-1', code: 'PAC-0001', receivedPieces: 100, soldPieces: 0, availablePieces: 90, damagedPieces: 10, ...overrides })

test('una tienda vacía y categorías nunca usadas no generan avisos ficticios', () => {
  assert.deepEqual(buildAlerts(store(), undefined, now), [])
  assert.deepEqual(buildAlerts(store({ categories: [category({ receivedPieces: 0, availablePieces: 0 })] })), [])
})

test('avisa exactamente en el límite de stock y se resuelve al reponer', () => {
  const [alert] = buildAlerts(store({ categories: [category()] }))
  assert.equal(alert.id, 'stock:cat-1')
  assert.equal(alert.to, '/inventario?categoria=cat-1')
  assert.equal(alert.revision, 'low')
  assert.deepEqual(buildAlerts(store({ categories: [category({ availablePieces: 11 })] })), [])
  assert.equal(buildAlerts(store({ categories: [category({ availablePieces: 0 })] }))[0].revision, 'empty')
})

test('stock desconocido no se interpreta como cero y el límite cero detecta solo agotados', () => {
  assert.deepEqual(buildAlerts(store({ categories: [category({ availablePieces: undefined })] })), [])
  assert.deepEqual(buildAlerts(store({ categories: [category({ availablePieces: 1 })] }), { stockLimit: 0 }), [])
  assert.equal(buildAlerts(store({ categories: [category({ availablePieces: 0 })] }), { stockLimit: 0 }).length, 1)
})

test('el recordatorio de entrega se activa al cumplir 24 horas, incluso sin nuevas ventas', () => {
  const data = store({ sales: [sale()] })
  assert.equal(buildAlerts(data, undefined, now - 1).length, 0)
  assert.equal(buildAlerts(data, undefined, now).length, 1)
  assert.equal(buildAlerts(data, undefined, now)[0].to, '/ventas?venta=sale-1')
})

test('la deuda avisa a las 24 horas y repite su revisión cada 5 horas', () => {
  const debtSale = sale({ paymentStatus: 'partial', deliveryStatus: 'to_prepare', balance: 150, lastPaymentAt: '2026-09-06T18:00:00Z' })
  assert.equal(buildAlerts(store({ sales: [debtSale] }), undefined, now - 1).length, 0)
  const first = buildAlerts(store({ sales: [debtSale] }), undefined, now)[0]
  assert.equal(first.id, 'debt:customer-1')
  assert.equal(first.revision, 'overdue-0')
  assert.equal(first.to, '/clientes/customer-1')
  const repeated = buildAlerts(store({ sales: [debtSale] }), undefined, now + 5 * 3600000)[0]
  assert.equal(repeated.revision, 'overdue-1')
  assert.equal(buildAlerts(store({ sales: [{ ...debtSale, balance: 0, paymentStatus: 'paid' }] }), undefined, now).some((alert) => alert.type === 'debt'), false)
})

test('agrupa en una alerta todas las deudas activas del mismo cliente', () => {
  const debts = [sale({ balance: 100, paymentStatus: 'partial', lastPaymentAt: '2026-09-06T18:00:00Z' }), sale({ id: 'sale-2', balance: 75, paymentStatus: 'pending', lastPaymentAt: '2026-09-07T17:00:00Z' })]
  const alerts = buildAlerts(store({ sales: debts }), undefined, now)
  assert.equal(alerts.length, 1)
  assert.match(alerts[0].description, /175/)
  assert.match(alerts[0].detail, /2 pedidos/)
})

test('despachar o entregar resuelve la alerta; mostrador, esquema antiguo y fechas inválidas no avisan', () => {
  for (const changes of [
    { deliveryStatus: 'ready' }, { deliveryStatus: 'on_the_way' }, { deliveryStatus: 'delivered' }, { paymentStatus: 'pending' },
    { customerId: null }, { hasDeliveryStatus: false }, { soldAt: null },
    { soldAt: 'inválida' }, { soldAt: '2026-09-08T18:00:00Z' },
  ]) {
    assert.deepEqual(buildAlerts(store({ sales: [sale(changes)] }), undefined, now), [], JSON.stringify(changes))
  }
})

test('los daños se calculan por paca y no se mezclan con otra compra', () => {
  const data = store({ bales: [bale(), bale({ id: 'bale-2', receivedPieces: 1000, damagedPieces: 9 })] })
  const alerts = buildAlerts(data)
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].to, '/pacas?paca=bale-1')
  assert.match(alerts[0].description, /10 de 100/)
  assert.deepEqual(buildAlerts(store({ bales: [bale({ receivedPieces: 0 })] })), [])
})

test('avisa cuando una paca vendible se agota y conserva el enlace a su detalle', () => {
  const alerts = buildAlerts(store({ bales: [bale({ soldPieces: 90, availablePieces: 0 })] }))
  const exhausted = alerts.find((alert) => alert.type === 'bale')
  assert.equal(exhausted.id, 'bale:bale-1')
  assert.equal(exhausted.to, '/pacas?paca=bale-1')
})

test('respeta límites propios y permite desactivar cada regla', () => {
  const data = store({ categories: [category()], sales: [sale()], bales: [bale()] })
  assert.equal(buildAlerts(data, undefined, now).length, 3)
  assert.deepEqual(buildAlerts(data, { stockLimit: 5, deliveryHours: 48, damagePercent: 20 }, now), [])
  assert.deepEqual(buildAlerts(data, { stockEnabled: false, deliveryEnabled: false, damageEnabled: false }, now), [])
})

test('ordena agotados antes que entregas pendientes y avisos de menor prioridad', () => {
  const alerts = buildAlerts(store({ categories: [category({ availablePieces: 0 })], sales: [sale()], bales: [bale()] }), undefined, now)
  assert.deepEqual(alerts.map((alert) => alert.type), ['stock', 'delivery', 'damage'])
})

test('leer no duplica avisos ni vuelve a avisar con cada cambio menor', () => {
  const data = store({ categories: [category()] })
  const reads = { 'stock:cat-1': 'low' }
  for (const pieces of [10, 9, 8]) {
    data.categories[0].availablePieces = pieces
    const alerts = buildAlerts(data)
    assert.equal(alerts.length, 1)
    assert.deepEqual(reconcileAlertReads(reads, alerts), reads)
  }
})

test('al agotarse, o resolverse y reaparecer, el problema vuelve a quedar sin leer', () => {
  const reads = { 'stock:cat-1': 'low' }
  assert.deepEqual(reconcileAlertReads(reads, buildAlerts(store({ categories: [category({ availablePieces: 0 })] }))), {})
  const resolvedReads = reconcileAlertReads(reads, [])
  assert.deepEqual(resolvedReads, {})
  assert.deepEqual(reconcileAlertReads(resolvedReads, buildAlerts(store({ categories: [category()] }))), {})
})

test('preferencias dañadas recuperan límites válidos; lecturas sobreviven a serialización', () => {
  for (const raw of [null, 'malformed', 'null', '{}']) {
    assert.deepEqual(parseAlertPreferences(raw), { settings: { ...defaultAlertSettings }, reads: {} })
  }
  const saved = { settings: { ...defaultAlertSettings, stockLimit: 5 }, reads: { 'stock:cat-1': 'low' } }
  assert.deepEqual(parseAlertPreferences(JSON.stringify(saved)), saved)
  assert.equal(normalizeAlertSettings({ damagePercent: 101, deliveryHours: -1, stockLimit: 1.2 }).stockLimit, 10)
  assert.equal(normalizeAlertSettings({ deliveryEnabled: false }).deliveryEnabled, false)
})

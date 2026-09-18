import test from 'node:test'
import assert from 'node:assert/strict'
import { recordedCategories, lastRecordedOperations } from './recordedPreferences.js'

test('muestra compras reales, categorías agregadas y reglas guardadas, no catálogo supuesto', () => {
  const data = {
    categories: [{ id: 'blouses', name: 'Blusas' }, { id: 'other', name: 'Otros' },
      { id: 'shoes', name: 'Zapatos' }, { id: 'pants', name: 'Pantalones' },
      { id: 'hats', name: 'Sombreros', isUserCreated: true }, { id: 'saved', name: 'Guardada', prices: { economic: 50 } }],
    bales: [{ id: 'old', createdAt: '2026-08-01' }, { id: 'new', createdAt: '2026-09-01', archivedAt: '2026-09-02' }],
    baleInventory: [{ baleId: 'old', categoryId: 'pants' }, { baleId: 'new', categoryId: 'shoes' }],
  }
  assert.deepEqual(recordedCategories(data).map((category) => category.id), ['shoes', 'pants', 'saved', 'hats'])
  // Otros solo desaparece si nunca se utilizó. No se pierde historia real.
  data.baleInventory.push({ baleId: 'old', categoryId: 'other' })
  assert.ok(recordedCategories(data).some((category) => category.id === 'other'))
})

test('últimos valores salen de operaciones guardadas sin inventar precios ni envío', () => {
  const data = { bales: [{ id: 'old', createdAt: '2026-08-01' }, { id: 'new', createdAt: '2026-09-01', targetProfitAmount: 1500 }],
    sales: [{ soldAt: '2026-08-01', fulfillmentMethod: 'delivery', deliveryCost: 80, deliveryCharge: 100, items: [{ categoryId: 'shoes', unitPrice: 200 }] },
      { soldAt: '2026-09-01', firstPaymentMethod: 'transfer', paymentStatus: 'partial', items: [{ categoryId: 'shoes', unitPrice: 250 }] }] }
  const result = lastRecordedOperations(data)
  assert.deepEqual(result.prices.get('shoes'), [250])
  assert.equal(result.prices.has('blouses'), false)
  assert.equal(result.purchase.targetProfitAmount, 1500)
  assert.deepEqual(result.sale, { method: 'transfer', status: 'partial' })
  assert.equal(result.delivery.deliveryCost, 80)
  assert.equal(lastRecordedOperations({ bales: [], sales: [] }).sale, undefined)
})

test('recuerda por fecha de registro y ofrece todos los precios, no supone el menor', () => {
  const result = lastRecordedOperations({ bales: [], sales: [
    { id: 'old', soldAt: '2026-09-17', createdAt: '2026-09-16', items: [{ categoryId: 'shoes', unitPrice: 500 }] },
    { id: 'new', soldAt: '2026-09-01', createdAt: '2026-09-17', items: [
      { categoryId: 'shoes', unitPrice: 100 }, { categoryId: 'shoes', unitPrice: 250 }, { categoryId: 'shoes', unitPrice: 100 },
    ] },
  ] })
  assert.deepEqual(result.prices.get('shoes'), [100, 250])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateBaseRecommendedPrice,
  calculatePriceMargin,
  calculateRecommendedPrice,
  summarizePriceLines,
} from './pricing.js'

test('distribuye la ganancia deseada entre las piezas y redondea hacia arriba', () => {
  assert.equal(calculateBaseRecommendedPrice(100, 3_000, 100), 130)
})

test('aplica niveles y respeta un precio personalizado', () => {
  assert.equal(calculateRecommendedPrice({ unitCost: 100, targetProfit: 3_000, sellablePieces: 100, priceLevel: 'standard' }), 160)
  assert.equal(calculateRecommendedPrice({ unitCost: 100, targetProfit: 3_000, sellablePieces: 100, priceLevel: 'premium' }), 195)
  assert.equal(calculateRecommendedPrice({ unitCost: 100, targetProfit: 3_000, sellablePieces: 100, priceLevel: 'custom', customPrice: 137 }), 137)
})

test('una regla fija de categoría tiene prioridad sobre el cálculo automático', () => {
  assert.equal(calculateRecommendedPrice({
    unitCost: 72.22,
    targetProfit: 3_000,
    sellablePieces: 100,
    priceLevel: 'economic',
    categoryPrices: { economic: 180 },
  }), 180)
})

test('calcula el margen real sobre el precio de venta', () => {
  assert.equal(calculatePriceMargin(120, 72), 40)
})

test('suma cantidades con precios distintos dentro de una venta', () => {
  assert.deepEqual(summarizePriceLines([
    { quantity: 1, unitPrice: 60 },
    { quantity: 2, unitPrice: 90 },
  ]), { quantity: 3, merchandiseTotal: 240 })
})

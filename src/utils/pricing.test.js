import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateBaseRecommendedPrice,
  calculatePriceMargin,
  calculateRecommendedPrice,
} from './pricing.js'

test('calcula el precio base usando margen real y redondea hacia arriba', () => {
  assert.equal(calculateBaseRecommendedPrice(72.22, 40), 125)
})

test('aplica niveles y respeta un precio personalizado', () => {
  assert.equal(calculateRecommendedPrice({ unitCost: 72.22, targetMargin: 40, priceLevel: 'standard' }), 150)
  assert.equal(calculateRecommendedPrice({ unitCost: 72.22, targetMargin: 40, priceLevel: 'premium' }), 190)
  assert.equal(calculateRecommendedPrice({ unitCost: 72.22, targetMargin: 40, priceLevel: 'custom', customPrice: 137 }), 137)
})

test('calcula el margen real sobre el precio de venta', () => {
  assert.equal(calculatePriceMargin(120, 72), 40)
})

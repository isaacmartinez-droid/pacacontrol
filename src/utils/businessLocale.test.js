import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCurrency } from './currency.js'
import { formatShortDate, formatBusinessDateTime, getBusinessHour } from './dates.js'
import { getBusinessDateKey, BUSINESS_TIME_ZONE } from './dashboardFinancials.js'
import { inventoryPricingLevels } from './pricing.js'

test('los importes no ocultan diferencias de centavos', () => {
  assert.equal(formatCurrency(0.4), 'C$0.4')
  assert.equal(formatCurrency(-0.49), 'C$-0.49')
  assert.equal(formatCurrency(1250.5), 'C$1,250.5')
})
test('Nicaragua conserva fecha comercial y no desplaza fechas sin hora', () => {
  assert.equal(BUSINESS_TIME_ZONE, 'America/Managua')
  assert.equal(getBusinessDateKey('2026-09-18T02:00:00Z'), '2026-09-17')
  assert.equal(getBusinessHour(new Date('2026-09-18T02:00:00Z')), 20)
  assert.equal(formatShortDate('2026-09-18T02:00:00Z'), formatShortDate('2026-09-17'))
  assert.match(formatBusinessDateTime('2026-09-18T02:00:00Z'), /17/)
})
test('los niveles de inventario coinciden con los admitidos por SQL', () => {
  assert.deepEqual(inventoryPricingLevels.map((level) => level.id), ['economic', 'standard', 'premium', 'custom'])
})

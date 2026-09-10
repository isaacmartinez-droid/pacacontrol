import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBusinessSettings } from './businessSettings.js'

test('limita, filtra y elimina KPI repetidos', () => {
  const settings = normalizeBusinessSettings({
    dashboardKpis: ['collected', 'collected', 'invalid', 'netResult', 'receivables', 'baleInvestment', 'damagedPieces'],
  })
  assert.deepEqual(settings.dashboardKpis, ['collected', 'netResult', 'receivables', 'baleInvestment'])
})

test('restaura valores seguros cuando una preferencia no es válida', () => {
  const settings = normalizeBusinessSettings({ dashboardKpis: [], dashboardPeriod: 'year', defaultTargetMargin: 100 })
  assert.deepEqual(settings.dashboardKpis, ['netResult', 'collected', 'baleInvestment', 'availablePieces'])
  assert.equal(settings.dashboardPeriod, 'month')
  assert.equal(settings.defaultTargetMargin, 40)
})

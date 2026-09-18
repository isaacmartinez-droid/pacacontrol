import test from 'node:test'
import assert from 'node:assert/strict'
import { allocateBaleCollections, calculateBaleFinancials, getActiveBale, getBaleSales } from './baleFinancials.js'
import { calculateDashboardFinancials } from './dashboardFinancials.js'
import { summarizeExpenses } from './expensePlanning.js'

test('inversion muestra solo la paca elegida, sin sumar anteriores ni archivadas', () => {
  const bales = [
    { id: 'old', purchaseDate: '2026-09-01', purchaseCost: 7000, availablePieces: 10 },
    { id: 'today', purchaseDate: '2026-09-15', purchaseCost: 8550, availablePieces: 20 },
    { id: 'archived', purchaseDate: '2026-09-16', purchaseCost: 4000, isArchived: true },
  ]
  const data = { bales, sales: [], expenses: [], baleInventory: [] }
  assert.equal(getActiveBale(bales).id, 'old')
  assert.equal(calculateDashboardFinancials(data).baleInvestment, 7000)
  assert.equal(calculateDashboardFinancials(data, 'month', new Date(), 'today').baleInvestment, 8550)
  assert.equal(calculateDashboardFinancials(data, 'month', new Date(), 'old').baleInvestment, 7000)
  assert.equal(calculateDashboardFinancials({ ...data, bales: bales.map((bale) => ({ ...bale, isArchived: true })) }).baleInvestment, 0)
})

test('automatica sigue la mas antigua con existencias y avanza al agotarse sin cambiar una seleccion manual', () => {
  const bales = [
    { id: 'new', purchaseDate: '2026-09-10', availablePieces: 20 },
    { id: 'archived', purchaseDate: '2026-07-01', availablePieces: 30, isArchived: true },
    { id: 'old', purchaseDate: '2026-08-01', availablePieces: 1 },
  ]
  assert.equal(getActiveBale(bales).id, 'old')
  bales[2].availablePieces = 0
  assert.equal(getActiveBale(bales).id, 'new')
  assert.equal(getActiveBale(bales, 'old').id, 'old')
  assert.equal(getActiveBale(bales, 'archived').id, 'new')
  bales[0].availablePieces = 0
  assert.equal(getActiveBale(bales).id, 'old')
  assert.equal(getActiveBale([]), undefined)
})

test('desempata pacas por fecha de creacion y luego codigo de forma estable', () => {
  const bales = [
    { id: 'b', code: 'PAC-0002', purchaseDate: '2026-09-01', createdAt: '2026-09-01T18:00:00Z', availablePieces: 5 },
    { id: 'a', code: 'PAC-0001', purchaseDate: '2026-09-01', createdAt: '2026-09-01T18:00:00Z', availablePieces: 5 },
    { id: 'c', code: 'PAC-0003', purchaseDate: '2026-09-01', createdAt: '2026-09-01T19:00:00Z', availablePieces: 5 },
  ]
  assert.equal(getActiveBale(bales).id, 'a')
})

test('pedidos de una paca incluyen su historial y pedidos mixtos una sola vez sin otros pedidos', () => {
  const sales = [
    { id: 'old', soldAt: '2026-08-01', items: [{ baleId: 'a' }] },
    { id: 'mixed', items: [{ baleId: 'a' }, { baleId: 'a' }, { baleId: 'b' }] },
    { id: 'other', items: [{ baleId: 'b' }] },
    { id: 'empty' },
  ]
  assert.deepEqual(getBaleSales(sales, 'a').map((sale) => sale.id), ['old', 'mixed'])
  assert.deepEqual(getBaleSales(sales, 'b').map((sale) => sale.id), ['mixed', 'other'])
  assert.deepEqual(getBaleSales(sales, 'missing'), [])
  assert.deepEqual(getBaleSales(sales), [])
})

test('al agotar una paca de 7000 con ventas de 11000, ganancia final es 4000', () => {
  const bale = { id: 'b', purchaseCost: 7000, currentRevenue: 11000, collectedAmount: 11000, availablePieces: 0, targetProfitAmount: 4000 }
  const result = calculateBaleFinancials(bale)
  assert.equal(result.result, 4000)
  assert.equal(result.cashResult, 4000)
  assert.equal(result.investmentRemaining, 0)
  assert.equal(result.targetRemaining, 0)
})

test('no confunde saldo del cliente con inversion recuperada ni carga gastos generales a una paca', () => {
  const bale = { id: 'b', purchaseCost: 7000, currentRevenue: 5000, collectedAmount: 3000, availablePieces: 50, targetProfitAmount: 4000 }
  const result = calculateBaleFinancials(bale, [{ baleId: 'b', availablePieces: 50, recommendedUnitPrice: 140 }], [{ baleId: 'b', amount: 200 }, { amount: 500 }])
  assert.equal(result.pending, 2000)
  assert.equal(result.investmentRemaining, 4000)
  assert.equal(result.operatingExpenses, 200)
  assert.equal(result.target, 11200)
  assert.equal(result.requiredAveragePrice, 124)
  assert.equal(result.projectedProfit, 4800)
})

test('distribuye cobro parcial entre dos pacas excluyendo delivery', () => {
  const result = allocateBaleCollections([{ total: 1100, paidAmount: 550, items: [{ baleId: 'a', quantity: 4, unitPrice: 100 }, { baleId: 'b', quantity: 3, unitPrice: 200 }] }])
  assert.equal(result.get('a'), 200)
  assert.equal(result.get('b'), 300)
})

test('la reserva mensual no se descuenta como gasto real y los meses no se mezclan', () => {
  const expenses = [{ expenseDate: '2026-09-15', amount: 200 }, { expenseDate: '2026-08-15', amount: 1000 }]
  const monthlyExpenses = [{ monthlyAmount: 500, isActive: true }, { monthlyAmount: 300, isActive: true }, { monthlyAmount: 1000, isActive: false }]
  const result = summarizeExpenses(expenses, monthlyExpenses, '2026-09')
  assert.equal(result.spent, 200)
  assert.equal(result.reserve, 800)
  assert.equal(result.reserveRemaining, 600)
  const dashboard = calculateDashboardFinancials({ sales: [], expenses, monthlyExpenses }, 'month', new Date('2026-09-15T18:00:00Z'))
  assert.equal(dashboard.netResult, -200)
  assert.equal(dashboard.monthlyExpenseReserve, 800)
})

test('incluye cobros adicionales del periodo sin volver a contar pagos anteriores', () => {
  const data = { expenses: [], sales: [{ soldAt: '2026-08-20', balance: 0, additionalPayments: [{ amount: 200, method: 'transfer', paidAt: '2026-09-15T18:00:00Z' }] }] }
  const result = calculateDashboardFinancials(data, 'month', new Date('2026-09-15T20:00:00Z'))
  assert.equal(result.collected, 200)
  assert.equal(result.transferCollected, 200)
})

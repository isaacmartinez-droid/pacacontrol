import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDashboardFinancials, getPeriodStartKey } from './dashboardFinancials.js'

test('la semana empieza el lunes en la fecha del negocio', () => {
  assert.equal(getPeriodStartKey('week', new Date('2026-09-10T18:00:00Z')), '2026-09-07')
})

test('todos los KPI de movimiento filtran hoy, semana y mes con límites de Nicaragua', () => {
  const dates = ['2026-08-31T23:59:59-06:00', '2026-09-01T00:00:00-06:00', '2026-09-13T23:59:59-06:00', '2026-09-14T00:00:00-06:00', '2026-09-16T23:59:59-06:00', '2026-09-17T00:00:00-06:00', '2026-09-18T00:00:00-06:00']
  const data = {
    sales: dates.map((at) => ({ soldAt: at, total: 100, estimatedProfit: 40, firstPaymentAmount: 20, firstPaymentMethod: 'cash', firstPaymentAt: at, secondPaymentAmount: 30, secondPaymentMethod: 'transfer', secondPaymentAt: at, additionalPayments: [{ amount: 5, method: 'cash', paidAt: at }, { amount: 10, method: 'transfer', paidAt: at }] })),
    expenses: dates.map((at) => ({ expenseDate: at.slice(0, 10), amount: 7 })),
  }
  for (const [period, count] of [['today', 1], ['week', 3], ['month', 5]]) {
    const result = calculateDashboardFinancials(data, period, new Date('2026-09-17T18:00:00Z'))
    assert.equal(result.ordersTotal, count * 100, period)
    assert.equal(result.operatingExpenses, count * 7, period)
    assert.equal(result.netResult, count * 33, period)
    assert.equal(result.collected, count * 65, period)
    assert.equal(result.cashCollected, count * 25, period)
    assert.equal(result.transferCollected, count * 40, period)
  }
})

test('KPI de estado conservan saldos, entregas e inventario anteriores; capital no es un movimiento del periodo', () => {
  const data = {
    sales: [{ soldAt: '2026-08-01', balance: 50, fulfillmentMethod: 'delivery', deliveryStatus: 'ready' }], expenses: [],
    bales: [{ id: 'old', purchaseDate: '2026-08-01', purchaseCost: 7000, availablePieces: 10 }],
    baleInventory: [{ availablePieces: 10, estimatedUnitCost: 20 }, { availablePieces: 50, estimatedUnitCost: 20, isActive: false }],
    monthlyExpenses: [{ monthlyAmount: 500, isActive: true }, { monthlyAmount: 300, isActive: false }],
  }
  for (const period of ['today', 'week', 'month']) {
    const result = calculateDashboardFinancials(data, period, new Date('2026-09-17T18:00:00Z'))
    assert.equal(result.receivables, 50)
    assert.equal(result.pendingDeliveries, 1)
    assert.equal(result.inventoryValue, 200)
    assert.equal(result.baleInvestment, 7000)
    assert.equal(result.monthlyExpenseReserve, 500)
    assert.equal(result.ordersTotal, 0)
  }
})

test('cuenta cobros del periodo aunque la venta original sea anterior', () => {
  const data = {
    sales: [
      {
        soldAt: '2026-08-28T15:00:00Z',
        estimatedProfit: 300,
        firstPaymentAmount: 100,
        firstPaymentAt: '2026-08-28T15:00:00Z',
        firstPaymentMethod: 'cash',
        secondPaymentAmount: 200,
        secondPaymentAt: '2026-09-10T15:00:00Z',
        secondPaymentMethod: 'transfer',
        total: 300,
        balance: 0,
      },
    ],
    expenses: [],
    bales: [],
    baleInventory: [],
  }

  const financials = calculateDashboardFinancials(data, 'month', new Date('2026-09-10T18:00:00Z'))

  assert.equal(financials.ordersTotal, 0)
  assert.equal(financials.netResult, 0)
  assert.equal(financials.collected, 200)
  assert.equal(financials.transferCollected, 200)
  assert.equal(financials.cashCollected, 0)
  assert.equal(financials.receivables, 0)
})

test('separa resultado del período, cobros reales y cuentas por cobrar', () => {
  const data = {
    sales: [
      {
        soldAt: '2026-09-07T15:00:00Z',
        estimatedProfit: 100,
        firstPaymentAmount: 50,
        firstPaymentAt: '2026-09-07T15:00:00Z',
        secondPaymentAmount: 50,
        secondPaymentAt: '2026-09-08T15:00:00Z',
        firstPaymentMethod: 'cash',
        secondPaymentMethod: 'transfer',
        total: 100,
        balance: 0,
        customerId: 'customer-1',
        fulfillmentMethod: 'delivery',
        deliveryStatus: 'to_prepare',
      },
      {
        soldAt: '2026-08-20T15:00:00Z',
        estimatedProfit: 500,
        firstPaymentAmount: 0,
        firstPaymentAt: null,
        secondPaymentAmount: 0,
        secondPaymentAt: null,
        total: 200,
        balance: 200,
      },
    ],
    expenses: [{ expenseDate: '2026-09-07', amount: 20 }],
    bales: [
      { purchaseCost: 10000, acquisitionTransport: 300, otherExpenses: 160 },
    ],
    baleInventory: [{ availablePieces: 10, estimatedUnitCost: 20 }],
  }

  assert.deepEqual(calculateDashboardFinancials(data, 'month', new Date('2026-09-10T18:00:00Z')), {
    netResult: 80,
    collected: 100,
    receivables: 200,
    operatingExpenses: 20,
    monthlyExpenseReserve: 0,
    baleInvestment: 10460,
    inventoryValue: 200,
    ordersTotal: 100,
    cashCollected: 50,
    transferCollected: 50,
    pendingDeliveries: 1,
  })
})

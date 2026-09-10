import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDashboardFinancials, getPeriodStartKey } from './dashboardFinancials.js'

test('la semana empieza el lunes en la fecha del negocio', () => {
  assert.equal(getPeriodStartKey('week', new Date('2026-09-10T18:00:00Z')), '2026-09-07')
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
    baleInvestment: 10460,
    inventoryValue: 200,
    ordersTotal: 100,
    cashCollected: 50,
    transferCollected: 50,
    pendingDeliveries: 1,
  })
})

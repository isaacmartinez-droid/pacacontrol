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
        balance: 0,
      },
      {
        soldAt: '2026-08-20T15:00:00Z',
        estimatedProfit: 500,
        firstPaymentAmount: 0,
        firstPaymentAt: null,
        secondPaymentAmount: 0,
        secondPaymentAt: null,
        balance: 200,
      },
    ],
    expenses: [{ expenseDate: '2026-09-07', amount: 20 }],
  }

  assert.deepEqual(calculateDashboardFinancials(data, 'month', new Date('2026-09-10T18:00:00Z')), {
    netResult: 80,
    collected: 100,
    receivables: 200,
    operatingExpenses: 20,
  })
})

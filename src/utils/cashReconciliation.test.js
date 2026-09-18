import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCashReconciliation } from './cashReconciliation.js'

test('arqueo cuenta pagos efectivos por fecha local, no pedidos ni transferencias', () => {
  const data = { sales: [{ total: 10000, paidAmount: 8000,
    firstPaymentAmount: 800, firstPaymentMethod: 'cash', firstPaymentAt: '2026-09-18T04:00:00Z',
    secondPaymentAmount: 500, secondPaymentMethod: 'transfer', secondPaymentAt: '2026-09-17T18:00:00Z',
    additionalPayments: [{ amount: 200, method: 'cash', paidAt: '2026-09-17T19:00:00Z' }, { amount: 100, method: 'cash', paidAt: '2026-09-18T06:00:00Z' }],
  }], expenses: [{ amount: 100, paymentMethod: 'cash', expenseDate: '2026-09-17' }, { amount: 500, paymentMethod: 'transfer', expenseDate: '2026-09-17' }] }
  const result = calculateCashReconciliation(data, { startDate: '2026-09-17', endDate: '2026-09-17', opening: 300, otherIncome: 50, otherOutflows: 200, counted: 1000 }, new Date('2026-09-19T00:00:00Z'))
  assert.deepEqual(result, { collected: 1000, cashExpenses: 100, expected: 1050, difference: -50, unknownExpenses: [] })
})

test('un pago con fecha futura no se cuenta antes de recibirlo', () => {
  const data = { sales: [{ firstPaymentAmount: 100, firstPaymentMethod: 'cash', firstPaymentAt: '2026-09-17T22:00:00Z' }], expenses: [] }
  const result = calculateCashReconciliation(data, { startDate: '2026-09-17', endDate: '2026-09-17' }, new Date('2026-09-17T21:00:00Z'))
  assert.equal(result.collected, 0)
})

test('gastos históricos desconocidos no se asumen en efectivo y se advierten', () => {
  const expenses = [{ amount: 50, expenseDate: '2026-09-17' }, { amount: 100, paymentMethod: 'unknown', expenseDate: '2026-09-17' }, { amount: 900, paymentMethod: 'unknown', expenseDate: '2026-08-17' }]
  const result = calculateCashReconciliation({ sales: [], expenses }, { startDate: '2026-09-17', endDate: '2026-09-17' })
  assert.equal(result.cashExpenses, 0)
  assert.equal(result.unknownExpenses.length, 2)
})

test('caja cuadrada y sobrantes conservan centavos sin ruido flotante', () => {
  const data = { sales: [], expenses: [] }
  const form = { startDate: '2026-09-01', endDate: '2026-09-30', opening: '0.10', otherIncome: '0.20', counted: '0.30' }
  assert.equal(calculateCashReconciliation(data, form).difference, 0)
  assert.equal(calculateCashReconciliation(data, { ...form, counted: 0.4 }).difference, 0.1)
})

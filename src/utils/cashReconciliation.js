import { getBusinessDateKey } from './dashboardFinancials.js'

const cents = (value) => Math.round((Number(value) || 0) * 100)

export function calculateCashReconciliation(data, { startDate, endDate, opening = 0, otherIncome = 0, otherOutflows = 0, counted = 0 }, now = new Date()) {
  const inRange = (at) => { const key = getBusinessDateKey(at); return key && key >= startDate && key <= endDate }
  const payments = data.sales.flatMap((sale) => [
    { amount: sale.firstPaymentAmount, method: sale.firstPaymentMethod, at: sale.firstPaymentAt },
    { amount: sale.secondPaymentAmount, method: sale.secondPaymentMethod, at: sale.secondPaymentAt },
    ...(sale.additionalPayments ?? []).map((payment) => ({ amount: payment.amount, method: payment.method, at: payment.paidAt })),
  ])
  const collected = payments.filter((payment) => payment.method === 'cash' && payment.at && new Date(payment.at) <= now && inRange(payment.at)).reduce((sum, payment) => sum + cents(payment.amount), 0)
  const expenses = data.expenses.filter((expense) => inRange(expense.expenseDate))
  const cashExpenses = expenses.filter((expense) => expense.paymentMethod === 'cash').reduce((sum, expense) => sum + cents(expense.amount), 0)
  const unknownExpenses = expenses.filter((expense) => !expense.paymentMethod || expense.paymentMethod === 'unknown')
  const expected = cents(opening) + collected + cents(otherIncome) - cashExpenses - cents(otherOutflows)
  return { collected: collected / 100, cashExpenses: cashExpenses / 100, expected: expected / 100, difference: (cents(counted) - expected) / 100, unknownExpenses }
}

const BUSINESS_TIME_ZONE = 'America/Guatemala'
const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const toNumber = (value) => Number(value) || 0

export function getBusinessDateKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = Object.fromEntries(dateKeyFormatter.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function getPeriodStartKey(period, now = new Date()) {
  const currentKey = getBusinessDateKey(now)
  if (period === 'today') return currentKey
  if (period === 'month') return `${currentKey.slice(0, 7)}-01`

  const currentDate = new Date(`${currentKey}T12:00:00Z`)
  const weekday = currentDate.getUTCDay() || 7
  currentDate.setUTCDate(currentDate.getUTCDate() - weekday + 1)
  return currentDate.toISOString().slice(0, 10)
}

export function calculateDashboardFinancials(data, period = 'month', now = new Date()) {
  const currentKey = getBusinessDateKey(now)
  const startKey = getPeriodStartKey(period, now)
  const isInPeriod = (value) => {
    const key = getBusinessDateKey(value)
    return key && key >= startKey && key <= currentKey
  }

  const periodSales = data.sales.filter((sale) => isInPeriod(sale.soldAt))
  const grossResult = periodSales.reduce((sum, sale) => sum + toNumber(sale.estimatedProfit), 0)
  const operatingExpenses = data.expenses
    .filter((expense) => isInPeriod(expense.expenseDate))
    .reduce((sum, expense) => sum + toNumber(expense.amount), 0)
  const collected = data.sales.reduce((sum, sale) => {
    const firstPayment = isInPeriod(sale.firstPaymentAt) ? toNumber(sale.firstPaymentAmount) : 0
    const secondPayment = isInPeriod(sale.secondPaymentAt) ? toNumber(sale.secondPaymentAmount) : 0
    return sum + firstPayment + secondPayment
  }, 0)
  const receivables = data.sales.reduce((sum, sale) => sum + Math.max(0, toNumber(sale.balance)), 0)

  return {
    netResult: grossResult - operatingExpenses,
    collected,
    receivables,
    operatingExpenses,
  }
}

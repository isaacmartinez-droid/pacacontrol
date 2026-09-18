import { getActiveBale } from './baleFinancials.js'

export const BUSINESS_TIME_ZONE = 'America/Managua'
const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const toNumber = (value) => Number(value) || 0

function getBaleInvestment(bale) {
  return (
    toNumber(bale.purchaseCost) +
    toNumber(bale.acquisitionTransport) +
    toNumber(bale.otherExpenses)
  )
}

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

export function calculateDashboardFinancials(data, period = 'month', now = new Date(), baleId = '') {
  const currentKey = getBusinessDateKey(now)
  const startKey = getPeriodStartKey(period, now)
  const isInPeriod = (value) => {
    const key = getBusinessDateKey(value)
    return key && key >= startKey && key <= currentKey
  }

  const periodSales = data.sales.filter((sale) => isInPeriod(sale.soldAt))
  const ordersTotal = periodSales.reduce((sum, sale) => sum + toNumber(sale.total), 0)
  const grossResult = periodSales.reduce((sum, sale) => sum + toNumber(sale.estimatedProfit), 0)
  const operatingExpenses = data.expenses
    .filter((expense) => isInPeriod(expense.expenseDate))
    .reduce((sum, expense) => sum + toNumber(expense.amount), 0)
  const payments = data.sales.flatMap((sale) => [
    { amount: toNumber(sale.firstPaymentAmount), method: sale.firstPaymentMethod, at: sale.firstPaymentAt },
    { amount: toNumber(sale.secondPaymentAmount), method: sale.secondPaymentMethod, at: sale.secondPaymentAt },
    ...(sale.additionalPayments ?? []).map((payment) => ({ amount: toNumber(payment.amount), method: payment.method, at: payment.paidAt })),
  ]).filter((payment) => payment.amount > 0 && isInPeriod(payment.at))
  const collected = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const cashCollected = payments.filter((payment) => payment.method === 'cash').reduce((sum, payment) => sum + payment.amount, 0)
  const transferCollected = payments.filter((payment) => payment.method === 'transfer').reduce((sum, payment) => sum + payment.amount, 0)
  const receivables = data.sales.reduce((sum, sale) => sum + Math.max(0, toNumber(sale.balance)), 0)
  const activeBale = getActiveBale(data.bales, baleId)
  const baleInvestment = activeBale ? getBaleInvestment(activeBale) : 0
  const monthlyExpenseReserve = (data.monthlyExpenses ?? []).filter((expense) => expense.isActive)
    .reduce((sum, expense) => sum + toNumber(expense.monthlyAmount), 0)
  const inventoryValue = (data.baleInventory ?? []).filter((inventory) => inventory.isActive !== false).reduce(
    (sum, inventory) => sum + toNumber(inventory.availablePieces) * toNumber(inventory.estimatedUnitCost),
    0,
  )
  const pendingDeliveries = data.sales.filter((sale) => !sale.isArchived && sale.fulfillmentMethod === 'delivery' && sale.deliveryStatus !== 'delivered').length

  return {
    netResult: grossResult - operatingExpenses,
    collected,
    receivables,
    operatingExpenses,
    monthlyExpenseReserve,
    baleInvestment,
    inventoryValue,
    ordersTotal,
    cashCollected,
    transferCollected,
    pendingDeliveries,
  }
}

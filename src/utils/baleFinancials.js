import { getTotalInvestment } from './calculations.js'

const number = (value) => Number(value) || 0

export function getActiveBale(bales = [], selectedId = '') {
  const active = bales.filter((bale) => !bale.isArchived)
  const selected = active.find((bale) => bale.id === selectedId)
  if (selected) return selected
  const oldestFirst = [...active].sort((a, b) => (
    String(a.purchaseDate ?? '').localeCompare(String(b.purchaseDate ?? ''))
    || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))
    || String(a.code ?? a.id).localeCompare(String(b.code ?? b.id))
  ))
  return oldestFirst.find((bale) => number(bale.availablePieces) > 0) ?? oldestFirst[0]
}

// Un pedido con varias pacas aparece una sola vez en cada paca relacionada.
export function getBaleSales(sales = [], baleId) {
  if (!baleId) return []
  return sales.filter((sale) => (sale.items ?? []).some((item) => item.baleId === baleId))
}

// Los cobros de un pedido de varias pacas se distribuyen proporcionalmente.
// El delivery no se considera recuperacion de la inversion de prendas.
export function allocateBaleCollections(sales = []) {
  const collected = new Map()
  for (const sale of sales) {
    const total = number(sale.total)
    const paidRatio = total > 0 ? Math.min(1, Math.max(0, number(sale.paidAmount) / total)) : 0
    for (const item of sale.items ?? []) {
      if (!item.baleId) continue
      const value = number(item.quantity) * number(item.unitPrice) * paidRatio
      collected.set(item.baleId, (collected.get(item.baleId) ?? 0) + value)
    }
  }
  return collected
}

export function calculateBaleFinancials(bale, inventory = [], expenses = []) {
  const investment = getTotalInvestment(bale)
  const operatingExpenses = expenses.filter((expense) => expense.baleId === bale.id)
    .reduce((sum, expense) => sum + number(expense.amount), 0)
  const revenue = number(bale.currentRevenue)
  const collected = number(bale.collectedAmount)
  const pending = Math.max(0, revenue - collected)
  const target = investment + operatingExpenses + number(bale.targetProfitAmount)
  const projectedRemaining = inventory.filter((item) => item.baleId === bale.id)
    .reduce((sum, item) => sum + number(item.availablePieces) * number(item.recommendedUnitPrice), 0)
  return {
    investment, operatingExpenses, revenue, collected, pending, target,
    investmentRemaining: Math.max(0, investment - collected),
    targetRemaining: Math.max(0, target - revenue),
    cashResult: collected - investment - operatingExpenses,
    result: revenue - investment - operatingExpenses,
    projectedProfit: revenue + projectedRemaining - investment - operatingExpenses,
    requiredAveragePrice: number(bale.availablePieces) > 0
      ? Math.max(0, target - revenue) / number(bale.availablePieces) : 0,
  }
}

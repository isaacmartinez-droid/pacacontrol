const toNumber = (value) => Number(value) || 0

export const DEFAULT_TARGET_PROFIT = 0
export const PRICE_ROUNDING_STEP = 5

export const pricingLevels = [
  { id: 'economic', label: 'Económica', multiplier: 1 },
  { id: 'standard', label: 'Normal', multiplier: 1.2 },
  { id: 'premium', label: 'Premium', multiplier: 1.5 },
  { id: 'custom', label: 'Precio personalizado', multiplier: null },
]

export function getPricingLevel(levelId) {
  return pricingLevels.find((level) => level.id === levelId) ?? pricingLevels[0]
}

export function roundRecommendedPrice(value, step = PRICE_ROUNDING_STEP) {
  const safeValue = Math.max(0, toNumber(value))
  const safeStep = Math.max(1, toNumber(step))
  return Math.ceil(safeValue / safeStep) * safeStep
}

export function calculateBaseRecommendedPrice(unitCost, targetProfit = DEFAULT_TARGET_PROFIT, sellablePieces = 1) {
  const safeCost = Math.max(0, toNumber(unitCost))
  const safeProfit = Math.max(0, toNumber(targetProfit))
  const safePieces = Math.max(0, toNumber(sellablePieces))
  if (safePieces === 0) return 0
  return roundRecommendedPrice(safeCost + safeProfit / safePieces)
}

export function calculateRecommendedPrice({
  unitCost,
  targetProfit = DEFAULT_TARGET_PROFIT,
  sellablePieces = 1,
  priceLevel = 'economic',
  customPrice = null,
  categoryPrices = null,
}) {
  if (priceLevel === 'custom') return Math.max(0, toNumber(customPrice))
  const categoryPrice = toNumber(categoryPrices?.[priceLevel])
  if (categoryPrice > 0) return categoryPrice
  const basePrice = calculateBaseRecommendedPrice(unitCost, targetProfit, sellablePieces)
  return roundRecommendedPrice(basePrice * getPricingLevel(priceLevel).multiplier)
}

export function calculatePriceMargin(price, unitCost) {
  const safePrice = toNumber(price)
  if (safePrice <= 0) return 0
  return ((safePrice - Math.max(0, toNumber(unitCost))) / safePrice) * 100
}

export function summarizePriceLines(lines = []) {
  return lines.reduce((summary, line) => {
    const quantity = Math.max(0, toNumber(line.quantity))
    const unitPrice = Math.max(0, toNumber(line.unitPrice))
    return {
      quantity: summary.quantity + quantity,
      merchandiseTotal: summary.merchandiseTotal + quantity * unitPrice,
    }
  }, { quantity: 0, merchandiseTotal: 0 })
}

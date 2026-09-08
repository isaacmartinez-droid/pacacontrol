const toNumber = (value) => Number(value) || 0

export const DEFAULT_TARGET_MARGIN = 40
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

export function calculateBaseRecommendedPrice(unitCost, targetMargin = DEFAULT_TARGET_MARGIN) {
  const safeCost = Math.max(0, toNumber(unitCost))
  const safeMargin = Math.min(90, Math.max(0, toNumber(targetMargin)))
  if (safeCost === 0) return 0
  return roundRecommendedPrice(safeCost / (1 - safeMargin / 100))
}

export function calculateRecommendedPrice({
  unitCost,
  targetMargin = DEFAULT_TARGET_MARGIN,
  priceLevel = 'economic',
  customPrice = null,
}) {
  if (priceLevel === 'custom') return Math.max(0, toNumber(customPrice))
  const basePrice = calculateBaseRecommendedPrice(unitCost, targetMargin)
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

const toNumber = (value) => Number(value) || 0

export const DEFAULT_TARGET_PROFIT = 0
export const PRICE_ROUNDING_STEP = 5

export const defaultPricingRules = Object.freeze({
  economicFactor: 1,
  standardFactor: 1.2,
  premiumFactor: 1.5,
  specialFactor: 2,
  roundingStep: PRICE_ROUNDING_STEP,
  minimumPrice: 0,
  maximumPrice: 0,
  estimatedDamagePercent: 0,
  liquidationDiscountPercent: 20,
  wholesaleDiscountPercent: 15,
  wholesaleMinQuantity: 6,
})

export const pricingLevels = [
  { id: 'economic', label: 'Económica', multiplier: defaultPricingRules.economicFactor },
  { id: 'standard', label: 'Normal', multiplier: defaultPricingRules.standardFactor },
  { id: 'premium', label: 'Premium', multiplier: defaultPricingRules.premiumFactor },
  { id: 'special', label: 'Especial', multiplier: defaultPricingRules.specialFactor },
  { id: 'liquidation', label: 'Liquidación', multiplier: defaultPricingRules.economicFactor * (1 - defaultPricingRules.liquidationDiscountPercent / 100) },
  { id: 'wholesale', label: 'Mayoreo', multiplier: defaultPricingRules.economicFactor * (1 - defaultPricingRules.wholesaleDiscountPercent / 100) },
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

const inRange = (value, fallback, min, max) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback
}

export function normalizePricingRules(value = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const economicFactor = inRange(source.economicFactor, defaultPricingRules.economicFactor, 0.1, 10)
  const standardFactor = inRange(source.standardFactor, defaultPricingRules.standardFactor, economicFactor, 10)
  const premiumFactor = inRange(source.premiumFactor, defaultPricingRules.premiumFactor, standardFactor, 10)
  const specialFactor = inRange(source.specialFactor, defaultPricingRules.specialFactor, premiumFactor, 10)
  const minimumPrice = inRange(source.minimumPrice, defaultPricingRules.minimumPrice, 0, 10000000)
  let maximumPrice = inRange(source.maximumPrice, defaultPricingRules.maximumPrice, 0, 10000000)
  if (maximumPrice > 0 && maximumPrice < minimumPrice) maximumPrice = 0
  const requestedRounding = Number(source.roundingStep)

  return {
    economicFactor,
    standardFactor,
    premiumFactor,
    specialFactor,
    roundingStep: [1, 5, 10, 20].includes(requestedRounding) ? requestedRounding : defaultPricingRules.roundingStep,
    minimumPrice,
    maximumPrice,
    estimatedDamagePercent: inRange(source.estimatedDamagePercent, defaultPricingRules.estimatedDamagePercent, 0, 90),
    liquidationDiscountPercent: inRange(source.liquidationDiscountPercent, defaultPricingRules.liquidationDiscountPercent, 0, 90),
    wholesaleDiscountPercent: inRange(source.wholesaleDiscountPercent, defaultPricingRules.wholesaleDiscountPercent, 0, 90),
    wholesaleMinQuantity: Math.round(inRange(source.wholesaleMinQuantity, defaultPricingRules.wholesaleMinQuantity, 2, 1000)),
  }
}

export function validatePricingRules(value) {
  const factors = [value?.economicFactor, value?.standardFactor, value?.premiumFactor, value?.specialFactor].map(Number)
  if (factors.some((number) => !Number.isFinite(number) || number < 0.1 || number > 10)) return 'Todos los factores deben estar entre 0.10 y 10.'
  if (factors[1] < factors[0] || factors[2] < factors[1] || factors[3] < factors[2]) return 'Los factores deben aumentar en orden: económico, normal, premium y especial.'
  if (Number(value?.maximumPrice) > 0 && Number(value.maximumPrice) < Number(value.minimumPrice || 0)) return 'El precio máximo no puede ser menor que el precio mínimo.'
  return ''
}

export function getPricingFactor(levelId, value = defaultPricingRules) {
  const rules = normalizePricingRules(value)
  if (levelId === 'standard') return rules.standardFactor
  if (levelId === 'premium') return rules.premiumFactor
  if (levelId === 'special' || levelId === 'custom') return rules.specialFactor
  if (levelId === 'liquidation') return rules.economicFactor * (1 - rules.liquidationDiscountPercent / 100)
  if (levelId === 'wholesale') return rules.economicFactor * (1 - rules.wholesaleDiscountPercent / 100)
  return rules.economicFactor
}

export function applyPricingLimits(value, pricingRules = defaultPricingRules) {
  const rules = normalizePricingRules(pricingRules)
  let price = roundRecommendedPrice(value, rules.roundingStep)
  price = Math.max(price, rules.minimumPrice)
  if (rules.maximumPrice > 0) price = Math.min(price, rules.maximumPrice)
  return price
}

export function plannedSellableQuantity(entry, pricingRules = defaultPricingRules) {
  const rules = normalizePricingRules(pricingRules)
  const received = Math.max(0, toNumber(entry.quantity ?? entry.receivedPieces))
  const damaged = Math.max(0, toNumber(entry.damagedPieces))
  const sold = Math.max(0, toNumber(entry.soldPieces))
  const forecastDamage = Math.ceil(received * rules.estimatedDamagePercent / 100)
  return Math.max(sold, received - Math.max(damaged, forecastDamage), 0)
}

export function calculatePricingPlan({ investment, targetProfit = 0, entries = [], pricingRules = defaultPricingRules }) {
  const rules = normalizePricingRules(pricingRules)
  const targetRevenue = Math.max(0, toNumber(investment)) + Math.max(0, toNumber(targetProfit))
  const weightedPieces = entries.reduce((total, entry) => (
    total + plannedSellableQuantity(entry, rules) * getPricingFactor(entry.priceLevel, rules)
  ), 0)
  const rawBasePrice = weightedPieces > 0 ? targetRevenue / weightedPieces : 0
  return {
    rules,
    targetRevenue,
    weightedPieces,
    rawBasePrice,
    baseRecommendedPrice: applyPricingLimits(rawBasePrice * rules.economicFactor, rules),
  }
}

export function calculateBaseRecommendedPrice(unitCost, targetProfit = DEFAULT_TARGET_PROFIT, sellablePieces = 1, roundingStep = PRICE_ROUNDING_STEP) {
  const safeCost = Math.max(0, toNumber(unitCost))
  const safeProfit = Math.max(0, toNumber(targetProfit))
  const safePieces = Math.max(0, toNumber(sellablePieces))
  if (safePieces === 0) return 0
  return roundRecommendedPrice(safeCost + safeProfit / safePieces, roundingStep)
}

export function calculateRecommendedPrice({
  unitCost,
  targetProfit = DEFAULT_TARGET_PROFIT,
  sellablePieces = 1,
  priceLevel = 'economic',
  customPrice = null,
  categoryPrices = null,
  pricingRules = defaultPricingRules,
  basePrice = null,
}) {
  if (priceLevel === 'custom') return Math.max(0, toNumber(customPrice))
  const categoryPrice = toNumber(categoryPrices?.[priceLevel])
  if (categoryPrice > 0) return categoryPrice
  const rules = normalizePricingRules(pricingRules)
  const hasBasePrice = basePrice !== null && basePrice !== undefined && basePrice !== ''
  const calculatedBase = hasBasePrice && Number.isFinite(Number(basePrice))
    ? Math.max(0, Number(basePrice))
    : calculateBaseRecommendedPrice(unitCost, targetProfit, sellablePieces, rules.roundingStep)
  return applyPricingLimits(calculatedBase * getPricingFactor(priceLevel, rules), rules)
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

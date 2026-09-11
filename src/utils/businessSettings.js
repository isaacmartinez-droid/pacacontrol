import { defaultPricingRules, normalizePricingRules } from './pricing.js'

export const dashboardKpiOptions = [
  { id: 'netResult', label: 'Ganancia o pérdida neta' },
  { id: 'collected', label: 'Dinero cobrado' },
  { id: 'receivables', label: 'Dinero por cobrar' },
  { id: 'baleInvestment', label: 'Inversión total en pacas' },
  { id: 'inventoryValue', label: 'Valor del inventario disponible' },
  { id: 'operatingExpenses', label: 'Gastos del negocio' },
  { id: 'ordersTotal', label: 'Ventas registradas' },
  { id: 'cashCollected', label: 'Cobros en efectivo' },
  { id: 'transferCollected', label: 'Cobros por transferencia' },
  { id: 'pendingDeliveries', label: 'Entregas pendientes' },
  { id: 'availablePieces', label: 'Piezas disponibles' },
  { id: 'damagedPieces', label: 'Piezas dañadas' },
]

const validKpiIds = new Set(dashboardKpiOptions.map((option) => option.id))
const validPeriods = new Set(['today', 'week', 'month'])
const validPaymentMethods = new Set(['cash', 'transfer', 'card', 'other'])
const validPaymentStatuses = new Set(['pending', 'partial', 'paid'])

export const defaultBusinessSettings = Object.freeze({
  dashboardKpis: ['netResult', 'collected', 'baleInvestment', 'availablePieces'],
  dashboardPeriod: 'month',
  defaultPaymentMethod: 'cash',
  defaultPaymentStatus: 'paid',
  defaultTargetProfitAmount: 0,
  defaultDeliveryCost: 0,
  defaultDeliveryCharge: 0,
  warnBelowRecommended: true,
  defaultPricingRules,
  pricingRuleTemplates: [],
})

const numberInRange = (value, fallback, min, max) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback
}

export function normalizeBusinessSettings(settings = {}) {
  const requestedKpis = Array.isArray(settings.dashboardKpis) ? settings.dashboardKpis : defaultBusinessSettings.dashboardKpis
  const dashboardKpis = [...new Set(requestedKpis)].filter((id) => validKpiIds.has(id)).slice(0, 4)

  const pricingRuleTemplates = Array.isArray(settings.pricingRuleTemplates)
    ? settings.pricingRuleTemplates.slice(0, 20).map((template, index) => ({
      id: typeof template?.id === 'string' && template.id ? template.id : `rule-${index + 1}`,
      name: typeof template?.name === 'string' && template.name.trim() ? template.name.trim().slice(0, 60) : `Regla ${index + 1}`,
      rules: normalizePricingRules(template?.rules),
    })).filter((template, index, templates) => templates.findIndex((item) => item.id === template.id) === index)
    : []

  return {
    dashboardKpis: dashboardKpis.length ? dashboardKpis : [...defaultBusinessSettings.dashboardKpis],
    dashboardPeriod: validPeriods.has(settings.dashboardPeriod) ? settings.dashboardPeriod : defaultBusinessSettings.dashboardPeriod,
    defaultPaymentMethod: validPaymentMethods.has(settings.defaultPaymentMethod) ? settings.defaultPaymentMethod : defaultBusinessSettings.defaultPaymentMethod,
    defaultPaymentStatus: validPaymentStatuses.has(settings.defaultPaymentStatus) ? settings.defaultPaymentStatus : defaultBusinessSettings.defaultPaymentStatus,
    defaultTargetProfitAmount: numberInRange(settings.defaultTargetProfitAmount, defaultBusinessSettings.defaultTargetProfitAmount, 0, Number.MAX_SAFE_INTEGER),
    defaultDeliveryCost: numberInRange(settings.defaultDeliveryCost, defaultBusinessSettings.defaultDeliveryCost, 0, Number.MAX_SAFE_INTEGER),
    defaultDeliveryCharge: numberInRange(settings.defaultDeliveryCharge, defaultBusinessSettings.defaultDeliveryCharge, 0, Number.MAX_SAFE_INTEGER),
    warnBelowRecommended: settings.warnBelowRecommended !== false,
    defaultPricingRules: normalizePricingRules(settings.defaultPricingRules),
    pricingRuleTemplates,
  }
}

export function mapBusinessSettings(row) {
  if (!row) return normalizeBusinessSettings()
  return normalizeBusinessSettings({
    dashboardKpis: row.dashboard_kpis,
    dashboardPeriod: row.dashboard_period,
    defaultPaymentMethod: row.default_payment_method,
    defaultPaymentStatus: row.default_payment_status,
    defaultTargetProfitAmount: row.default_target_profit_amount,
    defaultDeliveryCost: row.default_delivery_cost,
    defaultDeliveryCharge: row.default_delivery_charge,
    warnBelowRecommended: row.warn_below_recommended,
    defaultPricingRules: row.default_pricing_rules,
    pricingRuleTemplates: row.pricing_rule_templates,
  })
}

export function businessSettingsToRow(settings) {
  const normalized = normalizeBusinessSettings(settings)
  return {
    dashboard_kpis: normalized.dashboardKpis,
    dashboard_period: normalized.dashboardPeriod,
    default_payment_method: normalized.defaultPaymentMethod,
    default_payment_status: normalized.defaultPaymentStatus,
    default_target_profit_amount: normalized.defaultTargetProfitAmount,
    default_delivery_cost: normalized.defaultDeliveryCost,
    default_delivery_charge: normalized.defaultDeliveryCharge,
    warn_below_recommended: normalized.warnBelowRecommended,
    default_pricing_rules: normalized.defaultPricingRules,
    pricing_rule_templates: normalized.pricingRuleTemplates,
  }
}

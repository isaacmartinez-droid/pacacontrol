export const defaultBusinessVocabulary = Object.freeze({
  purchaseSingular: 'Compra',
  purchasePlural: 'Compras',
  inventoryUnitSingular: 'Producto',
  inventoryUnitPlural: 'Productos',
})

const vocabularyKeys = Object.keys(defaultBusinessVocabulary)

export function normalizeBusinessVocabulary(value = {}) {
  return Object.fromEntries(vocabularyKeys.map((key) => {
    const candidate = typeof value?.[key] === 'string' ? value[key].trim().slice(0, 40) : ''
    return [key, candidate || defaultBusinessVocabulary[key]]
  }))
}

export function mapBusinessProfile(row) {
  if (!row) return null
  return {
    ownerId: row.owner_id,
    businessName: row.business_name ?? '',
    activityDescription: row.activity_description ?? '',
    templateKey: row.template_key ?? '',
    templateVersion: row.template_version ?? null,
    inventoryMode: row.inventory_mode ?? '',
    tracksVariants: row.tracks_variants === true,
    salesMode: row.sales_mode ?? '',
    fulfillmentMethods: Array.isArray(row.fulfillment_methods) ? [...row.fulfillment_methods] : ['pickup'],
    vocabulary: normalizeBusinessVocabulary(row.vocabulary),
    onboardingStatus: row.onboarding_status ?? 'pending',
    onboardingStep: Number(row.onboarding_step) || 0,
    onboardingDraft: row.onboarding_draft && typeof row.onboarding_draft === 'object' ? row.onboarding_draft : {},
    completedAt: row.completed_at ?? null,
  }
}

export function mapBusinessTemplate(row) {
  return {
    key: row.template_key,
    version: row.version,
    name: row.name,
    description: row.description,
    suggestedCategories: Array.isArray(row.config?.suggested_categories) ? row.config.suggested_categories : [],
    vocabulary: normalizeBusinessVocabulary(row.config?.vocabulary),
  }
}

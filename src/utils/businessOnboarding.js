const inventoryModes = new Set(['units', 'batches', 'both'])
const salesModes = new Set(['immediate', 'credit', 'both'])
const fulfillmentOptions = new Set(['pickup', 'delivery'])

export const BUSINESS_ONBOARDING_LAST_STEP = 6

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : ''
}

export function normalizeOnboardingCategories(values) {
  const seen = new Set()
  return (Array.isArray(values) ? values : []).flatMap((value) => {
    const name = cleanText(value, 80)
    const key = name.toLocaleLowerCase('es')
    if (!name || seen.has(key) || seen.size >= 30) return []
    seen.add(key)
    return [name]
  })
}

export function createBusinessOnboardingDraft(profile = null) {
  const saved = profile?.onboardingDraft && typeof profile.onboardingDraft === 'object'
    ? profile.onboardingDraft
    : {}
  const fulfillmentMethods = [...new Set(
    (Array.isArray(saved.fulfillmentMethods) ? saved.fulfillmentMethods : ['pickup'])
      .filter((value) => fulfillmentOptions.has(value)),
  )]

  return {
    businessName: typeof saved.businessName === 'string' ? saved.businessName : (profile?.businessName ?? ''),
    activityDescription: typeof saved.activityDescription === 'string' ? saved.activityDescription : '',
    templateKey: typeof saved.templateKey === 'string' ? saved.templateKey : '',
    inventoryMode: inventoryModes.has(saved.inventoryMode) ? saved.inventoryMode : '',
    tracksVariants: saved.tracksVariants === true,
    salesMode: salesModes.has(saved.salesMode) ? saved.salesMode : '',
    fulfillmentMethods: fulfillmentMethods.length ? fulfillmentMethods : ['pickup'],
    categories: normalizeOnboardingCategories(saved.categories),
  }
}

export function selectBusinessTemplate(draft, template, previousTemplate = null) {
  const currentCategories = normalizeOnboardingCategories(draft.categories)
  const previousSuggestions = normalizeOnboardingCategories(previousTemplate?.suggestedCategories)
  const categoriesStillMatchPrevious = currentCategories.length === previousSuggestions.length
    && currentCategories.every((value, index) => value === previousSuggestions[index])
  const shouldReplaceCategories = currentCategories.length === 0 || categoriesStillMatchPrevious

  return {
    ...draft,
    templateKey: template.key,
    categories: shouldReplaceCategories
      ? normalizeOnboardingCategories(template.suggestedCategories)
      : currentCategories,
  }
}

export function validateBusinessOnboardingStep(step, draft, availableTemplateKeys = []) {
  const businessName = cleanText(draft.businessName, 121)
  const activityDescription = typeof draft.activityDescription === 'string' ? draft.activityDescription.trim() : ''
  const categories = normalizeOnboardingCategories(draft.categories)

  if ((step === 0 || step === BUSINESS_ONBOARDING_LAST_STEP) && (!businessName || businessName.length > 120)) {
    return 'Escribe un nombre de negocio de hasta 120 caracteres.'
  }
  if ((step === 0 || step === BUSINESS_ONBOARDING_LAST_STEP) && activityDescription.length > 500) {
    return 'La descripción puede tener hasta 500 caracteres.'
  }
  if ((step === 1 || step === BUSINESS_ONBOARDING_LAST_STEP) && !availableTemplateKeys.includes(draft.templateKey)) {
    return 'Selecciona el tipo de negocio que más se parece al tuyo.'
  }
  if ((step === 2 || step === BUSINESS_ONBOARDING_LAST_STEP) && !inventoryModes.has(draft.inventoryMode)) {
    return 'Selecciona cómo controlas tus compras e inventario.'
  }
  if ((step === 3 || step === BUSINESS_ONBOARDING_LAST_STEP) && !salesModes.has(draft.salesMode)) {
    return 'Selecciona cómo recibes los pagos de tus ventas.'
  }
  if ((step === 4 || step === BUSINESS_ONBOARDING_LAST_STEP)
    && (!Array.isArray(draft.fulfillmentMethods) || draft.fulfillmentMethods.length < 1
      || draft.fulfillmentMethods.length > 2 || draft.fulfillmentMethods.some((value) => !fulfillmentOptions.has(value)))) {
    return 'Selecciona al menos una forma de entregar los pedidos.'
  }
  if ((step === 5 || step === BUSINESS_ONBOARDING_LAST_STEP) && categories.length < 1) {
    return 'Confirma al menos una categoría real de tu negocio.'
  }
  if ((step === 5 || step === BUSINESS_ONBOARDING_LAST_STEP)
    && (categories.length > 30 || (draft.categories ?? []).some((value) => !cleanText(value, 81) || cleanText(value, 81).length > 80))) {
    return 'Revisa las categorías: admite entre 1 y 30 nombres de hasta 80 caracteres.'
  }
  return ''
}

export function onboardingDraftForStorage(draft) {
  return {
    businessName: typeof draft.businessName === 'string' ? draft.businessName.slice(0, 120) : '',
    activityDescription: typeof draft.activityDescription === 'string' ? draft.activityDescription.slice(0, 500) : '',
    templateKey: draft.templateKey ?? '',
    inventoryMode: draft.inventoryMode ?? '',
    tracksVariants: draft.tracksVariants === true,
    salesMode: draft.salesMode ?? '',
    fulfillmentMethods: [...new Set((draft.fulfillmentMethods ?? []).filter((value) => fulfillmentOptions.has(value)))],
    categories: normalizeOnboardingCategories(draft.categories),
  }
}

export function businessOnboardingSubmission(draft) {
  const stored = onboardingDraftForStorage(draft)
  return {
    businessName: cleanText(stored.businessName, 120),
    activityDescription: stored.activityDescription.trim(),
    templateKey: stored.templateKey,
    inventoryMode: stored.inventoryMode,
    tracksVariants: stored.tracksVariants,
    salesMode: stored.salesMode,
    fulfillmentMethods: stored.fulfillmentMethods,
    categories: stored.categories,
  }
}

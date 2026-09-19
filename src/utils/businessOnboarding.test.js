import assert from 'node:assert/strict'
import test from 'node:test'
import {
  businessOnboardingSubmission,
  createBusinessOnboardingDraft,
  normalizeOnboardingCategories,
  selectBusinessTemplate,
  validateBusinessOnboardingStep,
} from './businessOnboarding.js'

test('recupera un borrador sin aceptar opciones desconocidas ni categorías repetidas', () => {
  const draft = createBusinessOnboardingDraft({
    businessName: 'Nombre anterior',
    onboardingDraft: {
      businessName: 'Mi negocio', inventoryMode: 'invalid', salesMode: 'credit',
      fulfillmentMethods: ['delivery', 'delivery', 'otro'], categories: [' Zapatos ', 'zapatos', 'Ropa'],
    },
  })
  assert.equal(draft.businessName, 'Mi negocio')
  assert.equal(draft.inventoryMode, '')
  assert.equal(draft.salesMode, 'credit')
  assert.deepEqual(draft.fulfillmentMethods, ['delivery'])
  assert.deepEqual(draft.categories, ['Zapatos', 'Ropa'])
})

test('una plantilla sugiere categorías pero no reemplaza nombres ya personalizados', () => {
  const general = { key: 'general', suggestedCategories: ['Hogar', 'Abarrotes'] }
  const clothes = { key: 'clothes', suggestedCategories: ['Ropa', 'Calzado'] }
  assert.deepEqual(selectBusinessTemplate({ categories: [], templateKey: '' }, general).categories, ['Hogar', 'Abarrotes'])
  assert.deepEqual(selectBusinessTemplate({ categories: ['Hogar', 'Abarrotes'], templateKey: 'general' }, clothes, general).categories, ['Ropa', 'Calzado'])
  assert.deepEqual(selectBusinessTemplate({ categories: ['Ferretería'], templateKey: 'general' }, clothes, general).categories, ['Ferretería'])
})

test('valida todos los pasos y genera una confirmación limpia', () => {
  const draft = {
    businessName: '  Mi tienda  ', activityDescription: ' Venta local ', templateKey: 'manual',
    inventoryMode: 'both', tracksVariants: true, salesMode: 'both',
    fulfillmentMethods: ['pickup', 'delivery'], categories: [' Zapatos ', 'Ropa', 'zapatos'],
  }
  assert.equal(validateBusinessOnboardingStep(6, draft, ['manual']), '')
  assert.deepEqual(businessOnboardingSubmission(draft), {
    businessName: 'Mi tienda', activityDescription: 'Venta local', templateKey: 'manual',
    inventoryMode: 'both', tracksVariants: true, salesMode: 'both',
    fulfillmentMethods: ['pickup', 'delivery'], categories: ['Zapatos', 'Ropa'],
  })
  assert.equal(validateBusinessOnboardingStep(5, { ...draft, categories: [] }, ['manual']), 'Confirma al menos una categoría real de tu negocio.')
  assert.deepEqual(normalizeOnboardingCategories(Array.from({ length: 35 }, (_, index) => `Categoría ${index}`)).length, 30)
})

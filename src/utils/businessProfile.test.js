import test from 'node:test'
import assert from 'node:assert/strict'
import { getBusinessTerms, inventoryQuantityLabel, mapBusinessProfile, mapBusinessTemplate, normalizeBusinessVocabulary } from './businessProfile.js'

test('normaliza vocabulario incompleto sin aceptar espacios ni textos excesivos', () => {
  assert.deepEqual(normalizeBusinessVocabulary({ purchaseSingular: '  Lote  ', inventoryUnitPlural: '' }), {
    purchaseSingular: 'Lote',
    purchasePlural: 'Compras',
    inventoryUnitSingular: 'Producto',
    inventoryUnitPlural: 'Productos',
  })
  assert.equal(normalizeBusinessVocabulary({ purchasePlural: 'x'.repeat(60) }).purchasePlural.length, 40)
})

test('mapea perfil y plantilla sin compartir arreglos mutables', () => {
  const row = {
    owner_id: 'owner', business_name: 'Mi negocio', fulfillment_methods: ['pickup'],
    vocabulary: { purchaseSingular: 'Lote', purchasePlural: 'Lotes', inventoryUnitSingular: 'Unidad', inventoryUnitPlural: 'Unidades' },
    onboarding_status: 'completed', onboarding_step: 7,
  }
  const profile = mapBusinessProfile(row)
  assert.equal(profile.businessName, 'Mi negocio')
  assert.equal(profile.vocabulary.purchasePlural, 'Lotes')
  profile.fulfillmentMethods.push('delivery')
  assert.deepEqual(row.fulfillment_methods, ['pickup'])

  const template = mapBusinessTemplate({ template_key: 'manual', version: 1, name: 'Manual', description: 'Libre', config: { suggested_categories: ['Zapatos'] } })
  assert.deepEqual(template.suggestedCategories, ['Zapatos'])
  assert.equal(template.vocabulary.purchaseSingular, 'Compra')
})

test('convierte el vocabulario en términos visibles con singular y plural', () => {
  const terms = getBusinessTerms({ vocabulary: { purchaseSingular: 'Lote', purchasePlural: 'Lotes', inventoryUnitSingular: 'Artículo', inventoryUnitPlural: 'Artículos' } })
  assert.equal(terms.purchaseSingularLower, 'lote')
  assert.equal(terms.purchasePlural, 'Lotes')
  assert.equal(inventoryQuantityLabel(1, terms), 'artículo')
  assert.equal(inventoryQuantityLabel(2, terms), 'artículos')
})

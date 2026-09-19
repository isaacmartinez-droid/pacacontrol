import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePortalUrl } from './portalUrl.js'

test('acepta portales HTTPS y elimina rutas, consultas y fragmentos', () => {
  assert.equal(
    normalizePortalUrl('https://admin.ejemplo.com/ruta?dato=1#seccion'),
    'https://admin.ejemplo.com/',
  )
})

test('permite HTTP únicamente para desarrollo local', () => {
  assert.equal(normalizePortalUrl('http://127.0.0.1:5175/admin'), 'http://127.0.0.1:5175/')
  assert.equal(normalizePortalUrl('http://localhost:5175'), 'http://localhost:5175/')
  assert.equal(normalizePortalUrl('http://admin.ejemplo.com'), '')
})

test('rechaza protocolos, valores vacíos y direcciones inválidas', () => {
  assert.equal(normalizePortalUrl('javascript:alert(1)'), '')
  assert.equal(normalizePortalUrl(''), '')
  assert.equal(normalizePortalUrl('no-es-url'), '')
})

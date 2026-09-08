import test from 'node:test'
import assert from 'node:assert/strict'
import { getDevicePushErrorMessage } from './devicePush.js'

test('explica en español cuando el navegador no alcanza el servicio push', () => {
  const message = getDevicePushErrorMessage(new Error('Registration failed - push service error'))
  assert.match(message, /navegador no pudo conectarse/i)
  assert.match(message, /VPN|bloqueadores/)
})

test('distingue permisos bloqueados y claves del servidor inválidas', () => {
  assert.match(getDevicePushErrorMessage({ name: 'NotAllowedError' }), /bloqueadas/i)
  assert.match(getDevicePushErrorMessage({ name: 'InvalidAccessError' }), /VAPID/i)
})

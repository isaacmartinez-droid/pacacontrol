import test from 'node:test'
import assert from 'node:assert/strict'
import { getDevicePushErrorMessage, pushAvailability, testLocalDeviceNotification } from './devicePush.js'

test('explica en español cuando el navegador no alcanza el servicio push', () => {
  const message = getDevicePushErrorMessage(new Error('Registration failed - push service error'))
  assert.match(message, /navegador no pudo conectarse/i)
  assert.match(message, /VPN|bloqueadores/)
})

test('Android y escritorio permiten push; iPhone necesita instalación; prueba local no requiere servidor', async () => {
  const descriptors = Object.fromEntries(['window', 'navigator', 'Notification'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const calls = []
  const notification = { permission: 'granted' }
  const browser = { userAgent: 'Android', platform: 'Linux', maxTouchPoints: 1,
    serviceWorker: { register: async (path) => calls.push(path), ready: Promise.resolve({ showNotification: async (title, options) => calls.push({ title, options }) }) } }
  let installed = false
  try {
    for (const [key, value] of Object.entries({ Notification: notification, navigator: browser,
      window: { isSecureContext: true, Notification: notification, PushManager: class {}, matchMedia: () => ({ matches: installed }) } })) {
      Object.defineProperty(globalThis, key, { configurable: true, value })
    }
    assert.equal(pushAvailability().supported, true)
    await testLocalDeviceNotification()
    assert.equal(calls[0], '/sw.js')
    assert.equal(calls[1].options.data.url, '/alertas')
    notification.permission = 'denied'
    await assert.rejects(testLocalDeviceNotification(), /Primero permite/)
    notification.permission = 'granted'
    browser.userAgent = 'Windows'
    assert.equal(pushAvailability().supported, true)
    browser.userAgent = 'iPhone'
    assert.equal(pushAvailability().supported, false)
    installed = true
    assert.equal(pushAvailability().supported, true)
  } finally {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})

test('distingue permisos bloqueados y claves del servidor inválidas', () => {
  assert.match(getDevicePushErrorMessage({ name: 'NotAllowedError' }), /bloqueadas/i)
  assert.match(getDevicePushErrorMessage({ name: 'InvalidAccessError' }), /VAPID/i)
})

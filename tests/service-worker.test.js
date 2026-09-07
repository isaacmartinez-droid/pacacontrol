import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

async function workerHarness(windows = []) {
  const listeners = {}
  const notifications = []
  const opened = []
  const self = {
    location: { origin: 'https://tienda.example' },
    addEventListener(name, handler) { listeners[name] = handler },
    registration: { async showNotification(title, options) { notifications.push({ title, options }) } },
    clients: { async matchAll() { return windows }, async openWindow(url) { opened.push(url) }, async claim() {} },
    async skipWaiting() {},
  }
  vm.runInNewContext(await readFile(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, URL })
  return { listeners, notifications, opened }
}

test('el service worker muestra un aviso y tolera datos malformados', async () => {
  const harness = await workerHarness()
  let pending
  harness.listeners.push({ data: { json() { throw new Error('invalid json') } }, waitUntil(promise) { pending = promise } })
  await pending
  assert.equal(harness.notifications[0].title, 'PacaControl')
  assert.equal(harness.notifications[0].options.data.url, '/alertas')
})

test('el clic abre la ruta protegida e ignora destinos externos del mensaje', async () => {
  const harness = await workerHarness([{ url: 'https://otro.example', async focus() { throw new Error('Wrong origin') } }])
  let pending
  harness.listeners.notificationclick({ notification: { data: { url: 'https://attacker.example' }, close() {} }, waitUntil(promise) { pending = promise } })
  await pending
  assert.deepEqual(harness.opened, ['https://tienda.example/alertas'])
})

test('reutiliza la ventana existente de la aplicación', async () => {
  const navigated = []
  let focused = false
  const harness = await workerHarness([{ url: 'https://tienda.example/pacas', async navigate(url) { navigated.push(url) }, async focus() { focused = true } }])
  let pending
  harness.listeners.notificationclick({ notification: { close() {} }, waitUntil(promise) { pending = promise } })
  await pending
  assert.deepEqual(navigated, ['https://tienda.example/alertas'])
  assert.equal(focused, true)
  assert.equal(harness.opened.length, 0)
})

test('el manifiesto incluye iconos PNG con las dimensiones declaradas', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/')
  for (const icon of manifest.icons) {
    const png = await readFile(new URL('../public' + icon.src, import.meta.url))
    assert.equal(png.toString('ascii', 1, 4), 'PNG')
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes)
  }
})

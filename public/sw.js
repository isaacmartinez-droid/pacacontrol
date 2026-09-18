/* Solo recibe avisos. No guarda en caché pantallas ni datos privados. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() ?? {} } catch { /* Mensaje sin JSON: aviso genérico. */ }
  if (typeof payload !== 'object' || Array.isArray(payload)) payload = {}
  const titles = ['Cobro pendiente', 'Inventario bajo', 'Entrega pendiente', 'Daños elevados', 'Paca agotada']
  const title = titles.includes(payload.title) ? payload.title : 'Tienda J&F'
  const tag = typeof payload.tag === 'string' && /^pacacontrol-[a-zA-Z0-9_-]{1,100}$/.test(payload.tag) ? payload.tag : 'pacacontrol-alertas'
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
    body: typeof payload.body === 'string' ? payload.body.slice(0, 240) : 'Tienes avisos pendientes en tu tienda.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag,
    renotify: true,
    data: { url: '/alertas' },
    })
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) if (new URL(client.url).origin === self.location.origin) {
      client.postMessage?.({ type: 'PACA_PUSH_RECEIVED' })
    }
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    // El destino es interno y exige iniciar sesión; nunca abrir URLs del payload.
    const target = new URL('/alertas', self.location.origin).href
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.navigate(target)
        return client.focus()
      }
    }
    return self.clients.openWindow(target)
  })())
})

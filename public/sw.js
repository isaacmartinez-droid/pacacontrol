/* Solo recibe avisos. No guarda en caché pantallas ni datos privados. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() ?? {} } catch { /* Mensaje sin JSON: aviso genérico. */ }
  event.waitUntil(self.registration.showNotification('Tienda J&F', {
    body: typeof payload.body === 'string' ? payload.body.slice(0, 240) : 'Tienes avisos pendientes en tu tienda.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: payload.tag === 'pacacontrol-prueba' ? 'pacacontrol-prueba' : 'pacacontrol-alertas',
    data: { url: '/alertas' },
  }))
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

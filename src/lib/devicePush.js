const bindingKey = 'pacacontrol:push-device:v1'

export function pushAvailability() {
  if (typeof window === 'undefined') return { supported: false, reason: '' }
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  if (isAppleMobile && !installed) return {
    supported: false,
    reason: 'En iPhone o iPad, usa Compartir → Añadir a pantalla de inicio. Abre PacaControl desde ese icono y activa los avisos allí. Requiere iOS/iPadOS 16.4 o posterior.',
  }
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { supported: false, reason: 'Este navegador no permite notificaciones push. Abre la aplicación con HTTPS en un navegador compatible.' }
  }
  return { supported: true, reason: '' }
}

export function readPushBinding() {
  try { return JSON.parse(window.localStorage.getItem(bindingKey)) } catch { return null }
}

function decodePublicKey(key) {
  const padded = key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - key.length % 4) % 4)
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

export async function enableDevicePush(client, userId, publicKey, settings) {
  // Debe ser la primera operación asíncrona: Safari exige una acción del usuario.
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('No se concedió permiso. Puedes habilitarlo desde la configuración del navegador.')
  const { data: { session } } = await client.auth.getSession()
  if (session?.user.id !== userId) throw new Error('La sesión cambió. Vuelve a iniciar sesión para activar los avisos.')
  await navigator.serviceWorker.register('/sw.js')
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  const binding = readPushBinding()
  const key = decodePublicKey(publicKey)
  const previousKey = subscription?.options.applicationServerKey
  const sameKey = previousKey && String(new Uint8Array(previousKey)) === String(key)
  if (subscription && (binding?.ownerId !== userId || !sameKey)) {
    await subscription.unsubscribe()
    subscription = null
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  try {
    const { data: { session: current } } = await client.auth.getSession()
    if (current?.user.id !== userId) throw new Error('La sesión cambió. Vuelve a activar los avisos.')
    const serialized = subscription.toJSON()
    const { data, error } = await client.from('push_subscriptions').upsert({
      owner_id: userId, endpoint: serialized.endpoint, p256dh: serialized.keys.p256dh, auth: serialized.keys.auth, settings,
    }, { onConflict: 'endpoint' }).select('id').single()
    if (error) throw new Error('No se pudo guardar este dispositivo. Revisa que el servicio de avisos esté configurado.')
    window.localStorage.setItem(bindingKey, JSON.stringify({ ownerId: userId, subscriptionId: data.id, endpoint: serialized.endpoint }))
    return data.id
  } catch (error) {
    await subscription.unsubscribe().catch(() => {})
    throw error
  }
}

export async function disableDevicePush(client) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager?.getSubscription()
  const binding = readPushBinding()
  // Desuscribir localmente funciona también si la sesión o la red ya fallaron.
  if (subscription) await subscription.unsubscribe()
  const notifications = await registration?.getNotifications()
  notifications?.forEach((notification) => notification.close())
  try { window.localStorage.removeItem(bindingKey) } catch { /* Navegador sin almacenamiento. */ }
  if (client && binding?.subscriptionId) {
    await client.from('push_subscriptions').delete().eq('id', binding.subscriptionId).eq('owner_id', binding.ownerId).abortSignal(AbortSignal.timeout(5000))
  }
}

export async function syncDevicePushSettings(client, userId, settings) {
  const binding = readPushBinding()
  if (binding?.ownerId !== userId) return
  const { data, error } = await client.from('push_subscriptions').update({ settings })
    .eq('id', binding.subscriptionId).eq('owner_id', userId).select('id').single()
  if (error || !data) throw new Error('Los límites se guardaron aquí, pero no se pudieron actualizar los avisos de este dispositivo. Vuelve a guardar cuando tengas conexión.')
}

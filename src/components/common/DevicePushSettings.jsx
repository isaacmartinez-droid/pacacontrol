import { useEffect, useState } from 'react'
import { BellRing, Smartphone } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAlerts } from '../../context/AlertsContext'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { disableDevicePush, enableDevicePush, getDevicePushErrorMessage, pushAvailability, readPushBinding } from '../../lib/devicePush'

export default function DevicePushSettings() {
  const { user } = useAuth()
  const userId = user?.id
  const { settings } = useAlerts()
  const [availability, setAvailability] = useState({ supported: false, reason: '' })
  const [config, setConfig] = useState(null)
  const [subscriptionId, setSubscriptionId] = useState('')
  const [permission, setPermission] = useState('default')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    const available = pushAvailability()
    setAvailability(available)
    if (!available.supported) return undefined
    setPermission(Notification.permission)
    async function inspect() {
      try {
        const response = await fetch('/api/push-config', { cache: 'no-store' })
        const result = await response.json()
        if (cancelled) return
        setConfig(response.ok ? result : { configured: false })
        const binding = readPushBinding()
        const registration = await navigator.serviceWorker.getRegistration('/')
        const subscription = await registration?.pushManager.getSubscription()
        if (binding?.ownerId === userId && subscription?.endpoint === binding.endpoint && Notification.permission === 'granted') {
          const { data, error } = await getSupabaseClient().from('push_subscriptions').select('id').eq('id', binding.subscriptionId).eq('owner_id', userId).maybeSingle()
          if (!cancelled && !error && data) setSubscriptionId(data.id)
        }
      } catch { if (!cancelled) setConfig({ configured: false }) }
    }
    inspect()
    return () => { cancelled = true }
  }, [userId])

  async function enable() {
    setBusy(true)
    setMessage('')
    try {
      const id = await enableDevicePush(getSupabaseClient(), userId, config.publicKey, settings)
      setSubscriptionId(id)
      setPermission(Notification.permission)
      setMessage('Este dispositivo quedó activado. Puedes enviar una prueba.')
    } catch (error) { setMessage(getDevicePushErrorMessage(error)); setPermission(Notification.permission) }
    finally { setBusy(false) }
  }

  async function disable() {
    setBusy(true)
    try {
      await disableDevicePush(getSupabaseClient())
      setSubscriptionId('')
      setMessage('Avisos desactivados en este dispositivo.')
    } catch { setMessage('No se pudieron desactivar los avisos. Puedes revocar el permiso desde el navegador.') }
    finally { setBusy(false) }
  }

  async function testPush() {
    setBusy(true)
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      const response = await fetch('/api/push-test', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ subscriptionId }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setMessage('Prueba enviada desde el servidor. Si no aparece, revisa los permisos y el modo No molestar del dispositivo.')
    } catch (error) { setMessage(error.message || 'No se pudo enviar la prueba.') }
    finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="device-push-title" className="mb-5 rounded-3xl bg-brand-50 p-5 ring-1 ring-brand-100">
      <h2 id="device-push-title" className="flex items-center gap-2 text-lg font-extrabold text-brand-900"><Smartphone aria-hidden="true" size={21} />Avisos en este dispositivo</h2>
      <p className="mt-2 text-sm leading-6 text-brand-800">Recibe notificaciones del teléfono o la computadora, incluso con la aplicación cerrada. Actívalas por separado en cada dispositivo.</p>
      {!availability.supported ? <p className="mt-3 text-sm leading-6 text-slate-600">{availability.reason || 'Comprobando compatibilidad…'}</p> : (
        <>
          {config === null && <p role="status" className="mt-3 text-sm text-slate-600">Comprobando el servicio de avisos…</p>}
          {config && !config.configured && <p role="status" className="mt-3 text-sm text-amber-800">Los avisos fuera de la aplicación todavía no están habilitados para esta tienda. Las alertas de la campana siguen disponibles.</p>}
          {config?.configured && !config.schedulerHealthy && <p role="status" className="mt-3 text-sm text-amber-800">La revisión automática del servidor todavía no está confirmada. Puedes probar los avisos; el envío automático requiere completar su configuración.</p>}
          {permission === 'denied' && <p className="mt-3 text-sm text-amber-800">El permiso está bloqueado. Permite las notificaciones en la configuración de este sitio y vuelve a abrir esta pantalla.</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            {subscriptionId ? (
              <>
                <button type="button" disabled={busy || !config?.configured} onClick={testPush} className="min-h-11 rounded-xl bg-brand-900 px-4 text-sm font-bold text-white disabled:opacity-50">Enviar prueba</button>
                <button type="button" disabled={busy} onClick={disable} className="min-h-11 rounded-xl bg-white px-4 text-sm font-bold text-brand-800 disabled:opacity-50">Desactivar aquí</button>
              </>
            ) : <button type="button" onClick={enable} disabled={busy || !config?.configured || permission === 'denied'} className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-900 px-4 text-sm font-bold text-white disabled:opacity-50"><BellRing aria-hidden="true" size={17} />Activar notificaciones</button>}
          </div>
          {subscriptionId && <p className="mt-3 text-xs font-bold text-brand-700">Dispositivo registrado para esta cuenta.</p>}
        </>
      )}
      {busy && <p role="status" className="mt-3 text-sm text-brand-800">Procesando…</p>}
      {message && <p role="status" className="mt-3 text-sm leading-6 text-brand-800">{message}</p>}
      <p className="mt-3 text-xs leading-5 text-slate-500">Los avisos muestran un resumen sin nombres ni importes. Al cerrar sesión se desactivan en este dispositivo.</p>
    </section>
  )
}

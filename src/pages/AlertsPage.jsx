import { useEffect, useState } from 'react'
import { Bell, CheckCheck, Settings2 } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import EmptyState from '../components/common/EmptyState'
import AlertItem from '../components/common/AlertItem'
import DevicePushSettings from '../components/common/DevicePushSettings'
import { useAlerts } from '../context/AlertsContext'

export default function AlertsPage() {
  const { notifications, unreadCount, settings, saveSettings, markAsRead, markAllAsRead, isLoading, error, storageError, lastUpdatedAt } = useAlerts()
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [draft, setDraft] = useState(settings)
  const [message, setMessage] = useState('')
  useEffect(() => { setDraft(settings) }, [settings])
  const visibleAlerts = notifications.filter((item) => !onlyUnread || !item.read)

  function change(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
    setMessage('')
  }

  async function handleSave(event) {
    event.preventDefault()
    const stockLimit = Number(draft.stockLimit)
    const deliveryHours = Number(draft.deliveryHours)
    const damagePercent = Number(draft.damagePercent)
    if (!Number.isInteger(stockLimit) || stockLimit < 0 || stockLimit > 10000
      || !Number.isInteger(deliveryHours) || deliveryHours < 1 || deliveryHours > 720
      || !Number.isInteger(damagePercent) || damagePercent < 1 || damagePercent > 100) {
      setMessage('Revisa los límites: inventario de 0 a 10000, horas de 1 a 720 y daños de 1 a 100 %. Usa números enteros.')
      return
    }
    const result = await saveSettings({ ...draft, stockLimit, deliveryHours, damagePercent })
    setMessage(result?.error || 'Reglas actualizadas. Las alertas ya usan tus nuevos límites.')
  }

  return (
    <div>
      <PageHeader eyebrow="Tu tienda al día" title="Alertas" description="Detecta lo que necesita atención y abre el registro para revisarlo." backTo="/mas" />
      <div className="page-content grid items-start gap-6 py-6 md:py-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <section aria-labelledby="alerts-title" className="min-w-0">
          <DevicePushSettings />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="alerts-title" className="text-lg font-extrabold text-slate-900">{notifications.length} alertas activas</h2>
              <p className="mt-1 text-xs text-slate-500">{unreadCount} sin leer. Leer una alerta no resuelve el problema.</p>
            </div>
            {unreadCount > 0 && <button type="button" onClick={markAllAsRead} className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-brand-800 ring-1 ring-slate-200"><CheckCheck aria-hidden="true" size={16} />Marcar todas leídas</button>}
          </div>
          <div role="group" aria-label="Filtrar alertas" className="my-4 flex gap-2">
            {[{ label: 'Todas', unread: false }, { label: 'Sin leer', unread: true }].map((filter) => (
              <button key={filter.label} type="button" aria-pressed={onlyUnread === filter.unread} onClick={() => setOnlyUnread(filter.unread)} className={`min-h-11 rounded-xl px-4 text-sm font-bold ${onlyUnread === filter.unread ? 'bg-brand-900 text-white' : 'bg-white text-slate-600'}`}>{filter.label}</button>
            ))}
          </div>
          {error && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">No pudimos actualizar los datos. Las alertas pueden estar desactualizadas; reintentaremos al recuperar la conexión.</p>}
          {isLoading ? <p role="status" className="rounded-2xl bg-white p-6 text-sm text-slate-600">Revisando inventario, pedidos y pacas…</p> : visibleAlerts.length > 0 ? (
            <ul className="space-y-3">
              {visibleAlerts.map((notification) => <li key={notification.id} className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-100"><AlertItem notification={notification} onOpen={() => markAsRead(notification.id)} /></li>)}
            </ul>
          ) : !error && <EmptyState icon={Bell} title={onlyUnread ? 'No hay alertas sin leer' : 'No hay alertas activas'} description={onlyUnread ? 'Puedes consultar las alertas que siguen pendientes en “Todas”.' : 'Tu tienda no tiene avisos según los límites configurados.'} />}
          <p className="mt-4 text-xs leading-5 text-slate-500">Se revisan cada minuto mientras la aplicación está visible y al volver a ella. Los avisos desaparecen cuando los datos dejan de cumplir la regla.</p>
          {lastUpdatedAt && <p className="mt-1 text-xs text-slate-500">Última actualización: {new Date(lastUpdatedAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</p>}
        </section>

        <form onSubmit={handleSave} className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><Settings2 aria-hidden="true" size={20} />Límites de las alertas</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">Personaliza qué necesita atención. Los límites y las lecturas se guardan para tu cuenta en este navegador.</p>
          <div className="mt-5 space-y-5">
            <Rule label="Inventario bajo" enabled={draft.stockEnabled} onToggle={(value) => change('stockEnabled', value)} description="Avisa al llegar al límite o por debajo. Solo incluye categorías que ya recibieron piezas.">
              <Limit label="Piezas disponibles" id="alert-stock" value={draft.stockLimit} min={0} max={10000} onChange={(value) => change('stockLimit', value)} />
            </Rule>
            <Rule label="Revisar entregas" enabled={draft.deliveryEnabled} onToggle={(value) => change('deliveryEnabled', value)} description="Ventas con cliente que siguen en “Pagado” después de estas horas desde su registro. Excluye ventas de mostrador; confirma si requieren envío.">
              <Limit label="Horas desde el registro" id="alert-delivery" value={draft.deliveryHours} min={1} max={720} onChange={(value) => change('deliveryHours', value)} />
            </Rule>
            <Rule label="Daños por paca" enabled={draft.damageEnabled} onToggle={(value) => change('damageEnabled', value)} description="Avisa cuando las piezas dañadas alcanzan este porcentaje del total recibido en una paca.">
              <Limit label="Porcentaje de daños" id="alert-damage" value={draft.damagePercent} min={1} max={100} onChange={(value) => change('damagePercent', value)} />
            </Rule>
          </div>
          <button type="submit" className="mt-5 min-h-12 w-full rounded-xl bg-brand-900 px-5 text-sm font-extrabold text-white hover:bg-brand-800">Guardar límites</button>
          {message && <p role="status" className="mt-3 text-sm text-brand-700">{message}</p>}
          {storageError && <p role="alert" className="mt-3 text-sm text-amber-800">{storageError}</p>}
        </form>
      </div>
    </div>
  )
}

function Rule({ label, enabled, onToggle, description, children }) {
  return (
    <fieldset className="border-t border-slate-100 pt-4">
      <legend className="sr-only">{label}</legend>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-bold text-slate-800">
        {label}<input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} className="size-5 accent-brand-700" />
      </label>
      <p className="mb-3 text-xs leading-5 text-slate-500">{description}</p>
      {children}
    </fieldset>
  )
}

function Limit({ label, id, value, min, max, onChange }) {
  return <div><label htmlFor={id} className="mb-2 block text-xs font-bold text-slate-600">{label}</label><input id={id} type="number" inputMode="numeric" required min={min} max={max} step="1" value={value} onChange={(event) => onChange(event.target.value)} className="sale-input" /></div>
}

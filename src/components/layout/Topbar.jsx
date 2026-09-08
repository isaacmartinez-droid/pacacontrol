import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAlerts } from '../../context/AlertsContext'
import AlertItem from '../common/AlertItem'
import BrandLogo from '../common/BrandLogo'

function Topbar({ eyebrow, title, description, backTo }) {
  const [showNotifications, setShowNotifications] = useState(false)
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading, error } = useAlerts()
  const notificationRef = useRef(null)
  const bellRef = useRef(null)

  useEffect(() => {
    if (!showNotifications) return undefined
    function closeOnOutsideClick(event) {
      if (!notificationRef.current?.contains(event.target)) setShowNotifications(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setShowNotifications(false)
        bellRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [showNotifications])

  return (
    <header className="relative z-30 bg-brand-950 text-white">
      <div aria-hidden="true" className="absolute -right-12 -top-16 size-40 rounded-full border-[28px] border-white/5" />
      <div className="page-frame relative px-4 py-4 sm:px-5 md:px-8 md:py-5 xl:px-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {backTo ? (
              <Link to={backTo} aria-label="Regresar" title="Regresar" className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-brand-100 transition hover:bg-white/15 hover:text-white active:scale-95">
                <ArrowLeft aria-hidden="true" size={20} />
              </Link>
            ) : (
              <span className="size-10 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-white/15">
                <BrandLogo />
              </span>
            )}
            <div className="min-w-0">
              {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-200">{eyebrow}</p>}
              <h1 className="truncate text-xl font-extrabold tracking-tight text-white md:text-2xl">{title}</h1>
            </div>
          </div>

          <div ref={notificationRef} className="relative shrink-0">
            <button
              ref={bellRef}
              type="button"
              aria-label={`${showNotifications ? 'Cerrar' : 'Ver'} alertas${unreadCount ? `, ${unreadCount} sin leer` : ''}`}
              aria-expanded={showNotifications}
              aria-controls="notifications-panel"
              onClick={() => setShowNotifications((open) => !open)}
              className="relative grid size-10 place-items-center rounded-2xl bg-white/10 text-white transition hover:bg-white/15 active:scale-95"
            >
              <Bell aria-hidden="true" size={19} />
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-coral-500 px-1 text-[0.62rem] font-extrabold leading-4 text-white ring-2 ring-brand-950">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>

            {showNotifications && (
              <section id="notifications-panel" aria-label="Alertas de la tienda" className="absolute right-0 top-[calc(100%+0.75rem)] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl shadow-brand-950/25 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
                  <div>
                    <h2 className="text-sm font-extrabold">Alertas de la tienda</h2>
                    <p className="mt-0.5 text-xs text-slate-500">{notifications.length} activas · {unreadCount} sin leer</p>
                  </div>
                  {unreadCount > 0 && (
                    <button type="button" onClick={markAllAsRead} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-bold text-brand-700 hover:bg-brand-50">
                      <CheckCheck aria-hidden="true" size={15} /> Leer todas
                    </button>
                  )}
                </div>
                {error && <p role="status" className="bg-amber-50 px-4 py-3 text-xs text-amber-800">No pudimos actualizar las alertas. Los datos pueden estar desactualizados.</p>}
                {isLoading ? <p role="status" className="p-5 text-sm text-slate-500">Revisando tu tienda…</p> : (
                  notifications.length > 0 ? (
                    <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                      {notifications.slice(0, 5).map((notification) => (
                        <li key={notification.id}>
                          <AlertItem notification={notification} onOpen={() => { markAsRead(notification.id); setShowNotifications(false) }} />
                        </li>
                      ))}
                    </ul>
                  ) : !error && <p className="p-5 text-sm leading-6 text-slate-500">No hay alertas activas según tus límites actuales.</p>
                )}
                <Link to="/alertas" onClick={() => setShowNotifications(false)} className="flex min-h-12 items-center justify-center border-t border-slate-100 px-4 text-sm font-bold text-brand-800 hover:bg-brand-50">Ver todas y configurar límites</Link>
              </section>
            )}
          </div>
        </div>
        {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-100">{description}</p>}
      </div>
    </header>
  )
}

export default Topbar

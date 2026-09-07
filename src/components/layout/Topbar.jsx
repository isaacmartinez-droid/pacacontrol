import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  PackageCheck,
  ShoppingBag,
  Store,
  TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const notificationItems = [
  {
    id: 'sale',
    title: 'Nueva venta registrada',
    description: 'María López compró 4 prendas.',
    time: 'Hace 12 min',
    icon: ShoppingBag,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'stock',
    title: 'Inventario actualizado',
    description: 'Las piezas disponibles están listas para vender.',
    time: 'Hace 1 h',
    icon: PackageCheck,
    tone: 'bg-brand-50 text-brand-700',
  },
  {
    id: 'damaged',
    title: 'Productos por revisar',
    description: 'Hay 7 prendas dañadas registradas.',
    time: 'Ayer',
    icon: TriangleAlert,
    tone: 'bg-amber-50 text-amber-700',
  },
]

function Topbar({ eyebrow, title, description, backTo, availablePieces }) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState(() =>
    notificationItems.map((notification) =>
      notification.id === 'stock' && typeof availablePieces === 'number'
        ? {
            ...notification,
            description: `${availablePieces} piezas disponibles están listas para vender.`,
          }
        : notification,
    ),
  )
  const notificationRef = useRef(null)
  const unreadCount = notifications.filter((notification) => !notification.read).length

  useEffect(() => {
    if (!showNotifications) return undefined

    function closeOnOutsideClick(event) {
      if (!notificationRef.current?.contains(event.target)) setShowNotifications(false)
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setShowNotifications(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [showNotifications])

  function markAsRead(notificationId) {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification,
      ),
    )
  }

  function markAllAsRead() {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, read: true })),
    )
  }

  return (
    <header className="relative z-30 bg-brand-950 text-white">
      <div
        aria-hidden="true"
        className="absolute -right-12 -top-16 size-40 rounded-full border-[28px] border-white/5"
      />
      <div className="page-frame relative px-4 py-4 sm:px-5 md:px-8 md:py-5 xl:px-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {backTo ? (
              <Link
                to={backTo}
                aria-label="Regresar"
                title="Regresar"
                className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-brand-100 transition hover:bg-white/15 hover:text-white active:scale-95"
              >
                <ArrowLeft aria-hidden="true" size={20} />
              </Link>
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/15">
                <Store aria-hidden="true" size={20} strokeWidth={2.2} />
              </span>
            )}
            <div className="min-w-0">
              {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-200">{eyebrow}</p>}
              <h1 className="truncate text-xl font-extrabold tracking-tight text-white md:text-2xl">{title}</h1>
            </div>
          </div>

          <NotificationMenu
            notificationRef={notificationRef}
            notifications={notifications}
            showNotifications={showNotifications}
            unreadCount={unreadCount}
            onToggle={() => setShowNotifications((isOpen) => !isOpen)}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
          />
        </div>

        {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-100">{description}</p>}
      </div>
    </header>
  )
}

function NotificationMenu({
  notifications,
  showNotifications,
  unreadCount,
  onToggle,
  onMarkAsRead,
  onMarkAllAsRead,
  notificationRef,
}) {
  return (
    <div ref={notificationRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={showNotifications ? 'Cerrar notificaciones' : 'Ver notificaciones'}
        aria-expanded={showNotifications}
        aria-controls="notifications-panel"
        onClick={onToggle}
        className="relative grid size-10 place-items-center rounded-2xl bg-white/10 text-white transition hover:bg-white/15 active:scale-95"
      >
        <Bell aria-hidden="true" size={19} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-coral-500 px-1 text-[0.62rem] font-extrabold leading-4 text-white ring-2 ring-brand-950">
            {unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <section
          id="notifications-panel"
          aria-label="Notificaciones"
          className="absolute right-0 top-[calc(100%+0.75rem)] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl shadow-brand-950/25 ring-1 ring-slate-200"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
            <div>
              <h2 className="text-sm font-extrabold">Notificaciones</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {unreadCount > 0 ? `${unreadCount} sin leer` : 'Estás al día'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
              >
                <CheckCheck aria-hidden="true" size={15} />
                Marcar leídas
              </button>
            )}
          </div>

          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {notifications.map((notification) => {
              const Icon = notification.icon

              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => onMarkAsRead(notification.id)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                      notification.read ? 'bg-white' : 'bg-brand-50/60'
                    }`}
                  >
                    <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${notification.tone}`}>
                      <Icon aria-hidden="true" size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-slate-800">{notification.title}</span>
                        {!notification.read && (
                          <span aria-label="Sin leer" className="mt-1.5 size-2 shrink-0 rounded-full bg-coral-500" />
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                        {notification.description}
                      </span>
                      <span className="mt-1 block text-[0.68rem] font-semibold text-slate-400">
                        {notification.time}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

export default Topbar

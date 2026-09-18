import { useEffect, useRef, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAlerts } from '../../context/AlertsContext'
import { useAuth } from '../../context/AuthContext'
import { planAlertBanners } from '../../utils/alertBanners'

export default function AlertBanners() {
  const { notifications, markAsRead, isLoading, error } = useAlerts()
  const { user } = useAuth()
  const key = `pacacontrol:banners:v1:${user?.id}`
  const presented = useRef(null)
  const [queue, setQueue] = useState([])
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => {
    if (!visible || isLoading || error) return
    if (!presented.current) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(key))
        presented.current = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
      } catch { presented.current = {} }
    }
    const plan = planAlertBanners(notifications, presented.current)
    presented.current = plan.presented
    try { sessionStorage.setItem(key, JSON.stringify(plan.presented)) } catch { /* Deduplicación en memoria. */ }
    setQueue((previous) => {
      const active = previous.filter((notice) => notifications.some((item) => item.id === notice.id && item.revision === notice.revision && !item.read))
      return [...active, ...plan.fresh]
    })
  }, [notifications, isLoading, error, key, visible])

  const dismiss = (id) => setQueue((current) => current.filter((item) => item.id !== id))
  useEffect(() => { if (!queue.length) setPaused(false) }, [queue.length])
  useEffect(() => {
    if (!visible || paused || !queue.length) return undefined
    const shown = new Set(queue.slice(0, 3).map((notice) => notice.id))
    const timer = window.setTimeout(() => setQueue((current) => current.filter((notice) => !shown.has(notice.id))), 15000)
    return () => window.clearTimeout(timer)
  }, [queue, paused, visible])
  if (!queue.length) return null
  return <aside aria-label="Avisos en pantalla" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }} className="fixed inset-x-3 bottom-24 z-[70] space-y-3 sm:left-auto sm:right-5 sm:w-96 lg:bottom-5">
    <div aria-live="polite" aria-relevant="additions" className="max-h-[60vh] space-y-3 overflow-y-auto">
      {queue.slice(0, 3).map((notice) => <section key={`${notice.id}:${notice.revision}`} role="status" className="rounded-2xl border border-white/15 bg-brand-950 p-4 text-white shadow-2xl">
        <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs font-bold text-brand-100"><BellRing size={17} />Tienda J&amp;F</span><button type="button" aria-label={`Cerrar aviso: ${notice.title}`} onClick={() => dismiss(notice.id)} className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-white/10"><X size={18} /></button></div>
        <p className="mt-1 break-words text-sm font-extrabold">{notice.title}</p>
        <p className="mt-2 break-words text-xs leading-5 text-brand-100">{notice.description}</p>
        <Link to={notice.to} onClick={() => { markAsRead(notice.id); dismiss(notice.id) }} className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20">{notice.action}</Link>
      </section>)}
    </div>
    {queue.length > 3 && <Link to="/alertas" className="block rounded-xl bg-white p-3 text-center text-xs font-bold text-brand-900 shadow-lg">Hay {queue.length - 3} avisos más. Ver todas las alertas</Link>}
  </aside>
}

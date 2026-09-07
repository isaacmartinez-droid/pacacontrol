import { ArrowUpRight, PackageSearch, TriangleAlert, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'

const styles = {
  stock: { icon: PackageSearch, tone: 'bg-coral-50 text-coral-600' },
  delivery: { icon: Truck, tone: 'bg-sky-50 text-sky-700' },
  damage: { icon: TriangleAlert, tone: 'bg-amber-50 text-amber-700' },
}

export default function AlertItem({ notification, onOpen }) {
  const { icon: Icon, tone } = styles[notification.type]
  return (
    <Link to={notification.to} onClick={onOpen} className={`flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-slate-50 ${notification.read ? 'bg-white' : 'bg-brand-50/60'}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon aria-hidden="true" size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="break-words text-sm font-bold text-slate-800">{notification.title}</span>
          {!notification.read && <span aria-label="Sin leer" className="mt-1.5 size-2 shrink-0 rounded-full bg-coral-500" />}
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-600">{notification.description}</span>
        <span className="mt-1 block text-xs text-slate-500">{notification.detail}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand-700">{notification.action}<ArrowUpRight aria-hidden="true" size={14} /></span>
      </span>
    </Link>
  )
}

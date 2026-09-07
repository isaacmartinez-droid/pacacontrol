import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

function SectionTitle({ title, subtitle, linkTo, linkLabel = 'Ver todas' }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-xl px-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50 active:scale-95"
        >
          {linkLabel}
          <ChevronRight aria-hidden="true" size={16} />
        </Link>
      )}
    </div>
  )
}

export default SectionTitle

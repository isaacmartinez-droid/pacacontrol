import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

function QuickAction({ to, icon: Icon, title, description, primary = false }) {
  return (
    <Link
      to={to}
      className={`group relative flex min-h-28 flex-col justify-between overflow-hidden rounded-3xl p-4 transition active:scale-[0.98] ${
        primary
          ? 'bg-brand-900 text-white shadow-lg shadow-brand-900/15 hover:bg-brand-800'
          : 'border border-brand-200 bg-brand-100 text-brand-950 hover:bg-brand-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`grid size-10 place-items-center rounded-2xl ${
            primary ? 'bg-white/12' : 'bg-white/90 text-brand-700 shadow-sm'
          }`}
        >
          <Icon aria-hidden="true" size={21} />
        </span>
        <ArrowUpRight
          aria-hidden="true"
          size={18}
          className={primary ? 'text-brand-200' : 'text-brand-500'}
        />
      </div>
      <div className="mt-5">
        <p className="font-extrabold tracking-tight">{title}</p>
        <p className={`mt-0.5 text-xs ${primary ? 'text-brand-100' : 'text-brand-700'}`}>
          {description}
        </p>
      </div>
    </Link>
  )
}

export default QuickAction

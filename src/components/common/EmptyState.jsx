import { Link } from 'react-router-dom'

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-soft">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Icon aria-hidden="true" size={26} />
      </div>
      <h2 className="mt-4 text-lg font-extrabold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">{description}</p>
      {action && (
        <Link
          to={action.to}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-900 px-5 text-sm font-bold text-white transition hover:bg-brand-800 active:scale-95"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}

export default EmptyState

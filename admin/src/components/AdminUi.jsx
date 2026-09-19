import { CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react'

const healthClasses = {
  healthy: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  attention: 'bg-amber-50 text-amber-800 ring-amber-200',
  critical: 'bg-red-50 text-red-800 ring-red-200',
  new: 'bg-blue-50 text-blue-800 ring-blue-200',
  closed: 'bg-slate-100 text-slate-700 ring-slate-200',
}

const accessClasses = {
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  suspended: 'bg-amber-50 text-amber-800 ring-amber-200',
  closed: 'bg-slate-100 text-slate-700 ring-slate-200',
}

export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-600">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function MetricCard({ label, value, detail, icon: Icon, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-800',
    slate: 'bg-slate-100 text-slate-700',
  }
  return (
    <article className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-950">{value}</p>
        </div>
        {Icon && <span className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}><Icon aria-hidden="true" size={20} /></span>}
      </div>
      {detail && <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{detail}</p>}
    </article>
  )
}

export function HealthBadge({ health }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ring-inset ${healthClasses[health.id] ?? healthClasses.closed}`}>{health.label}</span>
}

export function AccessBadge({ status, label }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ring-inset ${accessClasses[status] ?? accessClasses.closed}`}>{label}</span>
}

export function SeverityBadge({ severity }) {
  const health = severity === 'critical'
    ? { id: 'critical', label: 'Crítica' }
    : { id: 'attention', label: 'Atención' }
  return <HealthBadge health={health} />
}

export function LoadingPanel({ label = 'Cargando información…' }) {
  return <div className="grid min-h-48 place-items-center rounded-2xl bg-white text-sm font-bold text-brand-800 shadow-soft ring-1 ring-slate-100"><span className="flex items-center gap-2"><LoaderCircle className="animate-spin" size={18} />{label}</span></div>
}

export function ErrorPanel({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-2xl bg-red-50 p-5 text-red-800 ring-1 ring-red-100">
      <div className="flex items-start gap-3"><CircleAlert className="mt-0.5 shrink-0" size={20} /><div><h2 className="font-extrabold">No pudimos cargar el centro de control</h2><p className="mt-1 text-sm font-semibold leading-6">{message}</p></div></div>
      {onRetry && <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-800 px-4 text-sm font-extrabold text-white"><RefreshCw size={17} />Reintentar</button>}
    </div>
  )
}

export function EmptyPanel({ title, description }) {
  return <div className="rounded-2xl bg-slate-50 p-6 text-center ring-1 ring-slate-100"><p className="font-extrabold text-slate-900">{title}</p><p className="mt-1 text-sm font-medium leading-6 text-slate-500">{description}</p></div>
}

export function InfoItem({ label, value }) {
  return <div><dt className="text-xs font-extrabold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-slate-900">{value ?? '—'}</dd></div>
}

export function formatAdminDate(value, fallback = '—') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Managua' }).format(date)
}

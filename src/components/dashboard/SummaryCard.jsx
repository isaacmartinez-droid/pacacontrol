const toneClasses = {
  brand: 'bg-white/12 text-brand-100',
  positive: 'bg-emerald-400/15 text-emerald-100',
  neutral: 'bg-sky-400/15 text-sky-100',
  warning: 'bg-amber-400/15 text-amber-100',
}

function SummaryCard({ icon: Icon, label, value, detail, badge, tone = 'brand' }) {
  return (
    <article className="relative min-w-0 overflow-hidden rounded-2xl border border-brand-800 bg-brand-900 p-4 text-white shadow-lg shadow-brand-950/15 sm:p-5">
      <span aria-hidden="true" className="absolute -right-6 -top-8 size-24 rounded-full bg-white/5" />
      <div className="relative flex items-start justify-between gap-3">
        <div className={`grid size-10 place-items-center rounded-xl shadow-sm ${toneClasses[tone]}`}>
          <Icon aria-hidden="true" size={19} strokeWidth={2.25} />
        </div>
        {badge && (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.08em] text-brand-100">
            {badge}
          </span>
        )}
      </div>
      <p className="relative mt-5 truncate text-xs font-bold text-brand-100">{label}</p>
      <p className="relative mt-1 truncate text-2xl font-extrabold tracking-tight text-white">{value}</p>
      <p className="relative mt-3 inline-flex rounded-lg bg-white/10 px-2 py-1 text-[0.68rem] font-bold text-brand-100">
        {detail}
      </p>
    </article>
  )
}

export default SummaryCard

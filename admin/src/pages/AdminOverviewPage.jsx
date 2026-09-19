import { AlertTriangle, ArrowRight, Building2, CircleCheck, HeartPulse, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAdminData } from '../AdminDataContext'
import { buildAccountAlerts, deriveAccountHealth, summarizeAccounts } from '../adminAccounts'
import { EmptyPanel, ErrorPanel, HealthBadge, LoadingPanel, MetricCard, PageHeading, SeverityBadge } from '../components/AdminUi'

function AdminOverviewPage() {
  const { customerAccounts, isLoading, error, reload } = useAdminData()
  const summary = summarizeAccounts(customerAccounts)
  const alerts = customerAccounts.flatMap(buildAccountAlerts).sort(sortAlerts)
  const accountsNeedingAttention = customerAccounts
    .map((account) => ({ account, health: deriveAccountHealth(account) }))
    .filter(({ health }) => ['critical', 'attention'].includes(health.id))
    .sort((a, b) => healthPriority(a.health.id) - healthPriority(b.health.id))

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Vista general" title="Panel admin" description="Prioriza cuentas que requieren acción y consulta el estado general sin mezclarlo con los datos operativos de cada negocio." action={<button type="button" onClick={reload} disabled={isLoading} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-950 px-4 text-sm font-extrabold text-white disabled:opacity-60">Actualizar datos</button>} />

      {error && <ErrorPanel message={error} onRetry={reload} />}
      {isLoading && customerAccounts.length === 0 ? <LoadingPanel /> : (
        <>
          <section aria-label="Indicadores de salud" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Cuentas" value={summary.total} detail={`${summary.active} con acceso activo`} icon={Building2} tone="brand" />
            <MetricCard label="Saludables" value={summary.healthy} detail="Sin alertas administrativas inmediatas" icon={CircleCheck} tone="emerald" />
            <MetricCard label="Requieren atención" value={summary.attention} detail="Conviene revisarlas próximamente" icon={AlertTriangle} tone="amber" />
            <MetricCard label="Críticas" value={summary.critical} detail="Tienen un bloqueo o vencimiento" icon={ShieldAlert} tone="red" />
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
            <section className="rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div><h2 className="text-lg font-extrabold text-slate-950">Necesitan atención</h2><p className="mt-1 text-sm font-medium text-slate-500">La salud siempre incluye una razón visible.</p></div>
                <Link to="/cuentas?estado=attention" className="text-sm font-extrabold text-brand-700 hover:text-brand-950">Ver cuentas</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {accountsNeedingAttention.slice(0, 6).map(({ account, health }) => (
                  <Link key={account.userId} to={`/cuentas/${account.userId}`} className="flex items-center gap-3 p-4 transition hover:bg-slate-50 sm:px-5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 font-extrabold text-brand-900">{(account.displayName || account.email || '?').charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-slate-950">{account.displayName || 'Cuenta sin nombre'}</span><span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{health.detail}</span></span>
                    <HealthBadge health={health} /><ArrowRight aria-hidden="true" className="hidden text-slate-400 sm:block" size={18} />
                  </Link>
                ))}
                {!accountsNeedingAttention.length && <div className="p-5"><EmptyPanel title="Nada urgente por ahora" description="No encontramos cuentas críticas ni con atención pendiente." /></div>}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
              <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-800"><HeartPulse size={20} /></span><div><h2 className="font-extrabold text-slate-950">Cola de alertas</h2><p className="mt-1 text-sm font-medium leading-6 text-slate-500">{alerts.length} señales generadas con la información disponible.</p></div></div>
              <div className="mt-4 space-y-3">
                {alerts.slice(0, 5).map((alert) => (
                  <Link key={alert.id} to={`/cuentas/${alert.account.userId}`} className="block rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100 hover:bg-brand-50">
                    <div className="flex items-center justify-between gap-2"><p className="text-sm font-extrabold text-slate-950">{alert.title}</p><SeverityBadge severity={alert.severity} /></div>
                    <p className="mt-1 truncate text-xs font-bold text-slate-500">{alert.account.displayName || 'Cuenta sin nombre'}</p>
                  </Link>
                ))}
                {!alerts.length && <EmptyPanel title="Sin alertas" description="Las cuentas están al día con las reglas actuales." />}
              </div>
              {alerts.length > 5 && <Link to="/alertas" className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-brand-700">Ver todas las alertas <ArrowRight size={17} /></Link>}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function sortAlerts(a, b) {
  return healthPriority(a.severity) - healthPriority(b.severity)
}

function healthPriority(value) {
  return value === 'critical' ? 0 : value === 'attention' ? 1 : 2
}

export default AdminOverviewPage

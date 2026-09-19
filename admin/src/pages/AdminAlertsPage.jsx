import { BellRing } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminData } from '../AdminDataContext'
import { buildAccountAlerts } from '../adminAccounts'
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading, SeverityBadge } from '../components/AdminUi'

const filters = [
  { id: 'all', label: 'Todas' },
  { id: 'critical', label: 'Críticas' },
  { id: 'attention', label: 'Atención' },
]

function AdminAlertsPage() {
  const { customerAccounts, isLoading, error, reload } = useAdminData()
  const [filter, setFilter] = useState('all')
  const alerts = useMemo(() => customerAccounts.flatMap(buildAccountAlerts).sort((a, b) => priority(a.severity) - priority(b.severity)), [customerAccounts])
  const visible = filter === 'all' ? alerts : alerts.filter((alert) => alert.severity === filter)

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Bandeja de trabajo" title="Alertas" description="Señales explicables derivadas de acceso, vencimientos, cumplimiento y actividad. En una fase posterior podrán asignarse y resolverse como tareas." />
      {error && <ErrorPanel message={error} onRetry={reload} />}
      {isLoading && customerAccounts.length === 0 ? <LoadingPanel /> : (
        <section className="rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-800"><BellRing size={20} /></span><div><h2 className="font-extrabold text-slate-950">Atención administrativa</h2><p className="mt-1 text-sm font-medium text-slate-500">{alerts.length} alertas activas</p></div></div>
            <div className="flex gap-2">{filters.map((option) => <button key={option.id} type="button" onClick={() => setFilter(option.id)} className={`rounded-full px-3 py-2 text-xs font-extrabold ${filter === option.id ? 'bg-brand-950 text-white' : 'bg-slate-100 text-slate-700'}`}>{option.label}</button>)}</div>
          </div>
          {visible.length ? <div className="divide-y divide-slate-100">{visible.map((alert) => <Link key={alert.id} to={`/cuentas/${alert.account.userId}`} className="flex flex-col gap-3 p-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:px-5"><SeverityBadge severity={alert.severity} /><div className="min-w-0 flex-1"><p className="font-extrabold text-slate-950">{alert.title}</p><p className="mt-1 text-sm font-medium leading-6 text-slate-600">{alert.detail}</p></div><div className="sm:text-right"><p className="font-bold text-slate-800">{alert.account.displayName || 'Cuenta sin nombre'}</p><p className="mt-1 text-xs font-semibold text-brand-700">Abrir expediente</p></div></Link>)}</div> : <div className="p-5"><EmptyPanel title="No hay alertas en este filtro" description="Selecciona otro estado para revisar la bandeja." /></div>}
        </section>
      )}
    </div>
  )
}

function priority(severity) {
  return severity === 'critical' ? 0 : 1
}

export default AdminAlertsPage

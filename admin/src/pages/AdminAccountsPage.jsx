import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAdminData } from '../AdminDataContext'
import { accessLabels, accountIdentifier, deriveAccountHealth, deriveAdoption, planLabels } from '../adminAccounts'
import { AccessBadge, EmptyPanel, ErrorPanel, HealthBadge, LoadingPanel, PageHeading, formatAdminDate } from '../components/AdminUi'

const PAGE_SIZE = 10
const healthFilters = [
  { id: 'all', label: 'Todas' },
  { id: 'critical', label: 'Críticas' },
  { id: 'attention', label: 'Atención' },
  { id: 'healthy', label: 'Saludables' },
  { id: 'new', label: 'Nuevas' },
  { id: 'closed', label: 'Cerradas' },
]

function AdminAccountsPage() {
  const { customerAccounts, isLoading, error, reload } = useAdminData()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilter = normalizeFilter(searchParams.get('estado'))
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(initialFilter)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es')
    return customerAccounts.filter((account) => {
      const health = deriveAccountHealth(account)
      if (filter !== 'all' && health.id !== filter) return false
      if (!needle) return true
      return [account.displayName, account.email, accountIdentifier(account), accessLabels[account.accessStatus], planLabels[account.servicePlan], health.label]
        .some((value) => String(value ?? '').toLocaleLowerCase('es').includes(needle))
    })
  }, [customerAccounts, filter, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [filter, query])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  function changeFilter(nextFilter) {
    setFilter(nextFilter)
    setSearchParams(nextFilter === 'all' ? {} : { estado: nextFilter }, { replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Directorio" title="Cuentas" description="Busca, filtra y abre el expediente de una cuenta. Los cambios sensibles se realizan únicamente dentro de su detalle." />
      {error && <ErrorPanel message={error} onRetry={reload} />}

      <section className="rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
        <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5">
          <label className="relative block max-w-2xl"><span className="sr-only">Buscar cuenta</span><Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="sale-input pl-11" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar negocio, usuario, plan o estado" /></label>
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar por salud">
            {healthFilters.map((option) => {
              const count = option.id === 'all' ? customerAccounts.length : customerAccounts.filter((account) => deriveAccountHealth(account).id === option.id).length
              return <button key={option.id} type="button" onClick={() => changeFilter(option.id)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-extrabold ${filter === option.id ? 'bg-brand-950 text-white' : 'bg-slate-100 text-slate-700 hover:bg-brand-50'}`}>{option.label} · {count}</button>
            })}
          </div>
        </div>

        {isLoading && customerAccounts.length === 0 ? <div className="p-5"><LoadingPanel /></div> : visible.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead><tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><th className="px-5 py-3 font-extrabold">Cuenta</th><th className="px-4 py-3 font-extrabold">Salud</th><th className="px-4 py-3 font-extrabold">Acceso</th><th className="px-4 py-3 font-extrabold">Plan</th><th className="px-4 py-3 font-extrabold">Adopción</th><th className="px-5 py-3 text-right font-extrabold"><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((account) => {
                    const health = deriveAccountHealth(account)
                    const adoption = deriveAdoption(account)
                    return <tr key={account.userId} className="hover:bg-slate-50"><td className="px-5 py-4"><p className="font-extrabold text-slate-950">{account.displayName || 'Cuenta sin nombre'}</p><p className="mt-0.5 text-xs font-semibold text-slate-500">{accountIdentifier(account)}</p></td><td className="px-4 py-4"><HealthBadge health={health} /><p className="mt-1 max-w-xs text-xs font-medium text-slate-500">{health.detail}</p></td><td className="px-4 py-4"><AccessBadge status={account.accessStatus} label={accessLabels[account.accessStatus]} /></td><td className="px-4 py-4 font-bold text-slate-700">{planLabels[account.servicePlan]}</td><td className="px-4 py-4"><p className="font-bold text-slate-700">{adoption.label}</p><p className="mt-1 text-xs font-medium text-slate-500">{formatAdminDate(account.lastSaleAt, 'Sin ventas')}</p></td><td className="px-5 py-4 text-right"><Link to={`/cuentas/${account.userId}`} className="inline-flex min-h-10 items-center rounded-xl px-3 font-extrabold text-brand-700 hover:bg-brand-50">Ver expediente</Link></td></tr>
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {visible.map((account) => {
                const health = deriveAccountHealth(account)
                return <Link key={account.userId} to={`/cuentas/${account.userId}`} className="block p-4 hover:bg-slate-50"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-extrabold text-slate-950">{account.displayName || 'Cuenta sin nombre'}</p><p className="mt-1 truncate text-xs font-semibold text-slate-500">{accountIdentifier(account)}</p></div><HealthBadge health={health} /></div><p className="mt-3 text-xs font-medium leading-5 text-slate-600">{health.detail}</p><div className="mt-3 flex items-center gap-2"><AccessBadge status={account.accessStatus} label={accessLabels[account.accessStatus]} /><span className="text-xs font-bold text-slate-500">{planLabels[account.servicePlan]}</span></div></Link>
              })}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-slate-500">Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}</p>
              <div className="flex items-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 font-extrabold text-slate-700 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={18} />Anterior</button><span className="px-2 text-xs font-extrabold text-slate-500">{page} / {totalPages}</span><button type="button" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 font-extrabold text-slate-700 hover:bg-slate-100 disabled:opacity-40">Siguiente<ChevronRight size={18} /></button></div>
            </div>
          </>
        ) : <div className="p-5"><EmptyPanel title="No encontramos cuentas" description="Cambia la búsqueda o el filtro de salud." /></div>}
      </section>
    </div>
  )
}

function normalizeFilter(value) {
  return healthFilters.some((option) => option.id === value) ? value : 'all'
}

export default AdminAccountsPage

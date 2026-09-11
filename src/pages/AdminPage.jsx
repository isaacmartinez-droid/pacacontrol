import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, BellRing, CheckCircle2, CircleAlert, LoaderCircle, RefreshCw, Save, Search, ShieldCheck, UsersRound } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabaseClient'
import { formatCurrency } from '../utils/currency'

const accessOptions = [
  { id: 'active', label: 'Activa' },
  { id: 'suspended', label: 'Suspendida' },
  { id: 'closed', label: 'Cerrada' },
]

const planOptions = [
  { id: 'pilot_free', label: 'Piloto gratis' },
  { id: 'paid_monthly', label: 'Mensualidad' },
  { id: 'demo', label: 'Demo' },
  { id: 'internal', label: 'Admin interno' },
]

const accessLabels = Object.fromEntries(accessOptions.map((option) => [option.id, option.label]))
const planLabels = Object.fromEntries(planOptions.map((option) => [option.id, option.label]))

function AdminPage() {
  const { isAdmin, profile } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [drafts, setDrafts] = useState({})
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [savingId, setSavingId] = useState('')
  const [message, setMessage] = useState(null)

  const loadAccounts = useCallback(async () => {
    if (!isAdmin) return
    setIsLoading(true)
    setMessage(null)
    try {
      const { data, error } = await getSupabaseClient().rpc('admin_list_accounts')
      if (error) throw error
      setAccounts((data ?? []).map(mapAccount))
      setDrafts({})
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No pudimos cargar las cuentas.' })
    } finally {
      setIsLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const summary = useMemo(() => ({
    total: accounts.length,
    active: accounts.filter((account) => account.accessStatus === 'active').length,
    suspended: accounts.filter((account) => account.accessStatus === 'suspended').length,
    paid: accounts.filter((account) => account.servicePlan === 'paid_monthly').length,
  }), [accounts])

  const adminNotifications = useMemo(() => {
    const suspended = accounts.filter((account) => account.accessStatus === 'suspended')
    const legalPending = accounts.filter((account) => !account.termsAcceptedAt || !account.privacyAcceptedAt)
    const pilots = accounts.filter((account) => account.servicePlan === 'pilot_free' && account.accessStatus === 'active')
    const withoutSales = accounts.filter((account) => account.servicePlan !== 'internal' && account.accessStatus === 'active' && account.salesCount === 0)

    return [
      {
        id: 'suspended',
        title: 'Cuentas suspendidas',
        count: suspended.length,
        description: 'Revisa pagos o reactivación pendiente.',
        tone: 'amber',
      },
      {
        id: 'legal',
        title: 'Legal pendiente',
        count: legalPending.length,
        description: 'Usuarios que todavía no aceptan términos o privacidad.',
        tone: 'coral',
      },
      {
        id: 'pilot',
        title: 'Pilotos gratis',
        count: pilots.length,
        description: 'Cuentas activas que aún no están en mensualidad.',
        tone: 'brand',
      },
      {
        id: 'empty',
        title: 'Sin ventas',
        count: withoutSales.length,
        description: 'Clientes activos que no han registrado ventas.',
        tone: 'slate',
      },
    ].filter((notice) => notice.count > 0)
  }, [accounts])

  const filteredAccounts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es')
    if (!needle) return accounts
    return accounts.filter((account) => [
      account.email,
      account.displayName,
      accessLabels[account.accessStatus],
      planLabels[account.servicePlan],
    ].some((value) => String(value ?? '').toLocaleLowerCase('es').includes(needle)))
  }, [accounts, query])

  function getDraft(account) {
    return drafts[account.userId] ?? {
      accessStatus: account.accessStatus,
      servicePlan: account.servicePlan,
    }
  }

  function updateDraft(accountId, field, value) {
    setDrafts((current) => {
      const account = accounts.find((item) => item.userId === accountId)
      const base = current[accountId] ?? {
        accessStatus: account?.accessStatus ?? 'active',
        servicePlan: account?.servicePlan ?? 'pilot_free',
      }
      return { ...current, [accountId]: { ...base, [field]: value } }
    })
    setMessage(null)
  }

  async function saveAccount(account) {
    const draft = getDraft(account)
    setSavingId(account.userId)
    setMessage(null)
    try {
      const { data, error } = await getSupabaseClient().rpc('admin_update_account', {
        p_user_id: account.userId,
        p_access_status: draft.accessStatus,
        p_service_plan: draft.servicePlan,
      })
      if (error) throw error
      const updated = mapAccount(data?.[0] ?? account)
      setAccounts((current) => current.map((item) => item.userId === updated.userId ? updated : item))
      setDrafts((current) => {
        const next = { ...current }
        delete next[account.userId]
        return next
      })
      setMessage({ type: 'success', text: `Cuenta actualizada: ${updated.email || updated.displayName || 'usuario'}.` })
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No pudimos actualizar la cuenta.' })
    } finally {
      setSavingId('')
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader eyebrow="Administración" title="Panel admin" description="Gestión interna de cuentas." backTo="/mas" />
        <div className="page-content py-6">
          <div role="alert" className="max-w-xl rounded-3xl bg-white p-6 shadow-soft ring-1 ring-amber-100">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                <ShieldCheck size={22} />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-slate-950">Acceso administrador requerido</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Tu cuenta debe tener el plan interno para entrar a este panel. Actívalo primero desde Supabase SQL Editor.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Panel admin"
        description="Controla clientes, planes y accesos del sistema."
        backTo="/mas"
      />
      <div className="page-content space-y-6 py-5 md:py-8">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Cuentas" value={summary.total} icon={UsersRound} tone="brand" />
          <Metric title="Activas" value={summary.active} icon={CheckCircle2} tone="emerald" />
          <Metric title="Suspendidas" value={summary.suspended} icon={Ban} tone="amber" />
          <Metric title="Mensualidad" value={summary.paid} icon={ShieldCheck} tone="coral" />
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <BellRing size={22} />
            </span>
            <div>
              <h2 className="font-extrabold text-slate-950">Notificaciones administrativas</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Señales rápidas para saber qué cuentas necesitan atención.
              </p>
            </div>
          </div>
          {adminNotifications.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {adminNotifications.map((notice) => <AdminNotice key={notice.id} notice={notice} />)}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
              Todo está al día por ahora.
            </p>
          )}
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block max-w-xl flex-1">
              <span className="sr-only">Buscar cuenta</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por correo, nombre, plan o estado"
                className="sale-input pl-11"
              />
            </label>
            <button
              type="button"
              onClick={loadAccounts}
              disabled={isLoading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {isLoading ? <LoaderCircle className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Actualizar
            </button>
          </div>

          {message && (
            <p role="status" className={`mt-4 flex items-start gap-2 rounded-2xl p-3 text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
              {message.type === 'success' ? <CheckCircle2 className="shrink-0" size={18} /> : <CircleAlert className="shrink-0" size={18} />}
              {message.text}
            </p>
          )}
        </section>

        {isLoading && accounts.length === 0 ? (
          <div className="grid min-h-40 place-items-center rounded-3xl bg-white text-sm font-bold text-brand-800 shadow-soft ring-1 ring-slate-100">
            <LoaderCircle className="mr-2 inline animate-spin" size={18} /> Cargando cuentas…
          </div>
        ) : (
          <section className="space-y-4">
            {filteredAccounts.map((account) => {
              const draft = getDraft(account)
              const hasChanges = draft.accessStatus !== account.accessStatus || draft.servicePlan !== account.servicePlan
              const isSelf = account.userId === profile?.id
              const selfLockout = isSelf && (draft.accessStatus !== 'active' || draft.servicePlan !== 'internal')

              return (
                <article key={account.userId} className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100 sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-extrabold text-slate-950">{account.displayName || account.email || 'Cuenta sin nombre'}</h2>
                        {isSelf && <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-extrabold text-brand-800">Tu cuenta</span>}
                        <StatusBadge status={account.accessStatus} />
                      </div>
                      <p className="mt-1 break-all text-sm font-semibold text-slate-500">{account.email || 'Sin correo visible'}</p>

                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
                        <Info label="Plan" value={planLabels[account.servicePlan] ?? account.servicePlan} />
                        <Info label="Legal" value={account.termsAcceptedAt && account.privacyAcceptedAt ? 'Aceptado' : 'Pendiente'} />
                        <Info label="Pacas" value={account.balesCount} />
                        <Info label="Ventas" value={account.salesCount} />
                        <Info label="Total vendido" value={formatCurrency(account.salesTotal)} />
                      </dl>
                      <p className="mt-3 text-xs text-slate-500">
                        Creada: {formatAdminDate(account.createdAt)} · Última venta: {account.lastSaleAt ? formatAdminDate(account.lastSaleAt) : 'Sin ventas'}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:min-w-[32rem]">
                      <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                        Estado
                        <select value={draft.accessStatus} onChange={(event) => updateDraft(account.userId, 'accessStatus', event.target.value)} className="sale-input mt-2 normal-case">
                          {accessOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                        Plan
                        <select value={draft.servicePlan} onChange={(event) => updateDraft(account.userId, 'servicePlan', event.target.value)} className="sale-input mt-2 normal-case">
                          {planOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={!hasChanges || selfLockout || Boolean(savingId)}
                        onClick={() => saveAccount(account)}
                        className="inline-flex min-h-12 items-center justify-center gap-2 self-end rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white disabled:opacity-50"
                        title={selfLockout ? 'No puedes quitarte tu propio acceso administrador.' : undefined}
                      >
                        {savingId === account.userId ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}
                        Guardar
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}

            {!filteredAccounts.length && (
              <div className="rounded-3xl bg-white p-6 text-center text-sm font-semibold text-slate-500 shadow-soft ring-1 ring-slate-100">
                No encontramos cuentas con esa búsqueda.
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function mapAccount(row) {
  return {
    userId: row.user_id ?? row.userId,
    email: row.email ?? '',
    displayName: row.display_name ?? row.displayName ?? '',
    accessStatus: row.access_status ?? row.accessStatus ?? 'active',
    servicePlan: row.service_plan ?? row.servicePlan ?? 'pilot_free',
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    termsAcceptedAt: row.terms_accepted_at ?? row.termsAcceptedAt,
    privacyAcceptedAt: row.privacy_accepted_at ?? row.privacyAcceptedAt,
    balesCount: Number(row.bales_count ?? row.balesCount ?? 0),
    salesCount: Number(row.sales_count ?? row.salesCount ?? 0),
    customersCount: Number(row.customers_count ?? row.customersCount ?? 0),
    salesTotal: Number(row.sales_total ?? row.salesTotal ?? 0),
    lastSaleAt: row.last_sale_at ?? row.lastSaleAt,
  }
}

function Metric({ title, value, icon: Icon, tone }) {
  const toneClasses = {
    brand: 'bg-brand-50 text-brand-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    coral: 'bg-coral-50 text-coral-600',
  }

  return (
    <article className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-950">{value}</p>
        </div>
        <span className={`grid size-12 place-items-center rounded-2xl ${toneClasses[tone]}`}>
          <Icon size={23} />
        </span>
      </div>
    </article>
  )
}

function AdminNotice({ notice }) {
  const classes = {
    brand: 'bg-brand-50 text-brand-800',
    amber: 'bg-amber-50 text-amber-800',
    coral: 'bg-coral-50 text-coral-700',
    slate: 'bg-slate-100 text-slate-700',
  }

  return (
    <article className={`rounded-2xl p-4 ${classes[notice.tone] ?? classes.slate}`}>
      <p className="text-3xl font-extrabold">{notice.count}</p>
      <h3 className="mt-1 text-sm font-extrabold">{notice.title}</h3>
      <p className="mt-1 text-xs font-semibold leading-5 opacity-80">{notice.description}</p>
    </article>
  )
}

function StatusBadge({ status }) {
  const classes = {
    active: 'bg-emerald-50 text-emerald-700',
    suspended: 'bg-amber-50 text-amber-700',
    closed: 'bg-slate-100 text-slate-600',
  }
  return <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${classes[status] ?? classes.closed}`}>{accessLabels[status] ?? status}</span>
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <dt className="text-xs font-bold text-slate-500">{label}</dt>
      <dd className="mt-1 truncate font-extrabold text-slate-900">{value}</dd>
    </div>
  )
}

function formatAdminDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-NI', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default AdminPage

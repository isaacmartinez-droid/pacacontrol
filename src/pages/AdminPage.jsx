import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, BellRing, CheckCircle2, CircleAlert, LoaderCircle, LogOut, RefreshCw, Save, Search, ShieldCheck, UsersRound } from 'lucide-react'
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
]

const suspensionReasonOptions = [
  { id: '', label: 'Sin motivo' },
  { id: 'payment_overdue', label: 'Pago pendiente' },
  { id: 'trial_expired', label: 'Prueba vencida' },
  { id: 'terms_issue', label: 'Tema legal' },
  { id: 'support_review', label: 'Revisión soporte' },
  { id: 'customer_request', label: 'Solicitud del cliente' },
  { id: 'other', label: 'Otro' },
]

const accessLabels = Object.fromEntries(accessOptions.map((option) => [option.id, option.label]))
const planLabels = {
  ...Object.fromEntries(planOptions.map((option) => [option.id, option.label])),
  internal: 'Admin interno',
}
const roleLabels = {
  owner: 'Cliente',
  admin: 'Admin interno',
}
const suspensionReasonLabels = Object.fromEntries(suspensionReasonOptions.map((option) => [option.id, option.label]))

function AdminPage() {
  const { isAdmin, profile, signOut } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [drafts, setDrafts] = useState({})
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('attention')
  const [isLoading, setIsLoading] = useState(false)
  const [savingId, setSavingId] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)
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

  const customerAccounts = useMemo(
    () => accounts.filter((account) => !isInternalAccount(account)),
    [accounts],
  )

  const internalAccounts = useMemo(
    () => accounts.filter((account) => isInternalAccount(account)),
    [accounts],
  )

  const summary = useMemo(() => ({
    total: customerAccounts.length,
    active: customerAccounts.filter((account) => account.accessStatus === 'active').length,
    suspended: customerAccounts.filter((account) => account.accessStatus === 'suspended').length,
    paid: customerAccounts.filter((account) => account.servicePlan === 'paid_monthly').length,
  }), [customerAccounts])

  const adminNotifications = useMemo(() => {
    const now = Date.now()
    const threeDays = 3 * 24 * 60 * 60 * 1000
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    const suspended = customerAccounts.filter((account) => account.accessStatus === 'suspended')
    const legalPending = customerAccounts.filter((account) => !account.termsAcceptedAt || !account.privacyAcceptedAt)
    const pilots = customerAccounts.filter((account) => account.servicePlan === 'pilot_free' && account.accessStatus === 'active')
    const withoutSales = customerAccounts.filter((account) => account.accessStatus === 'active' && account.salesCount === 0)
    const paymentDue = customerAccounts.filter((account) => {
      if (!account.nextPaymentDueAt || account.accessStatus !== 'active') return false
      return new Date(account.nextPaymentDueAt).getTime() <= now + threeDays
    })
    const trialsEnding = customerAccounts.filter((account) => {
      if (!account.trialEndsAt || account.accessStatus !== 'active') return false
      return new Date(account.trialEndsAt).getTime() <= now + sevenDays
    })

    return [
      {
        id: 'suspended',
        filter: 'suspended',
        title: 'Suspendidas',
        count: suspended.length,
        description: 'Cuentas con acceso pausado.',
        tone: 'amber',
      },
      {
        id: 'payment_due',
        filter: 'payment_due',
        title: 'Pago por revisar',
        count: paymentDue.length,
        description: 'Vencidas o por vencer en 3 días.',
        tone: 'coral',
      },
      {
        id: 'trial',
        filter: 'trial',
        title: 'Prueba por vencer',
        count: trialsEnding.length,
        description: 'Pilotos que vencen en 7 días.',
        tone: 'brand',
      },
      {
        id: 'legal',
        filter: 'legal',
        title: 'Legal pendiente',
        count: legalPending.length,
        description: 'Falta aceptar términos o privacidad.',
        tone: 'coral',
      },
      {
        id: 'pilot',
        filter: 'pilot',
        title: 'Pilotos gratis',
        count: pilots.length,
        description: 'Activas que aún no pagan mensualidad.',
        tone: 'brand',
      },
      {
        id: 'empty',
        filter: 'empty',
        title: 'Sin ventas',
        count: withoutSales.length,
        description: 'Cuentas activas sin operación registrada.',
        tone: 'slate',
      },
    ].filter((notice) => notice.count > 0)
  }, [customerAccounts])

  const filterOptions = useMemo(() => [
    { id: 'attention', label: 'Necesitan atención', count: customerAccounts.filter(accountNeedsAttention).length },
    { id: 'all', label: 'Todos los clientes', count: customerAccounts.length },
    { id: 'active', label: 'Activas', count: customerAccounts.filter((account) => account.accessStatus === 'active').length },
    { id: 'suspended', label: 'Suspendidas', count: customerAccounts.filter((account) => account.accessStatus === 'suspended').length },
    { id: 'payment_due', label: 'Pago por revisar', count: customerAccounts.filter((account) => matchesFilter(account, 'payment_due')).length },
    { id: 'trial', label: 'Prueba por vencer', count: customerAccounts.filter((account) => matchesFilter(account, 'trial')).length },
    { id: 'paid', label: 'Mensualidad', count: customerAccounts.filter((account) => account.servicePlan === 'paid_monthly').length },
    { id: 'pilot', label: 'Pilotos', count: customerAccounts.filter((account) => account.servicePlan === 'pilot_free').length },
    { id: 'legal', label: 'Legal pendiente', count: customerAccounts.filter((account) => !account.termsAcceptedAt || !account.privacyAcceptedAt).length },
    { id: 'empty', label: 'Sin ventas', count: customerAccounts.filter((account) => account.accessStatus === 'active' && account.salesCount === 0).length },
  ], [customerAccounts])

  const filteredAccounts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es')
    return customerAccounts
      .filter((account) => matchesFilter(account, activeFilter))
      .filter((account) => {
        if (!needle) return true
        return [
          account.email,
          account.displayName,
          accessLabels[account.accessStatus],
          planLabels[account.servicePlan],
          suspensionReasonLabels[account.suspensionReason],
          account.adminNotes,
        ].some((value) => String(value ?? '').toLocaleLowerCase('es').includes(needle))
      })
  }, [activeFilter, customerAccounts, query])

  function getDraft(account) {
    return drafts[account.userId] ?? createDraft(account)
  }

  function updateDraft(accountId, field, value) {
    setDrafts((current) => {
      const account = accounts.find((item) => item.userId === accountId)
      const base = current[accountId] ?? createDraft(account)
      return { ...current, [accountId]: { ...base, [field]: value } }
    })
    setMessage(null)
  }

  async function saveAccount(account) {
    const draft = getDraft(account)
    setSavingId(account.userId)
    setMessage(null)
    try {
      const client = getSupabaseClient()
      let { data, error } = await client.rpc('admin_update_account', {
        p_user_id: account.userId,
        p_access_status: draft.accessStatus,
        p_service_plan: draft.servicePlan,
        p_account_role: draft.accountRole,
        p_suspension_reason: draft.suspensionReason || null,
        p_admin_notes: draft.adminNotes || null,
        p_trial_ends_at: fromDateTimeInput(draft.trialEndsAt),
        p_next_payment_due_at: fromDateTimeInput(draft.nextPaymentDueAt),
      })
      if (isLegacyAdminRpcError(error)) {
        ;({ data, error } = await client.rpc('admin_update_account', {
          p_user_id: account.userId,
          p_access_status: draft.accessStatus,
          p_service_plan: draft.servicePlan,
        }))
      }
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

  async function handleSignOut() {
    setIsSigningOut(true)
    setMessage(null)
    try {
      await signOut()
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No pudimos cerrar la sesión.' })
      setIsSigningOut(false)
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <AdminHeader title="Panel admin" description="Consola separada para monitoreo interno." />
        <div className="page-content py-6">
          <div role="alert" className="max-w-xl rounded-3xl bg-white p-6 shadow-soft ring-1 ring-amber-100">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                <ShieldCheck size={22} />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-slate-950">Acceso administrador requerido</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Esta consola solo está disponible para cuentas internas de administración.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-950 px-4 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {isSigningOut ? <LoaderCircle className="animate-spin" size={18} /> : <LogOut size={18} />}
              Cerrar sesión
            </button>
            {message && (
              <p role="status" className="mt-4 flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
                <CircleAlert className="shrink-0" size={18} />
                {message.text}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <AdminHeader title="Panel admin" description="Consola separada para monitorear clientes, planes, pagos y accesos." />
      <div className="page-content space-y-6 py-5 md:py-8">
        <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-brand-700">Modo administración</p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-950">{profile?.display_name || 'Administrador'}</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Tu perfil interno queda separado de los clientes. Aquí controlas acceso, vencimientos, notas y señales generales.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-950 px-4 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {isSigningOut ? <LoaderCircle className="animate-spin" size={18} /> : <LogOut size={18} />}
            Cerrar sesión
          </button>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Clientes" value={summary.total} icon={UsersRound} tone="brand" />
          <Metric title="Activos" value={summary.active} icon={CheckCircle2} tone="emerald" />
          <Metric title="Suspendidos" value={summary.suspended} icon={Ban} tone="amber" />
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
                Señales rápidas. Puedes presionar una tarjeta para filtrar las cuentas relacionadas.
              </p>
            </div>
          </div>
          {adminNotifications.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {adminNotifications.map((notice) => (
                <AdminNotice key={notice.id} notice={notice} onClick={() => setActiveFilter(notice.filter)} />
              ))}
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
                placeholder="Buscar por correo, nombre, plan, estado o nota"
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

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveFilter(option.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold transition ${
                  activeFilter === option.id
                    ? 'bg-brand-950 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-800'
                }`}
              >
                {option.label} · {option.count}
              </button>
            ))}
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
          <>
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-950">Clientes administrados</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {filteredAccounts.length} de {customerAccounts.length} clientes visibles con el filtro actual.
                </p>
              </div>

              {filteredAccounts.map((account) => {
                const draft = getDraft(account)
                const hasChanges = accountHasChanges(account, draft)
                const isSelf = account.userId === profile?.id
                const selfLockout = isSelf && (draft.accessStatus !== 'active' || draft.accountRole !== 'admin')

                return (
                  <AccountCard
                    key={account.userId}
                    account={account}
                    draft={draft}
                    hasChanges={hasChanges}
                    isSaving={savingId === account.userId}
                    isSaveBlocked={selfLockout || Boolean(savingId)}
                    onChange={(field, value) => updateDraft(account.userId, field, value)}
                    onSave={() => saveAccount(account)}
                  />
                )
              })}

              {!filteredAccounts.length && (
                <div className="rounded-3xl bg-white p-6 text-center text-sm font-semibold text-slate-500 shadow-soft ring-1 ring-slate-100">
                  No encontramos clientes con ese filtro o búsqueda.
                </div>
              )}
            </section>

            <section className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-950">Administradores internos</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Estas cuentas no cuentan como clientes ni aparecen mezcladas con la operación de tiendas.
                  </p>
                </div>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-extrabold text-brand-800">
                  {internalAccounts.length} internas
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {internalAccounts.map((account) => (
                  <article key={account.userId} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-slate-950">{account.displayName || account.email || 'Admin sin nombre'}</h3>
                      {account.userId === profile?.id && <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-brand-800">Tu cuenta</span>}
                      <StatusBadge status={account.accessStatus} />
                    </div>
                    <p className="mt-1 break-all text-sm font-semibold text-slate-500">{account.email || 'Sin correo visible'}</p>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <Info label="Rol" value={roleLabels[account.accountRole] ?? account.accountRole} />
                      <Info label="Plan histórico" value={planLabels[account.servicePlan] ?? account.servicePlan} />
                      <Info label="Última acción" value={account.latestAdminEvent ? eventLabels[account.latestAdminEvent] ?? account.latestAdminEvent : 'Sin eventos'} />
                    </dl>
                  </article>
                ))}
                {!internalAccounts.length && (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    No hay cuentas internas registradas todavía.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function AccountCard({ account, draft, hasChanges, isSaving, isSaveBlocked, onChange, onSave }) {
  const disabled = !hasChanges || isSaveBlocked
  const missingSuspensionReason = draft.accessStatus === 'suspended' && !draft.suspensionReason

  return (
    <article className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100 sm:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-extrabold text-slate-950">{account.displayName || account.email || 'Cuenta sin nombre'}</h3>
            <StatusBadge status={account.accessStatus} />
            {accountNeedsAttention(account) && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700">Revisar</span>}
          </div>
          <p className="mt-1 break-all text-sm font-semibold text-slate-500">{account.email || 'Sin correo visible'}</p>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
            <Info label="Plan" value={planLabels[account.servicePlan] ?? account.servicePlan} />
            <Info label="Legal" value={account.termsAcceptedAt && account.privacyAcceptedAt ? 'Aceptado' : 'Pendiente'} />
            <Info label="Pacas" value={account.balesCount} />
            <Info label="Ventas" value={account.salesCount} />
            <Info label="Total vendido" value={formatCurrency(account.salesTotal)} />
          </dl>

          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <Info label="Prueba vence" value={formatAdminDate(account.trialEndsAt, 'Sin fecha')} />
            <Info label="Próximo pago" value={formatAdminDate(account.nextPaymentDueAt, 'Sin fecha')} />
            <Info label="Motivo" value={account.suspensionReason ? suspensionReasonLabels[account.suspensionReason] ?? account.suspensionReason : 'Sin motivo'} />
            <Info label="Última acción" value={account.latestAdminEvent ? eventLabels[account.latestAdminEvent] ?? account.latestAdminEvent : 'Sin eventos'} />
          </dl>

          <p className="mt-3 text-xs text-slate-500">
            Creada: {formatAdminDate(account.createdAt)} · Última venta: {account.lastSaleAt ? formatAdminDate(account.lastSaleAt) : 'Sin ventas'}
          </p>
          {account.adminNotes && (
            <p className="mt-3 rounded-2xl bg-brand-50 p-3 text-sm font-semibold leading-6 text-brand-900">
              Nota interna: {account.adminNotes}
            </p>
          )}
        </div>

        <div className="grid gap-3 xl:min-w-[34rem]">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              Estado
              <select value={draft.accessStatus} onChange={(event) => onChange('accessStatus', event.target.value)} className="sale-input mt-2 normal-case">
                {accessOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              Plan
              <select value={draft.servicePlan} onChange={(event) => onChange('servicePlan', event.target.value)} className="sale-input mt-2 normal-case">
                {planOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              Fin de prueba
              <input
                type="datetime-local"
                value={draft.trialEndsAt}
                onChange={(event) => onChange('trialEndsAt', event.target.value)}
                className="sale-input mt-2 normal-case"
              />
            </label>
            <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              Próximo pago
              <input
                type="datetime-local"
                value={draft.nextPaymentDueAt}
                onChange={(event) => onChange('nextPaymentDueAt', event.target.value)}
                className="sale-input mt-2 normal-case"
              />
            </label>
          </div>

          <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Motivo administrativo
            <select value={draft.suspensionReason} onChange={(event) => onChange('suspensionReason', event.target.value)} className="sale-input mt-2 normal-case">
              {suspensionReasonOptions.map((option) => <option key={option.id || 'empty'} value={option.id}>{option.label}</option>)}
            </select>
          </label>

          {missingSuspensionReason && (
            <p className="rounded-2xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              Recomendación: agrega un motivo para que quede claro por qué la cuenta está suspendida.
            </p>
          )}

          <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Nota interna
            <textarea
              value={draft.adminNotes}
              onChange={(event) => onChange('adminNotes', event.target.value)}
              rows={3}
              placeholder="Ej. Llamar el lunes, revisar comprobante, cliente pidió extensión..."
              className="sale-input mt-2 min-h-24 resize-y normal-case"
            />
          </label>

          <button
            type="button"
            disabled={disabled}
            onClick={onSave}
            className="inline-flex min-h-12 items-center justify-center gap-2 justify-self-end rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white disabled:bg-slate-400 disabled:opacity-70"
            title={!hasChanges ? 'No hay cambios por guardar.' : undefined}
          >
            {isSaving ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}
            Guardar cambios
          </button>
        </div>
      </div>
    </article>
  )
}

function mapAccount(row) {
  const servicePlan = row.service_plan ?? row.servicePlan ?? 'pilot_free'
  const accountRole = row.account_role ?? row.accountRole ?? (servicePlan === 'internal' ? 'admin' : 'owner')
  return {
    userId: row.user_id ?? row.userId,
    email: row.email ?? '',
    displayName: row.display_name ?? row.displayName ?? '',
    accountRole,
    accessStatus: row.access_status ?? row.accessStatus ?? 'active',
    servicePlan,
    suspensionReason: row.suspension_reason ?? row.suspensionReason ?? '',
    adminNotes: row.admin_notes ?? row.adminNotes ?? '',
    trialEndsAt: row.trial_ends_at ?? row.trialEndsAt ?? null,
    nextPaymentDueAt: row.next_payment_due_at ?? row.nextPaymentDueAt ?? null,
    lastAdminActionAt: row.last_admin_action_at ?? row.lastAdminActionAt ?? null,
    lastAdminActionBy: row.last_admin_action_by ?? row.lastAdminActionBy ?? null,
    latestAdminEvent: row.latest_admin_event ?? row.latestAdminEvent ?? '',
    latestAdminEventAt: row.latest_admin_event_at ?? row.latestAdminEventAt ?? null,
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

function createDraft(account = {}) {
  return {
    accountRole: account.accountRole ?? 'owner',
    accessStatus: account.accessStatus ?? 'active',
    servicePlan: account.servicePlan === 'internal' ? 'pilot_free' : account.servicePlan ?? 'pilot_free',
    suspensionReason: account.suspensionReason ?? '',
    adminNotes: account.adminNotes ?? '',
    trialEndsAt: toDateTimeInput(account.trialEndsAt),
    nextPaymentDueAt: toDateTimeInput(account.nextPaymentDueAt),
  }
}

function accountHasChanges(account, draft) {
  return [
    ['accountRole', account.accountRole ?? 'owner', draft.accountRole],
    ['accessStatus', account.accessStatus ?? 'active', draft.accessStatus],
    ['servicePlan', account.servicePlan === 'internal' ? 'pilot_free' : account.servicePlan ?? 'pilot_free', draft.servicePlan],
    ['suspensionReason', account.suspensionReason ?? '', draft.suspensionReason],
    ['adminNotes', account.adminNotes ?? '', draft.adminNotes],
    ['trialEndsAt', toDateTimeInput(account.trialEndsAt), draft.trialEndsAt],
    ['nextPaymentDueAt', toDateTimeInput(account.nextPaymentDueAt), draft.nextPaymentDueAt],
  ].some(([, current, next]) => String(current ?? '') !== String(next ?? ''))
}

function isInternalAccount(account) {
  return account.accountRole === 'admin' || account.servicePlan === 'internal'
}

function isLegacyAdminRpcError(error) {
  if (!error) return false
  const message = error.message ?? ''
  return error.code === 'PGRST202'
    || message.includes('admin_update_account')
    || message.includes('p_account_role')
    || message.includes('Could not find the function')
}

function accountNeedsAttention(account) {
  return matchesFilter(account, 'payment_due')
    || matchesFilter(account, 'trial')
    || matchesFilter(account, 'legal')
    || matchesFilter(account, 'empty')
    || account.accessStatus === 'suspended'
}

function matchesFilter(account, filter) {
  const now = Date.now()
  const threeDays = 3 * 24 * 60 * 60 * 1000
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  if (filter === 'all') return true
  if (filter === 'attention') return accountNeedsAttentionWithoutLoop(account)
  if (filter === 'active') return account.accessStatus === 'active'
  if (filter === 'suspended') return account.accessStatus === 'suspended'
  if (filter === 'paid') return account.servicePlan === 'paid_monthly'
  if (filter === 'pilot') return account.servicePlan === 'pilot_free'
  if (filter === 'legal') return !account.termsAcceptedAt || !account.privacyAcceptedAt
  if (filter === 'empty') return account.accessStatus === 'active' && account.salesCount === 0
  if (filter === 'payment_due') {
    if (!account.nextPaymentDueAt || account.accessStatus !== 'active') return false
    return new Date(account.nextPaymentDueAt).getTime() <= now + threeDays
  }
  if (filter === 'trial') {
    if (!account.trialEndsAt || account.accessStatus !== 'active') return false
    return new Date(account.trialEndsAt).getTime() <= now + sevenDays
  }
  return true
}

function accountNeedsAttentionWithoutLoop(account) {
  return account.accessStatus === 'suspended'
    || matchesFilter(account, 'payment_due')
    || matchesFilter(account, 'trial')
    || matchesFilter(account, 'legal')
    || matchesFilter(account, 'empty')
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

function AdminHeader({ title, description }) {
  return (
    <header className="relative overflow-hidden bg-brand-950 text-white">
      <div aria-hidden="true" className="absolute -right-12 -top-16 size-40 rounded-full border-[28px] border-white/5" />
      <div className="page-frame relative px-4 py-5 sm:px-5 md:px-8 xl:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-200">Administración</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white md:text-3xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-100">{description}</p>}
      </div>
    </header>
  )
}

function AdminNotice({ notice, onClick }) {
  const classes = {
    brand: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
    amber: 'bg-amber-50 text-amber-800 hover:bg-amber-100',
    coral: 'bg-coral-50 text-coral-700 hover:bg-coral-100',
    slate: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  }

  return (
    <button type="button" onClick={onClick} className={`rounded-2xl p-4 text-left transition ${classes[notice.tone] ?? classes.slate}`}>
      <p className="text-3xl font-extrabold">{notice.count}</p>
      <h3 className="mt-1 text-sm font-extrabold">{notice.title}</h3>
      <p className="mt-1 text-xs font-semibold leading-5 opacity-80">{notice.description}</p>
    </button>
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

const eventLabels = {
  updated: 'Actualizada',
  suspended: 'Suspendida',
  closed: 'Cerrada',
  reactivated: 'Reactivada',
  plan_changed: 'Plan cambiado',
  role_changed: 'Rol cambiado',
}

function formatAdminDate(value, fallback = '—') {
  if (!value) return fallback
  return new Intl.DateTimeFormat('es-NI', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function toDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function fromDateTimeInput(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export default AdminPage

import { ArrowLeft, CheckCircle2, CircleAlert, LoaderCircle, Save, ShieldAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatCurrency } from '../../../src/utils/currency'
import { useAdminData } from '../AdminDataContext'
import { accessLabels, accessOptions, accountDraftHasChanges, accountIdentifier, createAccountDraft, deriveAccountHealth, deriveAdoption, eventLabels, planLabels, planOptions, suspensionReasonLabels, suspensionReasonOptions } from '../adminAccounts'
import { AccessBadge, EmptyPanel, ErrorPanel, HealthBadge, InfoItem, LoadingPanel, PageHeading, formatAdminDate } from '../components/AdminUi'

function AdminAccountDetailPage() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const { customerAccounts, isLoading, error, reload, updateAccount } = useAdminData()
  const account = customerAccounts.find((item) => item.userId === accountId)
  const [draft, setDraft] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (account) setDraft(createAccountDraft(account))
  }, [account])

  const health = useMemo(() => account ? deriveAccountHealth(account) : null, [account])
  const adoption = useMemo(() => account ? deriveAdoption(account) : null, [account])
  const hasChanges = account && draft ? accountDraftHasChanges(account, draft) : false
  const needsReason = draft?.accessStatus === 'suspended' && !draft.suspensionReason

  if (isLoading && !account) return <LoadingPanel label="Abriendo expediente…" />
  if (error && !account) return <ErrorPanel message={error} onRetry={reload} />
  if (!account) return <EmptyPanel title="Cuenta no encontrada" description="Puede haber sido cerrada o no pertenecer a los clientes administrados." />
  if (!draft) return <LoadingPanel label="Preparando controles…" />

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
    setNotice(null)
  }

  async function save() {
    setConfirming(false)
    setIsSaving(true)
    setNotice(null)
    try {
      const updated = await updateAccount(account, draft)
      setDraft(createAccountDraft(updated))
      setNotice({ type: 'success', text: 'Los cambios quedaron guardados y registrados en la auditoría.' })
    } catch (nextError) {
      setNotice({ type: 'error', text: nextError?.message || 'No pudimos actualizar la cuenta.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate('/cuentas')} className="inline-flex min-h-10 items-center gap-2 rounded-xl text-sm font-extrabold text-brand-700 hover:text-brand-950"><ArrowLeft size={18} />Volver a cuentas</button>
      <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <PageHeading eyebrow="Expediente de cuenta" title={account.displayName || 'Cuenta sin nombre'} description={`Usuario: ${accountIdentifier(account)}`} />
          <div className="flex flex-wrap items-center gap-2"><HealthBadge health={health} /><AccessBadge status={account.accessStatus} label={accessLabels[account.accessStatus]} /></div>
        </div>
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700"><strong>Motivo de salud:</strong> {health.detail}</p>
      </div>

      {notice && <p role="status" className={`flex items-start gap-2 rounded-2xl p-4 text-sm font-bold ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{notice.type === 'success' ? <CheckCircle2 className="shrink-0" size={19} /> : <CircleAlert className="shrink-0" size={19} />}{notice.text}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
            <h2 className="text-lg font-extrabold text-slate-950">Resumen de uso</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Estos datos describen adopción, no determinan si el negocio es exitoso.</p>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem label="Adopción" value={adoption.label} />
              <InfoItem label="Compras o lotes" value={account.balesCount} />
              <InfoItem label="Ventas" value={account.salesCount} />
              <InfoItem label="Clientes registrados" value={account.customersCount} />
              <InfoItem label="Total vendido" value={formatCurrency(account.salesTotal)} />
              <InfoItem label="Última venta" value={formatAdminDate(account.lastSaleAt, 'Sin ventas')} />
            </dl>
            <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm font-semibold text-brand-900">{adoption.detail}</p>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
            <h2 className="text-lg font-extrabold text-slate-950">Cumplimiento</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-500">La información legal vive en el expediente y solo genera protagonismo cuando falta evidencia.</p>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoItem label="Términos" value={account.termsAcceptedAt ? 'Aceptados' : 'Pendientes'} />
              <InfoItem label="Versión de términos" value={account.legalTermsVersion || 'Sin versión'} />
              <InfoItem label="Fecha de aceptación" value={formatAdminDate(account.termsAcceptedAt, 'Sin aceptación')} />
              <InfoItem label="Privacidad" value={account.privacyAcceptedAt ? 'Aceptada' : 'Pendiente'} />
              <InfoItem label="Versión de privacidad" value={account.privacyVersion || 'Sin versión'} />
              <InfoItem label="Fecha de aceptación" value={formatAdminDate(account.privacyAcceptedAt, 'Sin aceptación')} />
            </dl>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
            <h2 className="text-lg font-extrabold text-slate-950">Auditoría administrativa</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoItem label="Cuenta creada" value={formatAdminDate(account.createdAt)} />
              <InfoItem label="Perfil actualizado" value={formatAdminDate(account.updatedAt)} />
              <InfoItem label="Último evento" value={account.latestAdminEvent ? eventLabels[account.latestAdminEvent] ?? account.latestAdminEvent : 'Sin eventos'} />
              <InfoItem label="Fecha del evento" value={formatAdminDate(account.latestAdminEventAt, 'Sin eventos')} />
            </dl>
          </section>
        </div>

        <section className="h-fit rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100 xl:sticky xl:top-24">
          <h2 className="text-lg font-extrabold text-slate-950">Control de la cuenta</h2>
          <p className="mt-1 text-sm font-medium leading-6 text-slate-500">Los cambios de acceso, plan o fechas quedan asociados al administrador.</p>
          <div className="mt-5 grid gap-4">
            <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Estado<select value={draft.accessStatus} onChange={(event) => updateDraft('accessStatus', event.target.value)} className="sale-input mt-2 normal-case">{accessOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Plan<select value={draft.servicePlan} onChange={(event) => updateDraft('servicePlan', event.target.value)} className="sale-input mt-2 normal-case">{planOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Fin de prueba<input type="datetime-local" value={draft.trialEndsAt} onChange={(event) => updateDraft('trialEndsAt', event.target.value)} className="sale-input mt-2 normal-case" /></label>
              <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Próximo pago<input type="datetime-local" value={draft.nextPaymentDueAt} onChange={(event) => updateDraft('nextPaymentDueAt', event.target.value)} className="sale-input mt-2 normal-case" /></label>
            </div>
            <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Motivo administrativo<select value={draft.suspensionReason} onChange={(event) => updateDraft('suspensionReason', event.target.value)} className="sale-input mt-2 normal-case">{suspensionReasonOptions.map((option) => <option key={option.id || 'empty'} value={option.id}>{option.label}</option>)}</select></label>
            {needsReason && <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">Debes seleccionar un motivo antes de suspender la cuenta.</p>}
            <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Nota interna<textarea value={draft.adminNotes} onChange={(event) => updateDraft('adminNotes', event.target.value)} rows={4} placeholder="Seguimiento, acuerdos o contexto para otros administradores" className="sale-input mt-2 min-h-28 resize-y normal-case" /></label>
            {account.suspensionReason && <p className="text-xs font-semibold text-slate-500">Motivo actual: {suspensionReasonLabels[account.suspensionReason] ?? account.suspensionReason}</p>}
            <button type="button" disabled={!hasChanges || needsReason || isSaving} onClick={() => setConfirming(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white disabled:bg-slate-300 disabled:text-slate-600"><Save size={18} />Guardar cambios</button>
          </div>
        </section>
      </div>

      {confirming && (
        <div role="presentation" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="confirm-account-change" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <span className="grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-800"><ShieldAlert size={23} /></span>
            <h2 id="confirm-account-change" className="mt-4 text-xl font-extrabold text-slate-950">Confirmar cambios administrativos</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">Vas a modificar el acceso o la administración de <strong>{account.displayName || accountIdentifier(account)}</strong>. La acción quedará registrada.</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-xl px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-100">Cancelar</button><button type="button" onClick={save} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-950 px-4 text-sm font-extrabold text-white">{isSaving && <LoaderCircle className="animate-spin" size={17} />}Confirmar y guardar</button></div>
          </section>
        </div>
      )}
    </div>
  )
}

export default AdminAccountDetailPage

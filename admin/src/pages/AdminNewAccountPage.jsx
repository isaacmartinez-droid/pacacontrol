import { Check, CircleAlert, Clipboard, KeyRound, LoaderCircle, Send, UserPlus, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSupabaseClient } from '../../../src/lib/supabaseClient'
import { LEGAL_TERMS_VERSION, PRIVACY_VERSION } from '../../../src/legal/legalContent'
import { EmptyPanel, PageHeading, formatAdminDate } from '../components/AdminUi'

const initialForm = {
  businessName: '', ownerName: '', username: '', contactEmail: '', contactPhone: '',
  servicePlan: 'pilot_free', trialDays: '30', expiresInDays: '7',
}

function AdminNewAccountPage() {
  const [form, setForm] = useState(initialForm)
  const [invitations, setInvitations] = useState([])
  const [created, setCreated] = useState(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const customerAppUrl = String(import.meta.env.VITE_CUSTOMER_APP_URL ?? '').replace(/\/$/, '')
  const activationUrl = useMemo(() => created && customerAppUrl
    ? `${customerAppUrl}/activar?token=${encodeURIComponent(created.invitation_token)}` : '', [created, customerAppUrl])

  async function loadInvitations() {
    setIsLoading(true)
    const { data, error: nextError } = await getSupabaseClient().rpc('admin_list_account_invitations')
    if (nextError) setError(nextError.message)
    else setInvitations(data ?? [])
    setIsLoading(false)
  }

  useEffect(() => { loadInvitations() }, [])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setCreated(null)
    setIsSubmitting(true)
    try {
      if (!customerAppUrl) throw new Error('Falta configurar VITE_CUSTOMER_APP_URL en el portal administrativo.')
      const { data, error: nextError } = await getSupabaseClient().rpc('admin_create_account_invitation', {
        p_business_name: form.businessName,
        p_owner_name: form.ownerName,
        p_username: normalizeUsername(form.username),
        p_contact_email: form.contactEmail || null,
        p_contact_phone: form.contactPhone || null,
        p_service_plan: form.servicePlan,
        p_trial_days: Number(form.trialDays),
        p_expires_in_days: Number(form.expiresInDays),
        p_legal_terms_version: LEGAL_TERMS_VERSION,
        p_privacy_version: PRIVACY_VERSION,
      })
      if (nextError) throw nextError
      setCreated(data?.[0] ?? null)
      setForm(initialForm)
      await loadInvitations()
    } catch (nextError) {
      setError(nextError?.message || 'No pudimos crear la invitación.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(activationUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function revoke(invitationId) {
    setError('')
    const { data, error: nextError } = await getSupabaseClient().rpc('admin_revoke_account_invitation', { p_invitation_id: invitationId })
    if (nextError) setError(nextError.message)
    else if (data) await loadInvitations()
  }

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Altas controladas" title="Crear cuenta" description="Prepara una invitación de un solo uso. El cliente establece su propia contraseña y entra como propietario, nunca como administrador." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
        <form onSubmit={submit} className="space-y-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del negocio"><input className="sale-input mt-2" value={form.businessName} required maxLength="120" onChange={(event) => update('businessName', event.target.value)} /></Field>
            <Field label="Persona responsable"><input className="sale-input mt-2" value={form.ownerName} required maxLength="120" onChange={(event) => update('ownerName', event.target.value)} /></Field>
          </div>
          <Field label="Usuario de acceso" help="Formato nombre.apellido; se convierte automáticamente a minúsculas y sin tildes.">
            <input className="sale-input mt-2" value={form.username} required placeholder="miguel.martinez" onChange={(event) => update('username', event.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Correo de contacto (opcional)"><input className="sale-input mt-2" type="email" value={form.contactEmail} maxLength="254" onChange={(event) => update('contactEmail', event.target.value)} /></Field>
            <Field label="Teléfono / WhatsApp (opcional)"><input className="sale-input mt-2" value={form.contactPhone} maxLength="30" onChange={(event) => update('contactPhone', event.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Plan inicial"><select className="sale-input mt-2" value={form.servicePlan} onChange={(event) => update('servicePlan', event.target.value)}><option value="pilot_free">Piloto gratuito</option><option value="paid_monthly">Mensual</option><option value="demo">Demostración</option></select></Field>
            <Field label="Días de prueba"><input className="sale-input mt-2" type="number" min="0" max="365" value={form.trialDays} required onChange={(event) => update('trialDays', event.target.value)} /></Field>
            <Field label="Invitación vence en"><select className="sale-input mt-2" value={form.expiresInDays} onChange={(event) => update('expiresInDays', event.target.value)}><option value="1">1 día</option><option value="3">3 días</option><option value="7">7 días</option><option value="14">14 días</option><option value="30">30 días</option></select></Field>
          </div>

          {error && <p role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700"><CircleAlert className="shrink-0" size={18} />{error}</p>}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/cuentas" className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-extrabold text-slate-600 hover:bg-slate-100">Volver a cuentas</Link>
            <button disabled={isSubmitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-950 px-5 font-extrabold text-white hover:bg-brand-900 disabled:opacity-60">{isSubmitting ? <LoaderCircle className="animate-spin" size={18} /> : <UserPlus size={18} />}Crear invitación</button>
          </div>
        </form>

        <aside className="space-y-4">
          <section className={`rounded-2xl p-5 shadow-soft ring-1 ${created ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-slate-100'}`}>
            {created ? <>
              <span className="grid size-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><KeyRound size={21} /></span>
              <h2 className="mt-4 text-lg font-extrabold text-slate-950">Invitación creada</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Copia este enlace ahora. Por seguridad, el token completo no volverá a mostrarse.</p>
              <div className="mt-4 break-all rounded-xl bg-white p-3 text-xs font-bold text-slate-700 ring-1 ring-emerald-200">{activationUrl}</div>
              <button type="button" onClick={copyLink} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-extrabold text-white hover:bg-emerald-800">{copied ? <Check size={18} /> : <Clipboard size={18} />}{copied ? 'Enlace copiado' : 'Copiar enlace de activación'}</button>
              <p className="mt-3 text-xs font-bold text-emerald-800">Usuario: {created.username} · vence {formatAdminDate(created.expires_at)}</p>
            </> : <EmptyPanel title="El enlace aparecerá aquí" description="Compártelo directamente con la persona responsable por un canal confiable." />}
          </section>
          <section className="rounded-2xl bg-brand-50 p-5 text-sm leading-6 text-brand-950 ring-1 ring-brand-100">
            <p className="flex items-center gap-2 font-extrabold"><Send size={17} />Qué ocurre después</p>
            <p className="mt-2">El cliente abre el enlace, acepta los documentos vigentes y crea su contraseña. La cuenta queda activa y empieza en el asistente de configuración del negocio.</p>
          </section>
        </aside>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
        <h2 className="text-lg font-extrabold text-slate-950">Invitaciones recientes</h2>
        {isLoading ? <p className="mt-4 text-sm font-bold text-slate-500">Cargando invitaciones…</p> : invitations.length ? (
          <div className="mt-4 divide-y divide-slate-100">
            {invitations.map((invitation) => <div key={invitation.invitation_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-extrabold text-slate-950">{invitation.business_name}</p><p className="mt-1 text-xs font-semibold text-slate-500">{invitation.username} · código termina en {invitation.code_hint} · vence {formatAdminDate(invitation.expires_at)}</p></div><div className="flex items-center gap-3"><InvitationStatus status={invitation.status} />{['pending', 'processing'].includes(invitation.status) && <button type="button" onClick={() => revoke(invitation.invitation_id)} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-extrabold text-red-700 hover:bg-red-50"><XCircle size={17} />Revocar</button>}</div></div>)}
          </div>
        ) : <div className="mt-4"><EmptyPanel title="Todavía no hay invitaciones" description="La primera aparecerá después de crearla." /></div>}
      </section>
    </div>
  )
}

function Field({ label, help, children }) {
  return <label className="block text-sm font-extrabold text-slate-700">{label}{children}{help && <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">{help}</span>}</label>
}

function InvitationStatus({ status }) {
  const labels = { pending: 'Pendiente', processing: 'Activando', redeemed: 'Utilizada', revoked: 'Revocada', expired: 'Vencida' }
  const colors = status === 'redeemed' ? 'bg-emerald-50 text-emerald-700' : status === 'pending' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'
  return <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${colors}`}>{labels[status] ?? status}</span>
}

function normalizeUsername(value) {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9.]/g, '').replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '')
}

export default AdminNewAccountPage

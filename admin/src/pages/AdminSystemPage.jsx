import { CircleDashed, Database, KeyRound, ShieldCheck, UsersRound } from 'lucide-react'
import { useAuth } from '../../../src/context/AuthContext'
import { useAdminData } from '../AdminDataContext'
import { accessLabels, accountIdentifier, eventLabels, planLabels } from '../adminAccounts'
import { AccessBadge, ErrorPanel, InfoItem, LoadingPanel, PageHeading, formatAdminDate } from '../components/AdminUi'

function AdminSystemPage() {
  const { profile } = useAuth()
  const { internalAccounts, customerAccounts, isLoading, error, reload } = useAdminData()

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Operación interna" title="Sistema" description="Controles administrativos disponibles y cobertura pendiente. Esta vista no declara saludable un servicio que todavía no esté midiendo." />
      {error && <ErrorPanel message={error} onRetry={reload} />}
      {isLoading && !internalAccounts.length ? <LoadingPanel /> : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ControlCard icon={ShieldCheck} title="Separación de portales" state="Disponible" ready description="El cliente y la administración usan interfaces distintas." />
            <ControlCard icon={KeyRound} title="Autorización en servidor" state="Disponible" ready description="Las RPC verifican el rol administrador antes de responder." />
            <ControlCard icon={Database} title="Auditoría de cambios" state="Disponible" ready description="Los cambios administrativos generan eventos persistentes." />
            <ControlCard icon={CircleDashed} title="Telemetría técnica" state="Pendiente" description="Faltan errores, latencia, disponibilidad y entregas de notificaciones." />
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
            <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-800"><UsersRound size={20} /></span><div><h2 className="text-lg font-extrabold text-slate-950">Administradores internos</h2><p className="mt-1 text-sm font-medium text-slate-500">{internalAccounts.length} cuentas internas; {customerAccounts.length} cuentas de clientes.</p></div></div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">{internalAccounts.map((account) => <article key={account.userId} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100"><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold text-slate-950">{account.displayName || accountIdentifier(account)}</h3>{account.userId === profile?.id && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-brand-800">Tu cuenta</span>}<AccessBadge status={account.accessStatus} label={accessLabels[account.accessStatus]} /></div><dl className="mt-4 grid gap-3 sm:grid-cols-3"><InfoItem label="Usuario" value={accountIdentifier(account)} /><InfoItem label="Tipo" value={planLabels[account.servicePlan]} /><InfoItem label="Último evento" value={account.latestAdminEvent ? eventLabels[account.latestAdminEvent] ?? account.latestAdminEvent : 'Sin eventos'} /></dl><p className="mt-3 text-xs font-semibold text-slate-500">Actualizada: {formatAdminDate(account.updatedAt)}</p></article>)}</div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
            <h2 className="text-lg font-extrabold text-slate-950">Cobertura que falta implementar</h2>
            <ul className="mt-4 grid gap-3 text-sm font-semibold text-slate-700 md:grid-cols-2"><PendingItem text="Último inicio de sesión y actividad general por cuenta" /><PendingItem text="Estado de onboarding dentro del expediente" /><PendingItem text="Historial formal de suscripciones y pagos" /><PendingItem text="Errores de aplicación y disponibilidad de servicios" /><PendingItem text="Alertas asignables con responsable y resolución" /><PendingItem text="Roles separados para soporte, cobros y auditoría" /></ul>
          </section>
        </>
      )}
    </div>
  )
}

function ControlCard({ icon: Icon, title, state, ready = false, description }) {
  return <article className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100"><div className="flex items-start justify-between gap-3"><span className={`grid size-10 place-items-center rounded-xl ${ready ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}><Icon size={20} /></span><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${ready ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{state}</span></div><h2 className="mt-4 font-extrabold text-slate-950">{title}</h2><p className="mt-2 text-sm font-medium leading-6 text-slate-500">{description}</p></article>
}

function PendingItem({ text }) {
  return <li className="flex items-start gap-2 rounded-xl bg-slate-50 p-3"><CircleDashed className="mt-0.5 shrink-0 text-slate-400" size={18} />{text}</li>
}

export default AdminSystemPage

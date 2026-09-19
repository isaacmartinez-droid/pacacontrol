import { CalendarClock, CircleDollarSign, CreditCard, FlaskConical } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAdminData } from '../AdminDataContext'
import { planLabels } from '../adminAccounts'
import { EmptyPanel, ErrorPanel, LoadingPanel, MetricCard, PageHeading, formatAdminDate } from '../components/AdminUi'

function AdminBillingPage() {
  const { customerAccounts, isLoading, error, reload } = useAdminData()
  const now = Date.now()
  const paid = customerAccounts.filter((account) => account.servicePlan === 'paid_monthly')
  const pilots = customerAccounts.filter((account) => account.servicePlan === 'pilot_free')
  const paymentRecords = customerAccounts
    .filter((account) => account.nextPaymentDueAt)
    .sort((a, b) => new Date(a.nextPaymentDueAt) - new Date(b.nextPaymentDueAt))
  const overdue = paymentRecords.filter((account) => new Date(account.nextPaymentDueAt).getTime() < now)

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Suscripciones" title="Cobros" description="Vista provisional de planes y fechas administrativas. Todavía no sustituye un historial formal de facturas y pagos." />
      {error && <ErrorPanel message={error} onRetry={reload} />}
      {isLoading && customerAccounts.length === 0 ? <LoadingPanel /> : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Mensualidad" value={paid.length} detail="Cuentas con plan mensual" icon={CreditCard} tone="emerald" />
            <MetricCard label="Pilotos" value={pilots.length} detail="Cuentas en prueba gratuita" icon={FlaskConical} tone="brand" />
            <MetricCard label="Con fecha de pago" value={paymentRecords.length} detail="Seguimiento configurado manualmente" icon={CalendarClock} tone="amber" />
            <MetricCard label="Vencidas" value={overdue.length} detail="Fecha registrada anterior a hoy" icon={CircleDollarSign} tone="red" />
          </section>

          <aside className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900 ring-1 ring-amber-200"><strong>Alcance actual:</strong> el sistema guarda plan y próximo vencimiento, pero todavía no registra importe, periodo facturado, comprobante ni historial de pagos. Esa separación será la siguiente base de datos del módulo.</aside>

          <section className="rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
            <div className="border-b border-slate-100 p-5"><h2 className="text-lg font-extrabold text-slate-950">Próximos vencimientos</h2><p className="mt-1 text-sm font-medium text-slate-500">Ordenados por la fecha registrada.</p></div>
            {paymentRecords.length ? <div className="divide-y divide-slate-100">{paymentRecords.map((account) => {
              const isOverdue = new Date(account.nextPaymentDueAt).getTime() < now
              return <Link key={account.userId} to={`/cuentas/${account.userId}`} className="grid gap-2 p-4 hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5"><div><p className="font-extrabold text-slate-950">{account.displayName || 'Cuenta sin nombre'}</p><p className="mt-1 text-xs font-semibold text-slate-500">{planLabels[account.servicePlan]}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-extrabold ${isOverdue ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>{isOverdue ? 'Vencido' : 'Programado'}</span><p className="text-sm font-bold text-slate-700 sm:min-w-44 sm:text-right">{formatAdminDate(account.nextPaymentDueAt)}</p></Link>
            })}</div> : <div className="p-5"><EmptyPanel title="Sin fechas de cobro" description="Aún no se han registrado próximos vencimientos para las cuentas." /></div>}
          </section>
        </>
      )}
    </div>
  )
}

export default AdminBillingPage

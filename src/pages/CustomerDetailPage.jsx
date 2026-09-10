import { useMemo, useState } from 'react'
import { CircleDollarSign, Clock3, Pencil, Phone, ReceiptText, TrendingDown, TrendingUp } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { formatCurrency } from '../utils/currency'
import { paymentMethods } from './NewSalePage'

const methodName = (id) => paymentMethods.find((method) => method.id === id)?.label ?? 'Sin registrar'
const dateTime = (value) => value ? new Date(value).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export default function CustomerDetailPage() {
  const { customerId } = useParams()
  const { data, completeSalePayment, isLoading } = usePacaData()
  const customer = data.customers.find((item) => item.id === customerId)
  const sales = useMemo(() => data.sales.filter((sale) => sale.customerId === customerId), [data.sales, customerId])
  const [methodBySale, setMethodBySale] = useState({})
  const [savingId, setSavingId] = useState('')
  const [message, setMessage] = useState('')
  const totals = sales.reduce((sum, sale) => ({
    purchased: sum.purchased + sale.total,
    paid: sum.paid + sale.paidAmount,
    balance: sum.balance + sale.balance,
    profit: sum.profit + sale.estimatedProfit,
  }), { purchased: 0, paid: 0, balance: 0, profit: 0 })

  async function completePayment(sale) {
    setSavingId(sale.id)
    setMessage('')
    try {
      await completeSalePayment(sale.id, methodBySale[sale.id] ?? 'cash')
      setMessage('Pago final registrado. La deuda y su alerta se actualizaron.')
    } catch (error) { setMessage(error.message || 'No fue posible registrar el pago.') }
    finally { setSavingId('') }
  }

  if (!customer && !isLoading) return <div><PageHeader eyebrow="Clientes" title="Cliente no encontrado" backTo="/clientes" /><div className="page-content py-6"><EmptyState icon={ReceiptText} title="Este cliente no está disponible" description="Puede haberse eliminado o no pertenecer a esta cuenta." /></div></div>
  if (!customer) return <div><PageHeader eyebrow="Clientes" title="Cargando…" backTo="/clientes" /></div>

  return <div>
    <PageHeader eyebrow="Historial del cliente" title={customer.name} description="Compras, pagos, delivery y resultado de cada pedido." backTo="/clientes" />
    <div className="page-content space-y-5 py-5 md:py-8">
      <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3"><div>{customer.phone ? <a href={`tel:${customer.phone.replaceAll(' ', '')}`} className="inline-flex items-center gap-2 font-bold text-brand-700"><Phone size={17} />{customer.phone}</a> : <span className="text-sm text-slate-500">Sin teléfono registrado</span>}</div><div className="flex items-center gap-2">{customer.priority && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-700">Cliente prioritario</span>}<Link to={`/clientes/${customer.id}/editar`} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-extrabold text-brand-800"><Pencil size={14} />Editar</Link></div></div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Total comprado" value={totals.purchased} /><Metric label="Total pagado" value={totals.paid} /><Metric label="Saldo pendiente" value={totals.balance} warning={totals.balance > 0} /><Metric label="Ganancia estimada" value={totals.profit} warning={totals.profit < 0} /></div>
      </section>
      {message && <p role="status" className="rounded-xl bg-brand-50 p-4 text-sm font-bold text-brand-800">{message}</p>}
      <section><h2 className="text-lg font-extrabold text-slate-900">Historial de pedidos</h2><p className="mt-1 text-sm text-slate-500">Los pagos completados permanecen aquí aunque desaparezca la alerta.</p>
        {sales.length === 0 ? <div className="mt-4"><EmptyState icon={ReceiptText} title="Este cliente todavía no tiene compras" description="Sus pedidos aparecerán aquí cuando registres una venta." /></div> : <div className="mt-4 space-y-4">{sales.map((sale) => <SaleHistory key={sale.id} sale={sale} method={methodBySale[sale.id] ?? 'cash'} onMethod={(method) => setMethodBySale((current) => ({ ...current, [sale.id]: method }))} onComplete={() => completePayment(sale)} saving={savingId === sale.id} />)}</div>}
      </section>
    </div>
  </div>
}

function Metric({ label, value, warning }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-lg font-extrabold ${warning ? 'text-coral-600' : 'text-slate-900'}`}>{formatCurrency(value)}</p></div> }
function SaleHistory({ sale, method, onMethod, onComplete, saving }) {
  const ResultIcon = sale.estimatedProfit >= 0 ? TrendingUp : TrendingDown
  return <article className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-extrabold text-slate-900">{sale.pieces} {sale.pieces === 1 ? 'pieza' : 'piezas'} · {sale.baleCodes.join(', ') || 'Paca'}</p><p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13} />{dateTime(sale.soldAt)}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${sale.balance > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{sale.balance > 0 ? `Debe ${formatCurrency(sale.balance)}` : 'Pagado'}</span></div>
    <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><Detail label="Prendas" value={formatCurrency(sale.merchandiseTotal)} /><Detail label="Entrega" value={sale.fulfillmentMethod === 'delivery' ? 'Envío' : 'Recoge en tienda'} /><Detail label="Cobro delivery" value={formatCurrency(sale.deliveryCharge)} /><Detail label="Costo delivery" value={formatCurrency(sale.deliveryCost)} /><Detail label="Costo prendas" value={formatCurrency(sale.estimatedMerchandiseCost)} /></dl>
    {sale.items.length > 0 && <div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Artículos individuales</p><div className="mt-3 space-y-3">{sale.items.map((item, index) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 text-sm last:border-0 last:pb-0"><span className="text-slate-700"><b>{index + 1}. {item.categoryName}</b><small className="mt-0.5 block text-slate-500">{item.baleCode} · {item.quantity} {item.quantity === 1 ? 'pieza' : 'piezas'} × {formatCurrency(item.unitPrice)}</small></span><span className="text-right"><b className="text-slate-900">{formatCurrency(item.quantity * item.unitPrice)}</b>{item.recommendedUnitPrice > 0 && <small className="block text-slate-500">Sugerido: {formatCurrency(item.recommendedUnitPrice)}</small>}</span></div>)}</div></div>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><Payment title="Primer pago" amount={sale.firstPaymentAmount} method={sale.firstPaymentMethod} at={sale.firstPaymentAt} /><Payment title="Segundo pago" amount={sale.secondPaymentAmount} method={sale.secondPaymentMethod} at={sale.secondPaymentAt} /></div>
    <div className={`mt-4 flex items-center justify-between rounded-2xl p-4 ${sale.estimatedProfit >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}><span className="flex items-center gap-2 text-sm font-bold"><ResultIcon size={18} />{sale.estimatedProfit >= 0 ? 'Ganancia estimada' : 'Pérdida estimada'}</span><strong>{formatCurrency(sale.estimatedProfit)}</strong></div>
    {sale.balance > 0 && <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row"><label className="flex-1 text-xs font-bold text-slate-600">Método del pago final<select value={method} onChange={(event) => onMethod(event.target.value)} className="sale-input mt-2">{paymentMethods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button type="button" disabled={saving} onClick={onComplete} className="min-h-12 self-end rounded-xl bg-brand-900 px-5 text-sm font-extrabold text-white disabled:opacity-50"><CircleDollarSign size={18} className="mr-2 inline" />{saving ? 'Guardando…' : `Cobrar saldo ${formatCurrency(sale.balance)}`}</button></div>}
  </article>
}
function Detail({ label, value }) { return <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-bold text-slate-900">{value}</dd></div> }
function Payment({ title, amount, method, at }) { return <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold text-slate-500">{title}</p>{amount > 0 ? <><p className="mt-1 text-lg font-extrabold text-slate-900">{formatCurrency(amount)}</p><p className="mt-1 text-xs text-slate-600">{methodName(method)} · {dateTime(at)}</p></> : <p className="mt-2 text-sm font-semibold text-slate-400">No registrado</p>}</div> }

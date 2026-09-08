import { ArrowUp, BadgeDollarSign, CalendarDays, CircleDollarSign, PackageCheck, PieChart, ReceiptText, Truck } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { getEffectiveCostPerSellablePiece, getSoldPercentage, getTotalInvestment } from '../utils/calculations'
import { formatCurrency } from '../utils/currency'
import { formatShortDate } from '../utils/dates'

function ReportsPage() {
  const { data } = usePacaData()
  const bale = data.bales[0]
  const summary = data.dailySummaries[0]
  return <div>
    <PageHeader eyebrow="Resultados" title="Reportes y ganancias" description="Consulta cierres diarios y el rendimiento de tus inversiones." backTo="/mas" />
    <div className="page-content grid items-start gap-5 py-5 md:py-8 lg:grid-cols-2 lg:gap-8">
      <DailySummary summary={summary} />
      {bale ? <BaleReport bale={bale} /> : <section className="rounded-3xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-soft ring-1 ring-slate-100 lg:col-span-2">Registra una paca para ver el rendimiento de tus inversiones.</section>}
    </div>
  </div>
}

function DailySummary({ summary }) {
  if (!summary) return <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 lg:col-span-2"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><CalendarDays aria-hidden="true" size={21} /></span><div><h2 className="font-extrabold text-slate-900">Resumen diario</h2><p className="mt-1 text-sm leading-6 text-slate-500">El primer cierre aparecerá al terminar el día. Incluye el costo estimado de las prendas vendidas, no la compra completa de una paca.</p></div></div></section>
  const payments = [['Efectivo', summary.cashTotal], ['Transferencia', summary.transferTotal], ['Tarjeta', summary.cardTotal], ['Otros', summary.otherTotal]].filter(([, value]) => value > 0)
  return <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 lg:col-span-2">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-500">Cierre diario</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">{formatShortDate(`${summary.date}T12:00:00Z`)}</h2></div><span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-extrabold text-brand-800">Generado automáticamente</span></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={BadgeDollarSign} label="Cobrado" value={formatCurrency(summary.salesTotal)} detail="Dinero realmente recibido" /><Metric icon={ReceiptText} label="Vendido" value={formatCurrency(summary.ordersTotal)} detail={`${summary.piecesSold} piezas vendidas`} /><Metric icon={CircleDollarSign} label="Pendiente de cobro" value={formatCurrency(summary.pendingReceivables)} detail="Saldo acumulado" tone={summary.pendingReceivables > 0 ? 'warning' : 'brand'} /><Metric icon={ArrowUp} label="Resultado neto" value={formatCurrency(summary.netResult)} detail="Después de costos y gastos" tone={summary.netResult >= 0 ? 'positive' : 'warning'} /></div>
    <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2"><div><h3 className="text-sm font-extrabold text-slate-900">Cobros por método</h3>{payments.length ? <dl className="mt-2 space-y-1.5 text-sm">{payments.map(([label, value]) => <div key={label} className="flex justify-between gap-3 text-slate-600"><dt>{label}</dt><dd className="font-bold text-slate-900">{formatCurrency(value)}</dd></div>)}</dl> : <p className="mt-2 text-sm text-slate-500">No hubo cobros registrados.</p>}</div><div className="grid gap-2 sm:grid-cols-2"><MiniMetric icon={Truck} label="Costo de deliveries" value={formatCurrency(summary.deliveryCostTotal)} /><MiniMetric icon={BadgeDollarSign} label="Delivery cobrado" value={formatCurrency(summary.deliveryChargeTotal)} /><MiniMetric icon={PackageCheck} label="Costo de prendas" value={formatCurrency(summary.estimatedCost)} /><MiniMetric icon={ReceiptText} label="Gastos del día" value={formatCurrency(summary.expensesTotal)} /></div></div>
    <p className="mt-4 text-xs leading-5 text-slate-500">Ganancia estimada antes de gastos generales: {formatCurrency(summary.estimatedProfit)}. Ya descuenta las prendas y el costo real del delivery.</p>
  </section>
}

function BaleReport({ bale }) {
  const investment = getTotalInvestment(bale)
  const result = bale.currentRevenue - investment
  return <><section className="relative overflow-hidden rounded-3xl bg-brand-900 p-5 text-white shadow-lg shadow-brand-900/15"><div aria-hidden="true" className="absolute -right-6 -top-6 size-28 rounded-full bg-white/5" /><div className="relative"><p className="text-sm font-medium text-brand-100">Resultado actual de {bale.code}</p><p className="mt-2 text-4xl font-extrabold tracking-tight">{formatCurrency(result)}</p><p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-100"><ArrowUp aria-hidden="true" size={14} />Ingresos frente a inversión</p></div></section><section className="grid grid-cols-2 gap-3" aria-label="Indicadores de rentabilidad"><Metric icon={BadgeDollarSign} label="Inversión" value={formatCurrency(investment)} /><Metric icon={PieChart} label="Paca vendida" value={`${Math.round(getSoldPercentage(bale))}%`} /></section><section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 lg:col-span-2 lg:max-w-3xl"><h2 className="text-lg font-extrabold text-slate-900">Precio recomendado</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-slate-500">Costo real por pieza</p><p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{formatCurrency(getEffectiveCostPerSellablePiece(bale))}</p></div><div><p className="text-xs text-slate-500">Precio base con {bale.targetMargin}% de margen</p><p className="mt-1 text-2xl font-extrabold tracking-tight text-brand-800">{formatCurrency(bale.baseRecommendedPrice)}</p></div></div><p className="mt-3 text-sm leading-6 text-slate-500">Considera la inversión completa, excluye prendas dañadas y redondea el precio hacia arriba a C$5.</p></section></>
}

function Metric({ icon: Icon, label, value, detail, tone = 'brand' }) { const color = tone === 'positive' ? 'text-emerald-600' : tone === 'warning' ? 'text-coral-600' : 'text-brand-600'; return <article className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"><Icon aria-hidden="true" className={color} size={20} /><p className="mt-3 text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p>{detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}</article> }
function MiniMetric({ icon: Icon, label, value }) { return <div className="rounded-2xl bg-slate-50 p-3"><Icon aria-hidden="true" className="text-brand-600" size={18} /><p className="mt-2 text-xs text-slate-500">{label}</p><p className="mt-0.5 font-extrabold text-slate-900">{value}</p></div> }
export default ReportsPage

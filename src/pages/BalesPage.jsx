import { useState } from 'react'
import { Archive, PackagePlus, Pencil, RotateCcw } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { calculateBaleFinancials, getActiveBale } from '../utils/baleFinancials'
import { formatCurrency } from '../utils/currency'
import { formatShortDate } from '../utils/dates'
import { getPricingLevel } from '../utils/pricing'
import { getBusinessTerms } from '../utils/businessProfile'

export default function BalesPage() {
  const { data, archiveBale, isLoading } = usePacaData()
  const [params, setParams] = useSearchParams()
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const terms = getBusinessTerms(data.businessProfile)
  const selected = data.bales.find((item) => item.id === params.get('paca'))
  const archived = params.get('archivo') === '1' || Boolean(selected?.isArchived)
  const bales = data.bales.filter((item) => item.isArchived === archived)
  const bale = selected ?? (archived ? bales[0] : getActiveBale(data.bales))
  const inventory = data.baleInventory.filter((item) => item.baleId === bale?.id)
  const otherExpenseItems = data.baleOtherExpenses.filter((item) => item.baleId === bale?.id)
  const finances = bale ? calculateBaleFinancials(bale, inventory, data.expenses) : null

  async function changeArchive() {
    if (!window.confirm(bale.isArchived ? `¿Reactivar ${terms.purchaseSingularLower}? Su inventario volverá a estar disponible.` : `¿Archivar ${terms.purchaseSingularLower}? Su inventario dejará de estar disponible. Se conservarán ventas, pagos, gastos e historial.`)) return
    setSaving(true)
    setMessage('')
    try {
      await archiveBale(bale.id, !bale.isArchived)
      setParams(bale.isArchived ? { paca: bale.id } : {})
    } catch (error) { setMessage(error.message || 'No fue posible cambiar el estado del registro.') }
    finally { setSaving(false) }
  }

  return <div>
    <PageHeader eyebrow="Compras e inversión" title={terms.purchasePlural} description="Inversión, recuperación y resultado individual. Archivar nunca borra la historia." />
    <div className="page-content max-w-5xl space-y-5 py-5 md:py-8">
      <div className="flex flex-wrap gap-3">
        <Link to="/pacas/nueva" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-brand-900 px-5 text-sm font-bold text-white"><PackagePlus size={19} />Registrar {terms.purchaseSingularLower}</Link>
        <Link to="/historial" className="inline-flex min-h-12 items-center rounded-2xl bg-white px-5 text-sm font-bold text-brand-900">Historial de cambios</Link>
      </div>
      <nav className="flex gap-2" aria-label={`Estado de ${terms.purchasePluralLower}`}>
        <Link to="/pacas" className={tabClass(!archived)}>Vigentes ({data.bales.filter((item) => !item.isArchived).length})</Link>
        <Link to="/pacas?archivo=1" className={tabClass(archived)}>En archivo ({data.bales.filter((item) => item.isArchived).length})</Link>
      </nav>
      {message && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{message}</p>}
      {!bale ? <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">{isLoading ? `Cargando ${terms.purchasePluralLower}…` : archived ? `No hay registros en el archivo de ${terms.purchasePluralLower}.` : `No hay ${terms.purchasePluralLower} vigentes. Registra una nueva o reactiva una desde En archivo.`}</p> : <>
        <label className="block max-w-md text-sm font-bold text-slate-700">{terms.purchaseSingular} seleccionada
          <select value={bale.id} onChange={(event) => setParams({ paca: event.target.value, ...(archived ? { archivo: '1' } : {}) })} className="sale-input mt-2">
            {bales.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.status}</option>)}
          </select>
        </label>
        <article className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-900 p-5 text-white">
            <div><h2 className="text-2xl font-extrabold">{bale.code}</h2><p className="mt-2 text-xs text-brand-100">{formatShortDate(bale.purchaseDate)} · {bale.status}</p></div>
            {!bale.isArchived && <Link to={'/pacas/' + bale.id + '/editar'} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-brand-900"><Pencil size={15} />Editar {terms.purchaseSingularLower}</Link>}
          </div>
          {bale.isArchived && <p className="bg-slate-100 px-5 py-3 text-sm text-slate-600">En archivo desde {formatShortDate(bale.archivedAt)}. Su inventario no se ofrece en ventas nuevas. {bale.archivedReason}</p>}
          <dl className="divide-y divide-slate-100 px-5">
            <Detail label="Costo de compra" value={formatCurrency(bale.purchaseCost)} />
            <Detail label="Transporte" value={formatCurrency(bale.acquisitionTransport)} />
            <OtherExpenseDetails total={bale.otherExpenses} items={otherExpenseItems} />
            <Detail label={`Inversión de esta ${terms.purchaseSingularLower}`} value={formatCurrency(finances.investment)} />
            <Detail label={`Ventas registradas de ${terms.inventoryUnitPluralLower}`} value={formatCurrency(finances.revenue)} />
            <Detail label={`Cobrado de ${terms.inventoryUnitPluralLower}`} value={formatCurrency(finances.collected)} />
            <Detail label={`Por cobrar de ${terms.inventoryUnitPluralLower}`} value={formatCurrency(finances.pending)} />
            <Detail label="Inversión pendiente de recuperar (con cobros)" value={formatCurrency(finances.investmentRemaining)} />
            <Detail label={`Gastos operativos asignados a esta ${terms.purchaseSingularLower}`} value={formatCurrency(finances.operatingExpenses)} />
            <Detail label={bale.availablePieces <= 0 ? 'Ganancia o pérdida final (ventas)' : 'Resultado acumulado frente a la inversión (ventas)'} value={formatCurrency(finances.result)} warning={finances.result < 0} />
            <Detail label="Resultado de caja asignado al registro" value={formatCurrency(finances.cashResult)} warning={finances.cashResult < 0} />
            <Detail label="Ganancia deseada" value={formatCurrency(bale.targetProfitAmount)} />
            <Detail label="Meta: inversión + gastos + ganancia" value={formatCurrency(finances.target)} />
            <Detail label="Falta vender para alcanzar la meta" value={formatCurrency(finances.targetRemaining)} />
            {bale.availablePieces > 0 && <Detail label={`Precio promedio necesario por ${terms.inventoryUnitSingularLower} restante`} value={formatCurrency(finances.requiredAveragePrice)} />}
            <Detail label="Ganancia proyectada al vender todo al sugerido" value={formatCurrency(finances.projectedProfit)} warning={finances.projectedProfit < 0} />
          </dl>
          <p className="px-5 py-4 text-xs leading-5 text-slate-500">Los cobros de pedidos con varias compras se distribuyen proporcionalmente entre productos y delivery. No es el efectivo físico: también puede incluir transferencias. El resultado final descuenta la inversión completa y los gastos asignados; los gastos generales se descuentan en el resumen mensual.</p>
        </article>
        <article className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">{[['Total recibido', bale.receivedPieces], ['Total vendido', bale.soldPieces], ['Disponibles', bale.availablePieces], ['Con daños', bale.damagedPieces]].map(([label, count]) => <div key={label}><b className="text-xl text-slate-900">{count}</b><p className="text-xs text-slate-500">{label}</p></div>)}</div>
        </article>
        <article className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-slate-100">
          <h3 className="border-b border-slate-100 p-5 font-extrabold text-slate-900">Precios por categoría</h3>
          {inventory.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 last:border-0"><div><p className="font-bold text-slate-900">{item.categoryName}</p><p className="mt-1 text-xs text-slate-500">{getPricingLevel(item.priceLevel).label} · {item.availablePieces} disponibles {bale.isArchived ? '(inactivas)' : ''}</p></div><b className="text-lg text-brand-800">{formatCurrency(item.recommendedUnitPrice)}</b></div>)}
        </article>
        <button type="button" onClick={changeArchive} disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-brand-200 bg-white px-5 text-sm font-extrabold text-brand-900 disabled:opacity-50">{bale.isArchived ? <RotateCcw size={18} /> : <Archive size={18} />}{saving ? 'Procesando…' : bale.isArchived ? `Reactivar ${terms.purchaseSingularLower}` : `Archivar ${terms.purchaseSingularLower} y conservar historial`}</button>
      </>}
    </div>
  </div>
}

function tabClass(selected) { return 'rounded-xl px-4 py-3 text-sm font-bold ' + (selected ? 'bg-brand-900 text-white' : 'bg-white text-brand-900') }
function Detail({ label, value, warning }) { return <div className="flex flex-wrap items-center justify-between gap-3 py-3"><dt className="text-sm text-slate-500">{label}</dt><dd className={'text-sm font-extrabold ' + (warning ? 'text-amber-700' : 'text-brand-900')}>{value}</dd></div> }
function OtherExpenseDetails({ total, items }) {
  return <div className="py-3">
    <details>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-slate-500">
        <span>Otros gastos de compra <span className="ml-1 text-xs text-brand-700">Ver detalle</span></span>
        <b className="text-brand-900">{formatCurrency(total)}</b>
      </summary>
      <div className="mt-3 rounded-2xl bg-slate-50 p-4">
        {items.length > 0 ? <>
          <ul className="space-y-2">{items.map((item) => <li key={item.id} className="flex items-start justify-between gap-3 text-sm"><span className="text-slate-700">{item.concept}</span><b className="shrink-0 text-brand-900">{formatCurrency(item.amount)}</b></li>)}</ul>
          <p className="mt-3 flex justify-between gap-3 border-t border-slate-200 pt-3 text-sm font-extrabold text-brand-900"><span>Total</span><span>{formatCurrency(total)}</span></p>
        </> : total > 0 ? <p className="text-sm text-amber-800"><b>Detalle anterior no desglosado.</b> Esta compra guardó únicamente el total; el sistema no inventará conceptos.</p> : <p className="text-sm text-slate-500">Esta compra no tiene otros gastos.</p>}
      </div>
    </details>
  </div>
}

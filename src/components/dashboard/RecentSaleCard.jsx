import { useState } from 'react'
import { Check, CircleDollarSign, PackageCheck, Pencil, ShoppingBag, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../../utils/currency'

const deliverySteps = [
  { id: 'to_prepare', label: 'Preparar', icon: CircleDollarSign },
  { id: 'ready', label: 'Listo', icon: PackageCheck },
  { id: 'on_the_way', label: 'En camino', icon: Truck },
  { id: 'delivered', label: 'Entregado', icon: PackageCheck },
]

const pickupSteps = [
  { id: 'to_prepare', label: 'Preparar', icon: CircleDollarSign },
  { id: 'ready', label: 'Listo', icon: PackageCheck },
  { id: 'delivered', label: 'Retirado', icon: PackageCheck },
]

function RecentSaleCard({ sale, onAdvanceStatus, onConfirmPayment, isUpdating = false }) {
  const [finalPaymentMethod, setFinalPaymentMethod] = useState('cash')
  const steps = sale.fulfillmentMethod === 'delivery' ? deliverySteps : pickupSteps
  const currentStep = Math.max(
    0,
    steps.findIndex((step) => step.id === sale.deliveryStatus),
  )
  const nextStep = steps[currentStep + 1]

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <ShoppingBag aria-hidden="true" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-slate-900">{sale.customerName}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {sale.pieces} {sale.pieces === 1 ? 'pieza' : 'piezas'} · {sale.dateLabel}
              </p>
              {sale.baleCodes?.length > 0 && (
                <p className="mt-0.5 truncate text-xs font-semibold text-brand-700">Paca: {sale.baleCodes.join(', ')}</p>
              )}
              <p className="mt-0.5 text-[0.68rem] font-semibold text-slate-500">{sale.fulfillmentMethod === 'delivery' ? 'Envío al cliente' : 'Recoge en tienda'}</p>
            </div>
            <p className="shrink-0 text-sm font-extrabold text-slate-900">{formatCurrency(sale.total)}</p>
          </div>
        </div>
      </div>

      <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${sale.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
        Pago: {sale.paymentStatus === 'paid' ? 'Pagado' : sale.paymentStatus === 'partial' ? `Parcial · faltan ${formatCurrency(sale.balance)}` : `Pendiente · faltan ${formatCurrency(sale.balance)}`}
      </div>

      {sale.deliveryStatus !== 'delivered' && <Link to={`/ventas/${sale.id}/editar`} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 text-xs font-extrabold text-brand-800 transition hover:bg-brand-100"><Pencil size={15} />Editar artículos, cliente o entrega</Link>}

      {(sale.items?.length ?? 0) > 0 && <details className="mt-3 rounded-xl bg-slate-50 px-3 py-2"><summary className="cursor-pointer text-xs font-extrabold text-slate-700">Ver artículos individuales ({sale.items.length})</summary><div className="mt-2 space-y-2">{sale.items.map((item) => sale.deliveryStatus === 'delivered' ? <div key={item.id} className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-xs"><ItemDescription item={item} /><b className="shrink-0 text-slate-900">{formatCurrency(item.quantity * item.unitPrice)}</b></div> : <Link key={item.id} to={`/ventas/${sale.id}/editar`} className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-xs transition hover:text-brand-800"><ItemDescription item={item} /><span className="flex shrink-0 items-center gap-1 font-extrabold"><Pencil size={12} />Editar</span></Link>)}</div></details>}

      <div className={`mt-4 grid ${steps.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`} aria-label={`Estado del pedido: ${steps[currentStep].label}`}>
        {steps.map((step, index) => {
          const Icon = step.icon
          const isComplete = index <= currentStep
          const isCurrent = index === currentStep

          return (
            <div key={step.id} className="relative flex min-w-0 flex-col items-center text-center">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-4 h-0.5 w-full ${index <= currentStep ? 'bg-brand-500' : 'bg-slate-200'}`}
                />
              )}
              <span
                className={`relative z-10 grid size-8 place-items-center rounded-full border-2 ${
                  isComplete
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                {index < currentStep
                  ? <Check aria-hidden="true" size={15} strokeWidth={3} />
                  : <Icon aria-hidden="true" size={15} strokeWidth={isCurrent ? 2.5 : 2} />}
              </span>
              <span className={`mt-1.5 truncate text-[0.65rem] font-bold ${isComplete ? 'text-brand-800' : 'text-slate-400'}`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {onConfirmPayment && sale.paymentStatus !== 'paid' && <div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><label className="sr-only" htmlFor={`payment-${sale.id}`}>Método del pago final</label><select id={`payment-${sale.id}`} value={finalPaymentMethod} onChange={(event) => setFinalPaymentMethod(event.target.value)} className="sale-input min-h-10 py-1 text-xs"><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="other">Otro</option></select><button type="button" disabled={isUpdating} onClick={() => onConfirmPayment(sale.id, finalPaymentMethod)} className="min-h-10 rounded-xl bg-emerald-50 px-4 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60">{isUpdating ? 'Actualizando…' : 'Cobrar saldo'}</button></div>}

      {onAdvanceStatus && nextStep && sale.paymentStatus === 'paid' && (
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => onAdvanceStatus(sale.id, nextStep.id)}
          className="mt-4 flex min-h-10 w-full items-center justify-center rounded-xl bg-brand-50 px-4 text-xs font-extrabold text-brand-800 transition hover:bg-brand-100 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
        >
          {isUpdating ? 'Actualizando…' : `Marcar como ${nextStep.label.toLowerCase()}`}
        </button>
      )}
    </article>
  )
}

function ItemDescription({ item }) {
  return <span className="min-w-0 text-slate-600"><b className="block truncate text-slate-800">{item.categoryName}</b>{item.baleCode} · {item.quantity} × {formatCurrency(item.unitPrice)}</span>
}

export default RecentSaleCard

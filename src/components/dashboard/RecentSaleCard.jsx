import { Check, CircleDollarSign, PackageCheck, ShoppingBag, Truck } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'

const deliverySteps = [
  { id: 'paid', label: 'Pagado', icon: CircleDollarSign },
  { id: 'on_the_way', label: 'En camino', icon: Truck },
  { id: 'delivered', label: 'Entregado', icon: PackageCheck },
]

function RecentSaleCard({ sale, onAdvanceStatus, isUpdating = false }) {
  const currentStep = Math.max(
    0,
    deliverySteps.findIndex((step) => step.id === sale.deliveryStatus),
  )
  const nextStep = deliverySteps[currentStep + 1]

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
            </div>
            <p className="shrink-0 text-sm font-extrabold text-slate-900">
              {formatCurrency(sale.total)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3" aria-label={`Estado del pedido: ${deliverySteps[currentStep].label}`}>
        {deliverySteps.map((step, index) => {
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

      {onAdvanceStatus && nextStep && (
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

export default RecentSaleCard

import { Check, ShoppingBag } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'

function RecentSaleCard({ sale }) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
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
        <p className="mt-2 inline-flex items-center gap-1 text-[0.68rem] font-bold text-emerald-700">
          <Check aria-hidden="true" size={12} strokeWidth={3} />
          {sale.status}
        </p>
      </div>
    </article>
  )
}

export default RecentSaleCard

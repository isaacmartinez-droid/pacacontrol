import { CalendarDays, ChevronRight, PackageOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getAvailablePieces,
  getSoldPercentage,
  getTotalInvestment,
} from '../../utils/calculations'
import { formatCurrency } from '../../utils/currency'
import { formatShortDate } from '../../utils/dates'
import { calculateBaleFinancials } from '../../utils/baleFinancials'
import { usePacaData } from '../../context/PacaDataContext'
import { getBusinessTerms } from '../../utils/businessProfile'

function ActiveBaleCard({ bale }) {
  const { data } = usePacaData()
  const terms = getBusinessTerms(data.businessProfile)
  const availablePieces = getAvailablePieces(bale)
  const soldPercentage = Math.round(getSoldPercentage(bale))
  const financials = calculateBaleFinancials(bale)

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-soft">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <PackageOpen aria-hidden="true" size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{bale.code}</h3>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[0.68rem] font-bold text-emerald-700">
                {bale.status}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarDays aria-hidden="true" size={13} />
              Registro: {formatShortDate(bale.purchaseDate)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-slate-100">
        <div className="bg-white px-5 py-4">
          <p className="text-xs font-medium text-slate-500">Inversión total</p>
          <p className="mt-1 text-lg font-extrabold text-slate-900">
            {formatCurrency(getTotalInvestment(bale))}
          </p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-xs font-medium text-slate-500">Cobrado de {terms.inventoryUnitPluralLower}</p>
          <p className="mt-1 text-lg font-extrabold text-emerald-700">
            {formatCurrency(financials.collected)}
          </p>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-5 rounded-2xl bg-brand-50 p-4">
          <p className="text-xs font-semibold text-brand-800">Inversión pendiente de recuperar</p>
          <p className="mt-1 text-xl font-extrabold text-brand-950">{formatCurrency(financials.investmentRemaining)}</p>
          <p className="mt-1 text-xs text-slate-500">Ventas: {formatCurrency(financials.revenue)} · por cobrar: {formatCurrency(financials.pending)}</p>
        </div>
        <div className="bale-piece-grid grid gap-2 text-center">
          <PieceCount label="Recibidas" value={bale.receivedPieces} />
          <PieceCount label="Vendidas" value={bale.soldPieces} />
          <PieceCount label="Disponibles" value={availablePieces} />
          <PieceCount label="Dañadas" value={bale.damagedPieces} warning />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-600">Progreso de venta</span>
            <span className="font-extrabold text-brand-700">{soldPercentage}% vendido</span>
          </div>
          <progress
            className="bale-progress block"
            value={soldPercentage}
            max="100"
            aria-label={`${soldPercentage}% vendido de ${terms.purchaseSingularLower}`}
          />
        </div>

        <Link
          to={`/pacas?paca=${bale.id}`}
          className="mt-5 flex min-h-11 items-center justify-center gap-1 rounded-xl border border-slate-200 text-sm font-bold text-brand-800 transition hover:bg-brand-50 active:scale-[0.98]"
        >
          Ver detalles
          <ChevronRight aria-hidden="true" size={17} />
        </Link>
      </div>
    </article>
  )
}

function PieceCount({ label, value, warning = false }) {
  return (
    <div>
      <p className={`text-lg font-extrabold ${warning ? 'text-amber-700' : 'text-slate-900'}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[0.65rem] font-medium leading-tight text-slate-500">{label}</p>
    </div>
  )
}

export default ActiveBaleCard

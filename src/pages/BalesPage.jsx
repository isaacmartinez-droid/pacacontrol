import { CalendarDays, PackagePlus, Truck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import {
  getAvailablePieces,
  getSoldPercentage,
  getTotalInvestment,
} from '../utils/calculations'
import { formatCurrency } from '../utils/currency'
import { formatShortDate } from '../utils/dates'

function BalesPage() {
  const { data } = usePacaData()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('paca')
  const activeBale = selectedId ? data.bales.find((bale) => bale.id === selectedId) : data.bales[0]
  if (selectedId && !activeBale) return <div><PageHeader title="Pacas" description="Revisión de la paca seleccionada." /><div className="page-content py-5"><p className="mb-3 text-sm text-slate-600">La paca seleccionada no está disponible en los datos cargados.</p><Link to="/pacas" className="font-bold text-brand-800 underline">Ver mis pacas</Link></div></div>
  if (!activeBale) return <div><PageHeader eyebrow="Compras e inversión" title="Pacas" description="Consulta el avance de cada compra y cuánto inventario continúa disponible." /><div className="page-content py-5"><Link to="/pacas/nueva" className="inline-flex min-h-12 items-center rounded-2xl bg-brand-900 px-5 text-sm font-bold text-white">Registrar una paca</Link></div></div>
  const percentage = Math.round(getSoldPercentage(activeBale))

  return (
    <div>
      <PageHeader
        eyebrow="Compras e inversión"
        title="Pacas"
        description="Consulta el avance de cada compra y cuánto inventario continúa disponible."
      />
      <div className="page-content space-y-5 py-5 md:py-8">
        <Link
          to="/pacas/nueva"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-900 px-5 text-sm font-bold text-white shadow-lg shadow-brand-900/15 transition hover:bg-brand-800 active:scale-[0.98] sm:w-fit"
        >
          <PackagePlus aria-hidden="true" size={19} />
          Registrar una paca
        </Link>

        {data.bales.length > 1 && (
          <label className="block max-w-md text-sm font-bold text-slate-700">
            Ver otra paca
            <select value={activeBale.id} onChange={(event) => setSearchParams({ paca: event.target.value })} className="sale-input mt-2">
              {data.bales.map((bale) => <option key={bale.id} value={bale.id}>{bale.code} · {bale.status}</option>)}
            </select>
          </label>
        )}

        <section aria-labelledby="current-bale-title" className="max-w-4xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="current-bale-title" className="text-lg font-extrabold text-slate-900">
              {selectedId ? 'Paca seleccionada desde la alerta' : 'Paca actual'}
            </h2>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${activeBale.status === 'En venta' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {activeBale.status}
            </span>
          </div>

          <article className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-slate-100">
            <div className="bg-brand-900 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-200">
                Código de paca
              </p>
              <h3 className="mt-1 text-2xl font-extrabold">{activeBale.code}</h3>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-brand-100">
                <CalendarDays aria-hidden="true" size={14} />
                {formatShortDate(activeBale.purchaseDate)}
              </p>
            </div>
            <dl className="divide-y divide-slate-100 px-5">
              <DetailRow label="Costo de compra" value={formatCurrency(activeBale.purchaseCost)} />
              <DetailRow
                label="Transporte"
                value={formatCurrency(activeBale.acquisitionTransport)}
                icon={Truck}
              />
              <DetailRow
                label="Inversión total"
                value={formatCurrency(getTotalInvestment(activeBale))}
                emphasized
              />
              <DetailRow label="Piezas recibidas" value={activeBale.receivedPieces} />
              <DetailRow label="Piezas vendidas" value={activeBale.soldPieces} />
              <DetailRow label="Piezas disponibles" value={getAvailablePieces(activeBale)} />
              <DetailRow label="Piezas dañadas" value={activeBale.damagedPieces} warning />
            </dl>
            <div className="border-t border-slate-100 p-5">
              <div className="mb-2 flex justify-between text-xs font-bold">
                <span className="text-slate-600">Avance de venta</span>
                <span className="text-brand-700">{percentage}%</span>
              </div>
              <progress
                className="bale-progress block"
                value={percentage}
                max="100"
                aria-label={`${percentage}% de la paca vendida`}
              />
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}

function DetailRow({ label, value, emphasized = false, warning = false, icon: Icon }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-3">
      <dt className="flex items-center gap-2 text-sm text-slate-500">
        {Icon && <Icon aria-hidden="true" size={15} />}
        {label}
      </dt>
      <dd
        className={`text-sm font-extrabold ${
          warning ? 'text-amber-700' : emphasized ? 'text-brand-800' : 'text-slate-900'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

export default BalesPage

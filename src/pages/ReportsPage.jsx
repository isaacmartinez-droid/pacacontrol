import { ArrowUp, BadgeDollarSign, PieChart } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import {
  getEffectiveCostPerSellablePiece,
  getSoldPercentage,
  getTotalInvestment,
} from '../utils/calculations'
import { formatCurrency } from '../utils/currency'

function ReportsPage() {
  const { data } = usePacaData()
  const activeBale = data.bales[0]
  if (!activeBale) return <div><PageHeader eyebrow="Resultados" title="Reportes y ganancias" description="Mide el rendimiento de cada paca con indicadores simples y comparables." backTo="/mas" /><div className="page-content py-5 text-sm font-semibold text-slate-500">Registra una paca para ver reportes.</div></div>
  const investment = getTotalInvestment(activeBale)
  const currentResult = activeBale.currentRevenue - investment

  return (
    <div>
      <PageHeader
        eyebrow="Resultados"
        title="Reportes y ganancias"
        description="Mide el rendimiento de cada paca con indicadores simples y comparables."
        backTo="/mas"
      />
      <div className="page-content grid items-start gap-5 py-5 md:py-8 lg:grid-cols-2 lg:gap-8">
        <section className="relative overflow-hidden rounded-3xl bg-brand-900 p-5 text-white shadow-lg shadow-brand-900/15">
          <div aria-hidden="true" className="absolute -right-6 -top-6 size-28 rounded-full bg-white/5" />
          <div className="relative">
            <p className="text-sm font-medium text-brand-100">Resultado actual de {activeBale.code}</p>
            <p className="mt-2 text-4xl font-extrabold tracking-tight">
              {formatCurrency(currentResult)}
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-100">
              <ArrowUp aria-hidden="true" size={14} />
              Ingresos por encima de la inversión
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3" aria-label="Indicadores de rentabilidad">
          <ReportMetric
            icon={BadgeDollarSign}
            label="Inversión"
            value={formatCurrency(investment)}
          />
          <ReportMetric
            icon={PieChart}
            label="Paca vendida"
            value={`${Math.round(getSoldPercentage(activeBale))}%`}
          />
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 lg:col-span-2 lg:max-w-3xl">
          <h2 className="text-lg font-extrabold text-slate-900">Costo efectivo</h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-brand-800">
            {formatCurrency(getEffectiveCostPerSellablePiece(activeBale))}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Por cada pieza vendible, considerando la inversión completa y excluyendo las prendas dañadas.
          </p>
        </section>
      </div>
    </div>
  )
}

function ReportMetric({ icon: Icon, label, value }) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
      <Icon aria-hidden="true" className="text-brand-600" size={20} />
      <p className="mt-4 text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p>
    </article>
  )
}

export default ReportsPage

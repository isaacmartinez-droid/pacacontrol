import { useEffect, useState } from 'react'
import {
  BadgeDollarSign,
  PackageCheck,
  Plus,
  ShoppingBag,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import ActiveBaleCard from '../components/dashboard/ActiveBaleCard'
import QuickAction from '../components/dashboard/QuickAction'
import RecentSaleCard from '../components/dashboard/RecentSaleCard'
import SummaryCard from '../components/dashboard/SummaryCard'
import Topbar from '../components/layout/Topbar'
import SectionTitle from '../components/common/SectionTitle'
import { formatCurrency } from '../utils/currency'
import { useAuth } from '../context/AuthContext'
import { usePacaData } from '../context/PacaDataContext'

const dashboardPeriods = [
  { id: 'today', label: 'Hoy', salesLabel: 'Ventas de hoy' },
  { id: 'week', label: 'Esta semana', salesLabel: 'Ventas semanales' },
  { id: 'month', label: 'Este mes', salesLabel: 'Ventas del mes' },
]

function DashboardPage() {
  const { user } = useAuth()
  const { data, isLoading } = usePacaData()
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours())
  const firstName = getFirstName(user)
  const greeting = getGreeting(currentHour)

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentHour(new Date().getHours()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const summary = {
    sales: data.sales.reduce((total, sale) => total + sale.total, 0),
    estimatedProfit: data.sales.reduce((total, sale) => total + sale.total, 0) - data.bales.reduce((total, bale) => total + bale.purchaseCost + bale.acquisitionTransport + bale.otherExpenses, 0),
    availablePieces: data.categories.reduce((total, category) => total + category.availablePieces, 0),
    damagedPieces: data.bales.reduce((total, bale) => total + bale.damagedPieces, 0),
  }
  const period = dashboardPeriods.find((item) => item.id === selectedPeriod)
  const activeBale = data.bales[0]

  return (
    <div className="min-h-full bg-[#edf3f1]">
      <Topbar
        eyebrow="Mi tienda"
        title={`${greeting}${firstName ? ` ${firstName}` : ''}`}
        description="Este es el resumen de tu negocio"
        availablePieces={summary.availablePieces}
      />
      <div className="page-content relative -ml-1 mt-1 space-y-7 pb-4 sm:space-y-8 md:pb-8">
        <section
          aria-label="Período del resumen"
          className="rounded-2xl bg-brand-900 p-1.5 shadow-lg shadow-brand-950/15 ring-1 ring-brand-800 md:max-w-xl"
        >
          <div className="grid grid-cols-3 gap-1" role="group">
            {dashboardPeriods.map((item) => {
              const isSelected = item.id === selectedPeriod

              return (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedPeriod(item.id)}
                  className={`min-h-11 rounded-xl px-2 text-xs font-bold transition active:scale-95 ${
                    isSelected
                      ? 'bg-white text-brand-900 shadow-sm'
                      : 'text-brand-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="summary-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="summary-title" className="text-lg font-extrabold tracking-tight text-slate-900">
              Tu resumen
            </h2>
            <span className="text-xs font-semibold text-slate-400">{period.label}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3 md:grid-cols-4 md:gap-4">
            <SummaryCard
              icon={BadgeDollarSign}
              label={period.salesLabel}
              value={formatCurrency(summary.sales)}
              detail="Ingresos registrados"
              badge="Actual"
            />
            <SummaryCard
              icon={TrendingUp}
              label="Ganancia estimada"
              value={formatCurrency(summary.estimatedProfit)}
              detail="Después de costos"
              badge="Estimado"
              tone="positive"
            />
            <SummaryCard
              icon={PackageCheck}
              label="Piezas disponibles"
              value={summary.availablePieces}
              detail="Listas para vender"
              badge="Stock"
              tone="neutral"
            />
            <SummaryCard
              icon={TriangleAlert}
              label="Piezas dañadas"
              value={summary.damagedPieces}
              detail="Requieren atención"
              badge="Revisar"
              tone="warning"
            />
          </div>
        </section>

        <section aria-labelledby="quick-actions-title">
          <div className="mb-3">
            <h2 id="quick-actions-title" className="text-lg font-extrabold tracking-tight text-slate-900">
              Acciones rápidas
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Lo que más usas, siempre a mano</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3 md:max-w-2xl md:gap-4">
            <QuickAction
              to="/ventas/nueva"
              icon={ShoppingBag}
              title="Registrar venta"
              description="Nueva salida"
              primary
            />
            <QuickAction
              to="/pacas/nueva"
              icon={Plus}
              title="Registrar paca"
              description="Nueva inversión"
            />
          </div>
        </section>

        <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] xl:gap-8">
          <section aria-labelledby="active-bale-title">
            <div className="mb-3">
              <h2 id="active-bale-title" className="text-lg font-extrabold tracking-tight text-slate-900">
                Paca activa
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Sigue el avance de tu inversión actual</p>
            </div>
            {activeBale ? <ActiveBaleCard bale={activeBale} /> : <p className="rounded-2xl bg-white p-5 text-sm font-semibold text-slate-500">Aún no has registrado una paca.</p>}
          </section>

          <section aria-labelledby="recent-sales-title">
            <SectionTitle title="Ventas recientes" linkTo="/ventas" />
            <div className="mt-3 space-y-2.5">
              {data.sales.slice(0, 3).map((sale) => (
                <RecentSaleCard key={sale.id} sale={sale} />
              ))}
              {!isLoading && data.sales.length === 0 && <p className="rounded-2xl bg-white p-5 text-sm font-semibold text-slate-500">Aún no hay ventas registradas.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage

function getGreeting(hour) {
  if (hour >= 5 && hour < 12) return 'Buenos días'
  if (hour >= 12 && hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function getFirstName(user) {
  const username = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? ''
  const firstName = username.split('.')[0].trim()
  return firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : ''
}

import { useEffect, useState } from 'react'
import {
  Banknote,
  Boxes,
  CircleDollarSign,
  HandCoins,
  PackageCheck,
  Plus,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  TriangleAlert,
  Truck,
  WalletCards,
} from 'lucide-react'
import ActiveBaleCard from '../components/dashboard/ActiveBaleCard'
import QuickAction from '../components/dashboard/QuickAction'
import RecentSaleCard from '../components/dashboard/RecentSaleCard'
import SummaryCard from '../components/dashboard/SummaryCard'
import Topbar from '../components/layout/Topbar'
import SectionTitle from '../components/common/SectionTitle'
import { formatCurrency } from '../utils/currency'
import { getBusinessHour } from '../utils/dates'
import { useAuth } from '../context/AuthContext'
import { usePacaData } from '../context/PacaDataContext'
import { calculateDashboardFinancials } from '../utils/dashboardFinancials'
import { calculateBaleFinancials, getActiveBale, getBaleSales } from '../utils/baleFinancials'

const dashboardPeriods = [
  { id: 'today', label: 'Hoy', resultSuffix: 'de hoy', collectedSuffix: 'hoy' },
  { id: 'week', label: 'Esta semana', resultSuffix: 'de la semana', collectedSuffix: 'esta semana' },
  { id: 'month', label: 'Este mes', resultSuffix: 'del mes', collectedSuffix: 'este mes' },
]

function DashboardPage() {
  const { user } = useAuth()
  const { data, isLoading } = usePacaData()
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [selectedBaleId, setSelectedBaleId] = useState('')
  const [currentHour, setCurrentHour] = useState(() => getBusinessHour())
  const firstName = getFirstName(user)
  const greeting = getGreeting(currentHour)

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentHour(getBusinessHour()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setSelectedPeriod(data.settings.dashboardPeriod)
  }, [data.settings.dashboardPeriod])

  const summary = {
    availablePieces: data.categories.reduce((total, category) => total + category.availablePieces, 0),
    damagedPieces: data.bales.filter((bale) => !bale.isArchived).reduce((total, bale) => total + bale.damagedPieces, 0),
  }
  const period = dashboardPeriods.find((item) => item.id === selectedPeriod)
  const financials = calculateDashboardFinancials(data, selectedPeriod, new Date(), selectedBaleId)
  const hasProfit = financials.netResult >= 0
  const activeBale = getActiveBale(data.bales, selectedBaleId)
  const automaticBale = getActiveBale(data.bales)
  const activeBales = data.bales.filter((bale) => !bale.isArchived)
  const baleSales = getBaleSales(data.sales, activeBale?.id)
  const baleFinancials = activeBale ? calculateBaleFinancials(activeBale) : null
  const kpiCards = {
    netResult: {
      icon: hasProfit ? TrendingUp : TriangleAlert,
      label: `${hasProfit ? 'Ganancia neta' : 'Pérdida neta'} ${period.resultSuffix}`,
      value: formatCurrency(Math.abs(financials.netResult)),
      detail: 'Después de prendas, delivery y gastos', badge: 'Estimado', tone: hasProfit ? 'positive' : 'warning',
    },
    collected: {
      icon: CircleDollarSign, label: `Dinero cobrado ${period.collectedSuffix}`, value: formatCurrency(financials.collected),
      detail: financials.receivables > 0 ? `Por cobrar: ${formatCurrency(financials.receivables)}` : 'Sin saldos pendientes', badge: 'Cobros', tone: financials.receivables > 0 ? 'warning' : 'positive',
    },
    receivables: { icon: HandCoins, label: 'Dinero por cobrar', value: formatCurrency(financials.receivables), detail: financials.receivables > 0 ? 'Saldos pendientes de clientes' : 'Sin saldos pendientes', badge: 'Pendiente', tone: financials.receivables > 0 ? 'warning' : 'positive', to: '/clientes' },
    baleInvestment: { icon: WalletCards, label: 'Inversión de esta paca', value: formatCurrency(financials.baleInvestment), detail: activeBale ? `${activeBale.code} · faltan ${formatCurrency(baleFinancials.investmentRemaining)}` : 'Sin paca activa', badge: 'Capital', tone: 'neutral', to: activeBale ? `/pacas?paca=${activeBale.id}` : '/pacas' },
    baleInvestmentRemaining: { icon: WalletCards, label: 'Inversión por recuperar', value: formatCurrency(baleFinancials?.investmentRemaining), detail: activeBale?.code ?? 'Sin paca activa', badge: 'Recuperar', tone: 'neutral', to: activeBale ? `/pacas?paca=${activeBale.id}` : '/pacas' },
    baleCollected: { icon: CircleDollarSign, label: 'Cobrado de esta paca', value: formatCurrency(baleFinancials?.collected), detail: activeBale ? `${activeBale.code} · solo prendas, sin delivery` : 'Sin paca activa', badge: 'Paca', tone: 'positive', to: activeBale ? `/pacas?paca=${activeBale.id}` : '/pacas' },
    inventoryValue: { icon: Boxes, label: 'Valor del inventario disponible', value: formatCurrency(financials.inventoryValue), detail: 'Valor estimado al costo', badge: 'Inventario', tone: 'neutral', to: '/inventario' },
    operatingExpenses: { icon: ReceiptText, label: `Gastos ${period.resultSuffix}`, value: formatCurrency(financials.operatingExpenses), detail: 'Gastos operativos registrados', badge: 'Gastos', tone: 'warning', to: '/gastos' },
    monthlyExpenseReserve: { icon: ReceiptText, label: 'Reserva mensual para gastos', value: formatCurrency(financials.monthlyExpenseReserve), detail: 'Presupuesto, no gasto duplicado', badge: 'Mensual', tone: 'neutral', to: '/gastos' },
    ordersTotal: { icon: TrendingUp, label: `Ventas registradas ${period.resultSuffix}`, value: formatCurrency(financials.ordersTotal), detail: 'Total facturado, cobrado o pendiente', badge: 'Ventas', tone: 'positive', to: '/ventas' },
    cashCollected: { icon: Banknote, label: `Efectivo cobrado ${period.collectedSuffix}`, value: formatCurrency(financials.cashCollected), detail: 'Pagos recibidos en efectivo', badge: 'Efectivo', tone: 'positive' },
    transferCollected: { icon: CircleDollarSign, label: `Transferencias ${period.collectedSuffix}`, value: formatCurrency(financials.transferCollected), detail: 'Pagos recibidos por transferencia', badge: 'Banco', tone: 'positive' },
    pendingDeliveries: { icon: Truck, label: 'Entregas pendientes', value: financials.pendingDeliveries, detail: 'Pedidos aún no entregados', badge: 'Delivery', tone: financials.pendingDeliveries > 0 ? 'warning' : 'positive', to: '/ventas' },
    availablePieces: { icon: PackageCheck, label: 'Piezas disponibles', value: summary.availablePieces, detail: 'Listas para vender', badge: 'Stock', tone: 'neutral', to: '/inventario' },
    damagedPieces: { icon: TriangleAlert, label: 'Piezas dañadas', value: summary.damagedPieces, detail: 'Requieren atención', badge: 'Revisar', tone: 'warning', to: '/productos-danados' },
  }
  const visibleKpis = data.settings.dashboardKpis.map((id) => kpiCards[id]).filter(Boolean).slice(0, 4)

  return (
    <div className="min-h-full bg-brand-50">
      <Topbar
        eyebrow="Mi tienda"
        title={`${greeting}${firstName ? ` ${firstName}` : ''}`}
        description="Este es el resumen de tu negocio"
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
            <span className="text-xs font-semibold text-slate-400">{period.label} · ventas, cobros y gastos</span>
          </div>
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 md:grid-cols-4 md:gap-4">
            {visibleKpis.map((card) => <SummaryCard key={card.label} {...card} />)}
          </div>
          <div className="mt-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-100">
            <label className="block font-bold text-slate-700">Paca para inversión y recuperación
              <select value={activeBales.some((bale) => bale.id === selectedBaleId) ? selectedBaleId : ''} onChange={(event) => setSelectedBaleId(event.target.value)} className="sale-input mt-2 max-w-md">
                {activeBales.length > 0 && <option value="">Automática: {automaticBale?.code} · {automaticBale?.availablePieces > 0 ? 'más antigua con existencias' : 'sin existencias'}</option>}
                {!activeBales.length && <option value="">Sin paca activa</option>}
                {activeBales.map((bale) => <option key={bale.id} value={bale.id}>{bale.code} · {formatCurrency(bale.purchaseCost + bale.acquisitionTransport + bale.otherExpenses)}</option>)}
              </select>
            </label>
            <p className="mt-2 text-xs text-slate-500">Hoy, semana y mes filtran ganancia, ventas, cobros y gastos por fecha (semana desde el lunes, hora de Nicaragua). Existencias, valor del inventario, daños, saldos y entregas pendientes muestran el estado actual; inversión y recuperación, el acumulado de la paca elegida. La reserva es un presupuesto mensual.</p>
            <p className="mt-2 text-xs text-slate-500">Los pedidos muestran todo el historial de la paca elegida, sin filtro de fecha. En automática se sigue la más antigua con existencias y, al agotarse, la siguiente; puedes seleccionar otra para consultar sus pedidos.</p>
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
          <section aria-labelledby="active-bale-title" key={activeBale?.id}>
            <div className="mb-3">
              <h2 id="active-bale-title" className="text-lg font-extrabold tracking-tight text-slate-900">
                Paca activa
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Sigue el avance de tu inversión actual</p>
            </div>
            {activeBale ? <ActiveBaleCard bale={activeBale} /> : <p className="rounded-2xl bg-white p-5 text-sm font-semibold text-slate-500">Aún no has registrado una paca.</p>}
          </section>

          <section aria-labelledby="recent-sales-title">
            <SectionTitle title={`Pedidos de ${activeBale?.code ?? 'esta paca'}`} linkTo={activeBale ? `/ventas?paca=${encodeURIComponent(activeBale.id)}` : '/ventas'} linkLabel="Ver todos" />
            <div className="mt-3 space-y-2.5">
              {baleSales.map((sale) => (
                <RecentSaleCard key={sale.id} sale={sale} />
              ))}
              {!isLoading && baleSales.length === 0 && <p className="rounded-2xl bg-white p-5 text-sm font-semibold text-slate-500">Esta paca aún no tiene pedidos registrados.</p>}
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

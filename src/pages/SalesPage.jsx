import { ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import RecentSaleCard from '../components/dashboard/RecentSaleCard'
import { usePacaData } from '../context/PacaDataContext'

function SalesPage() {
  const { data } = usePacaData()
  const recentSales = data.sales
  return (
    <div>
      <PageHeader
        eyebrow="Movimientos"
        title="Ventas"
        description="Revisa los movimientos recientes sin depender de tablas difíciles de leer."
      />
      <div className="page-content space-y-5 py-5 md:py-8">
        <Link
          to="/ventas/nueva"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-900 px-5 text-sm font-bold text-white transition hover:bg-brand-800 active:scale-[0.98] sm:w-fit"
        >
          <ShoppingBag aria-hidden="true" size={19} />
          Registrar venta
        </Link>
        <section aria-labelledby="sales-list-title" className="max-w-5xl">
          <h2 id="sales-list-title" className="mb-3 text-lg font-extrabold text-slate-900">
            Movimientos recientes
          </h2>
          <div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {recentSales.map((sale) => (
              <RecentSaleCard key={sale.id} sale={sale} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default SalesPage

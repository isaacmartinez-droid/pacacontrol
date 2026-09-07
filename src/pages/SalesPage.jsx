import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import RecentSaleCard from '../components/dashboard/RecentSaleCard'
import { usePacaData } from '../context/PacaDataContext'

function SalesPage() {
  const { data, updateSaleDeliveryStatus } = usePacaData()
  const recentSales = data.sales
  const [updatingSaleId, setUpdatingSaleId] = useState('')
  const [statusError, setStatusError] = useState('')

  async function handleAdvanceStatus(saleId, deliveryStatus) {
    setUpdatingSaleId(saleId)
    setStatusError('')

    try {
      await updateSaleDeliveryStatus(saleId, deliveryStatus)
    } catch (error) {
      setStatusError(error.message || 'No fue posible actualizar el estado del pedido.')
    } finally {
      setUpdatingSaleId('')
    }
  }

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
          <div className="mb-3">
            <h2 id="sales-list-title" className="text-lg font-extrabold text-slate-900">
              Seguimiento de pedidos
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Actualiza cada venta desde el pago hasta la entrega al cliente.
            </p>
          </div>
          {statusError && (
            <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {statusError}
            </p>
          )}
          <div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {recentSales.map((sale) => (
              <RecentSaleCard
                key={sale.id}
                sale={sale}
                onAdvanceStatus={handleAdvanceStatus}
                isUpdating={updatingSaleId === sale.id}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default SalesPage

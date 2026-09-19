import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import RecentSaleCard from '../components/dashboard/RecentSaleCard'
import { usePacaData } from '../context/PacaDataContext'
import { getBusinessTerms } from '../utils/businessProfile'
import { getBaleSales } from '../utils/baleFinancials'

function SalesPage() {
  const { data, updateSaleDeliveryStatus, completeSalePayment } = usePacaData()
  const terms = getBusinessTerms(data.businessProfile)
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('venta')
  const showArchived = searchParams.get('archivo') === '1'
  const baleId = searchParams.get('paca')
  const selectedBale = data.bales.find((bale) => bale.id === baleId)
  const scopedSales = baleId ? getBaleSales(data.sales, baleId) : data.sales
  const visibleSales = scopedSales.filter((sale) => Boolean(sale.isArchived) === showArchived)
  const selectedSale = selectedId ? scopedSales.find((sale) => sale.id === selectedId) : null
  const salesPath = (archived = false) => {
    const params = new URLSearchParams()
    if (baleId) params.set('paca', baleId)
    if (archived) params.set('archivo', '1')
    return `/ventas${params.size ? `?${params}` : ''}`
  }
  const recentSales = selectedSale
    ? [selectedSale, ...visibleSales.filter((sale) => sale.id !== selectedId)]
    : visibleSales
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

  async function handleConfirmPayment(saleId, paymentMethod) {
    setUpdatingSaleId(saleId)
    setStatusError('')
    try { await completeSalePayment(saleId, paymentMethod) }
    catch (error) { setStatusError(error.message || 'No fue posible actualizar el pago.') }
    finally { setUpdatingSaleId('') }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Ventas y entregas"
        title="Pedidos"
        description="Consulta, edita y da seguimiento a todos los pedidos del negocio."
      />
      <div className="page-content space-y-5 py-5 md:py-8">
        <Link
          to="/ventas/nueva"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-900 px-5 text-sm font-bold text-white transition hover:bg-brand-800 active:scale-[0.98] sm:w-fit"
        >
          <ShoppingBag aria-hidden="true" size={19} />
          Nueva venta
        </Link>
        <section aria-labelledby="sales-list-title" className="max-w-5xl">
          <label className="mb-4 block text-sm font-bold text-slate-700">{terms.purchaseSingular} de los pedidos
            <select className="sale-input mt-2 max-w-md" value={baleId ?? ''} onChange={(event) => {
              const params = new URLSearchParams(searchParams)
              params.delete('venta')
              if (event.target.value) params.set('paca', event.target.value)
              else params.delete('paca')
              const bale = data.bales.find((item) => item.id === event.target.value)
              if (bale) {
                if (bale.isArchived) params.set('archivo', '1')
                else params.delete('archivo')
              }
              setSearchParams(params)
            }}>
              <option value="">Todas las {terms.purchasePluralLower}</option>
              {baleId && !selectedBale && <option value={baleId}>Registro no disponible</option>}
              {data.bales.map((bale) => <option key={bale.id} value={bale.id}>{bale.code}{bale.isArchived ? ' · en archivo' : ''}</option>)}
            </select>
          </label>
          <nav className="mb-4 flex gap-2" aria-label="Archivo de pedidos">
            <Link to={salesPath()} className={`rounded-xl px-4 py-3 text-sm font-bold ${!showArchived ? 'bg-brand-900 text-white' : 'bg-white text-brand-900'}`}>Pedidos vigentes</Link>
            <Link to={salesPath(true)} className={`rounded-xl px-4 py-3 text-sm font-bold ${showArchived ? 'bg-brand-900 text-white' : 'bg-white text-brand-900'}`}>{terms.purchasePlural} en archivo</Link>
          </nav>
          {selectedSale && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-800"><span>El pedido seleccionado aparece primero; los demás continúan debajo.</span><Link to={salesPath(showArchived)} className="font-bold underline">Quitar selección</Link></div>}
          <div className="mb-3">
            <h2 id="sales-list-title" className="text-lg font-extrabold text-slate-900">
              {baleId ? `Pedidos de ${selectedBale?.code ?? 'la compra seleccionada'}` : showArchived ? `Historial de ${terms.purchasePluralLower} en archivo` : `Pedidos de ${terms.purchasePluralLower} vigentes`}
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              El pago se confirma por separado; solo los pedidos pagados avanzan a preparación y entrega.
            </p>
          </div>
          {statusError && (
            <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {statusError}
            </p>
          )}
          <div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {!recentSales.length && <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">No hay pedidos en esta sección.</p>}
            {selectedId && !selectedSale && <p className="rounded-2xl bg-white p-5 text-sm text-slate-600">El pedido seleccionado ya no está disponible. Estos son todos los demás pedidos.</p>}
            {recentSales.map((sale) => (
              <RecentSaleCard
                key={sale.id}
                sale={sale}
                onAdvanceStatus={handleAdvanceStatus}
                onConfirmPayment={handleConfirmPayment}
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

import { PackageCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { formatCurrency } from '../utils/currency'
import { getPricingLevel } from '../utils/pricing'

function InventoryPage() {
  const { data } = usePacaData()
  const [searchParams] = useSearchParams()
  const selectedId = searchParams.get('categoria')
  const clothingCategories = data.categories
  const visibleCategories = selectedId ? clothingCategories.filter((category) => category.id === selectedId) : clothingCategories
  const totalPieces = clothingCategories.reduce(
    (total, category) => total + category.availablePieces,
    0,
  )

  return (
    <div>
      <PageHeader
        eyebrow="Existencias"
        title="Inventario"
        description="Una vista clara de las prendas disponibles, agrupadas por categoría."
        backTo="/mas"
      />
      <div className="page-content space-y-5 py-5 md:py-8">
        <section className="max-w-3xl rounded-3xl bg-brand-900 p-5 text-white shadow-lg shadow-brand-900/15">
          <p className="text-sm font-medium text-brand-100">Total disponible</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <p className="text-4xl font-extrabold tracking-tight">{totalPieces}</p>
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand-100">
              <PackageCheck aria-hidden="true" size={16} />
              piezas listas
            </span>
          </div>
        </section>

        <section aria-labelledby="categories-title" className="max-w-4xl">
          {selectedId && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-800"><span>Categoría seleccionada desde la alerta</span><Link to="/inventario" className="font-bold underline">Ver todas las categorías</Link></div>}
          <h2 id="categories-title" className="mb-3 text-lg font-extrabold text-slate-900">
            Por categoría
          </h2>
          <div className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-slate-100">
            {selectedId && visibleCategories.length === 0 && <p className="p-5 text-sm text-slate-600">La categoría seleccionada no está disponible en los datos cargados.</p>}
            {visibleCategories.map((category, index) => {
              const categoryInventory = data.baleInventory.filter((inventory) => inventory.categoryId === category.id && inventory.availablePieces > 0)
              return <div key={category.id} className={index > 0 ? 'border-t border-slate-100' : ''}>
                <div className="flex min-h-14 items-center justify-between gap-4 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-sm font-extrabold text-brand-700">{category.name.charAt(0)}</span><p className="truncate text-sm font-semibold text-slate-700">{category.name}</p></div>
                  <p className="shrink-0 text-sm font-extrabold text-slate-900">{category.availablePieces} <span className="font-medium text-slate-400">pzas.</span></p>
                </div>
                {categoryInventory.length > 0 && <div className="space-y-2 bg-slate-50 px-5 py-3">{categoryInventory.map((inventory) => <div key={inventory.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-100"><div><p className="text-sm font-bold text-slate-800">{inventory.baleCode} · {inventory.availablePieces} disponibles</p><p className="mt-0.5 text-xs text-slate-500">Costo {formatCurrency(inventory.estimatedUnitCost)} · {getPricingLevel(inventory.priceLevel).label}</p></div><div className="text-right"><p className="text-xs text-slate-500">Sugerido</p><p className="font-extrabold text-brand-800">{formatCurrency(inventory.recommendedUnitPrice)}</p></div></div>)}</div>}
              </div>
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

export default InventoryPage

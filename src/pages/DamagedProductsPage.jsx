import { TriangleAlert } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'

function DamagedProductsPage() {
  const { data } = usePacaData()
  const damagedProducts = data.damagedProducts
  const damagedTotal = damagedProducts.reduce((total, item) => total + item.quantity, 0)

  return (
    <div>
      <PageHeader
        eyebrow="Mermas"
        title="Productos dañados"
        description="Consulta las prendas que no pueden venderse y el motivo registrado."
        backTo="/mas"
      />
      <div className="page-content grid items-start gap-5 py-5 md:py-8 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)] lg:gap-8">
        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-white text-amber-700 shadow-sm">
              <TriangleAlert aria-hidden="true" size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">Total identificado</p>
              <p className="text-2xl font-extrabold text-amber-950">{damagedTotal} piezas</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="damaged-list-title" className="max-w-3xl">
          <h2 id="damaged-list-title" className="mb-3 text-lg font-extrabold text-slate-900">
            Detalle por categoría
          </h2>
          <div className="space-y-2.5">
            {damagedProducts.map((item) => (
              <article
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800">{item.category}</h3>
                  <p className="mt-1 truncate text-xs text-slate-500">{item.reason}</p>
                </div>
                <span className="shrink-0 rounded-xl bg-amber-50 px-3 py-2 text-sm font-extrabold text-amber-800">
                  {item.quantity}
                </span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default DamagedProductsPage

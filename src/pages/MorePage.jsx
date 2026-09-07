import { BarChart3, ChevronRight, PackageSearch, PackageX, ReceiptText } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'

const modules = [
  {
    title: 'Inventario',
    description: 'Prendas disponibles por categoría',
    to: '/inventario',
    icon: PackageSearch,
    tone: 'brand',
  },
  {
    title: 'Gastos',
    description: 'Transporte y costos de la tienda',
    to: '/gastos',
    icon: ReceiptText,
    tone: 'coral',
  },
  {
    title: 'Productos dañados',
    description: 'Mermas y motivos registrados',
    to: '/productos-danados',
    icon: PackageX,
    tone: 'amber',
  },
  {
    title: 'Reportes y ganancias',
    description: 'Rendimiento de tus inversiones',
    to: '/reportes',
    icon: BarChart3,
    tone: 'emerald',
  },
]

const toneClasses = {
  brand: 'bg-brand-50 text-brand-700',
  coral: 'bg-coral-50 text-coral-600',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
}

function MorePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Herramientas"
        title="Más"
        description="Todo lo que necesitas para administrar la tienda desde un solo lugar."
      />
      <div className="page-content py-5 md:py-8">
        <nav aria-label="Módulos adicionales" className="max-w-5xl space-y-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
          {modules.map((module) => {
            const Icon = module.icon

            return (
              <Link
                key={module.to}
                to={module.to}
                className="group flex min-h-20 items-center gap-4 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100 transition hover:bg-slate-50 active:scale-[0.98]"
              >
                <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${toneClasses[module.tone]}`}>
                  <Icon aria-hidden="true" size={23} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold text-slate-900">{module.title}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{module.description}</span>
                </span>
                <ChevronRight aria-hidden="true" className="shrink-0 text-slate-300 transition group-hover:text-brand-600" size={20} />
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export default MorePage

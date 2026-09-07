import { useState } from 'react'
import { BarChart3, Bell, ChevronRight, CircleAlert, LoaderCircle, LogOut, PackageSearch, PackageX, ReceiptText, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import { useAuth } from '../context/AuthContext'

const modules = [
  {
    title: 'Alertas',
    description: 'Avisos automáticos y límites de tu tienda',
    to: '/alertas',
    icon: Bell,
    tone: 'brand',
  },
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
  const { user, signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const username = user?.user_metadata?.username ?? user?.email?.split('@')[0]

  async function handleSignOut() {
    setIsSigningOut(true)
    setSignOutError('')

    try {
      await signOut()
    } catch (error) {
      setSignOutError(error.message || 'No fue posible cerrar la sesión.')
      setIsSigningOut(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Herramientas"
        title="Más"
        description="Todo lo que necesitas para administrar la tienda desde un solo lugar."
      />
      <div className="page-content space-y-6 py-5 md:py-8">
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

        <section className="max-w-5xl rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <UserRound aria-hidden="true" size={21} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">Sesión actual</p>
              <p className="truncate text-sm font-extrabold text-slate-900">{username}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSigningOut}
            onClick={handleSignOut}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-coral-100 bg-coral-50 px-5 text-sm font-extrabold text-coral-600 transition hover:bg-coral-100 active:scale-[0.98] disabled:opacity-60 sm:mt-0 sm:w-auto"
          >
            {isSigningOut ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : <LogOut aria-hidden="true" size={18} />}
            {isSigningOut ? 'Cerrando…' : 'Cerrar sesión'}
          </button>

          {signOutError && (
            <p role="alert" className="mt-3 flex gap-2 text-sm font-semibold text-coral-600 sm:basis-full">
              <CircleAlert aria-hidden="true" className="shrink-0" size={18} />
              {signOutError}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

export default MorePage

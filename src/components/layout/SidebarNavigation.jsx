import { CircleCheck, LogOut, UserRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { isNavigationItemActive, navigationItems } from './navigation'
import { useAuth } from '../../context/AuthContext'
import BrandLogo from '../common/BrandLogo'

function SidebarNavigation() {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const username = user?.user_metadata?.username ?? user?.email?.split('@')[0]

  return (
    <aside className="sticky top-0 hidden h-dvh w-[4.75rem] shrink-0 flex-col border-r border-brand-800 bg-brand-950 px-3 py-5 text-white shadow-xl shadow-brand-950/10 lg:flex xl:w-72 xl:px-4 xl:py-6">
      <Link
        to="/"
        aria-label="Tienda J&F, inicio"
        className="flex min-h-14 items-center justify-center gap-3 rounded-2xl px-0 focus-visible:outline-offset-2 xl:justify-start xl:px-2"
      >
        <span className="size-11 shrink-0 overflow-hidden rounded-2xl bg-white shadow-lg shadow-black/10">
          <BrandLogo />
        </span>
        <span className="hidden xl:block">
          <span className="block text-lg font-extrabold tracking-tight text-white">Tienda J&amp;F</span>
          <span className="block text-xs font-medium text-brand-200">Mi tienda</span>
        </span>
      </Link>

      <nav aria-label="Navegación principal" className="mt-9">
        <p className="hidden px-3 text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-brand-300 xl:block">
          Menú principal
        </p>
        <ul className="space-y-2 xl:mt-3 xl:space-y-1.5">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = isNavigationItemActive(item, pathname)

            return (
              <li key={item.label}>
                <Link
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  title={item.label}
                  className={`group flex min-h-12 items-center justify-center gap-3 rounded-2xl px-2 text-sm font-bold transition active:scale-[0.98] xl:justify-start xl:px-3 ${
                    isActive
                      ? 'bg-white/12 text-white shadow-md shadow-black/10 ring-1 ring-white/10'
                      : 'text-brand-100 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-xl transition ${
                      isActive
                        ? 'bg-white/12 text-white'
                        : 'bg-white/5 text-brand-200 group-hover:bg-white/10 group-hover:text-white'
                    }`}
                  >
                    <Icon aria-hidden="true" size={18} strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  <span className="hidden truncate xl:block">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mt-auto rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10 xl:p-4">
        <p className="flex items-center justify-center gap-2 text-xs font-bold text-white xl:justify-start">
          <CircleCheck aria-hidden="true" size={16} />
          <span className="hidden xl:inline">Negocio al día</span>
        </p>
        <p className="mt-2 hidden text-xs leading-5 text-brand-100 xl:block">
          Datos protegidos en la nube.
        </p>
        <div className="mt-3 hidden border-t border-white/10 pt-3 xl:block">
          <p className="flex min-w-0 items-center gap-2 text-xs font-semibold text-brand-100">
            <UserRound aria-hidden="true" size={14} />
            <span className="truncate">{username}</span>
          </p>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-extrabold text-white transition hover:bg-white/15"
          >
            <LogOut aria-hidden="true" size={15} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  )
}

export default SidebarNavigation

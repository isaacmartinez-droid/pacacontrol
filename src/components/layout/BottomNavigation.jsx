import { Link, useLocation } from 'react-router-dom'
import { isNavigationItemActive, navigationItems } from './navigation'

function BottomNavigation() {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Navegación principal"
      className="bottom-navigation fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/95 px-2 pt-2 shadow-nav backdrop-blur-lg lg:hidden"
    >
      <ul className="grid grid-cols-5 items-end">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = isNavigationItemActive(item, pathname)

          return (
            <li key={item.label} className="flex justify-center">
              <Link
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={
                  item.featured
                    ? 'group -mt-6 flex min-h-16 w-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl bg-brand-900 text-white shadow-lg shadow-brand-900/20 transition hover:bg-brand-800 active:scale-95'
                    : `flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl text-[0.69rem] font-semibold transition active:scale-95 ${
                        isActive
                          ? 'text-brand-800'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                      }`
                }
              >
                <Icon
                  aria-hidden="true"
                  size={item.featured ? 25 : 21}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default BottomNavigation

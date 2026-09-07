import { CircleAlert, RefreshCw } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { usePacaData } from '../../context/PacaDataContext'
import BottomNavigation from './BottomNavigation'
import SidebarNavigation from './SidebarNavigation'

function AppShell() {
  const { error, isLoading, refresh } = usePacaData()

  return (
    <div className="app-shell relative overflow-x-hidden bg-[#edf3f1] lg:flex lg:overflow-visible">
      <SidebarNavigation />
      <main className="app-content min-w-0 flex-1">
        {error && (
          <div className="page-content pt-4">
            <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-coral-100 bg-coral-50 p-4 text-coral-600 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-extrabold">No pudimos cargar los datos de tu tienda.</p>
                  <p className="mt-1 break-words text-xs leading-5">{error}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={refresh}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-extrabold shadow-sm ring-1 ring-coral-100 disabled:opacity-60"
              >
                <RefreshCw aria-hidden="true" className={isLoading ? 'animate-spin' : ''} size={15} />
                Reintentar
              </button>
            </div>
          </div>
        )}
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  )
}

export default AppShell

import { Outlet } from 'react-router-dom'
import BottomNavigation from './BottomNavigation'
import SidebarNavigation from './SidebarNavigation'

function AppShell() {
  return (
    <div className="app-shell relative overflow-x-hidden bg-[#edf3f1] lg:flex lg:overflow-visible">
      <SidebarNavigation />
      <main className="app-content min-w-0 flex-1">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  )
}

export default AppShell

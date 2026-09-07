import { Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import AuthPage from './pages/AuthPage'
import BalesPage from './pages/BalesPage'
import CustomersPage from './pages/CustomersPage'
import DamagedProductsPage from './pages/DamagedProductsPage'
import DashboardPage from './pages/DashboardPage'
import ExpensesPage from './pages/ExpensesPage'
import InventoryPage from './pages/InventoryPage'
import MorePage from './pages/MorePage'
import NewBalePage from './pages/NewBalePage'
import NewSalePage from './pages/NewSalePage'
import NotFoundPage from './pages/NotFoundPage'
import ReportsPage from './pages/ReportsPage'
import SalesPage from './pages/SalesPage'

function App() {
  return (
    <Routes>
      <Route path="acceder" element={<AuthPage />} />
      <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="pacas" element={<BalesPage />} />
        <Route path="pacas/nueva" element={<NewBalePage />} />
        <Route path="inventario" element={<InventoryPage />} />
        <Route path="ventas/nueva" element={<NewSalePage />} />
        <Route path="ventas" element={<SalesPage />} />
        <Route path="clientes" element={<CustomersPage />} />
        <Route path="gastos" element={<ExpensesPage />} />
        <Route path="productos-danados" element={<DamagedProductsPage />} />
        <Route path="reportes" element={<ReportsPage />} />
        <Route path="mas" element={<MorePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      </Route>
    </Routes>
  )
}

export default App

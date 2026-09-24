import { Outlet, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/auth/ProtectedRoute'
import BusinessAccountRoute from './components/auth/BusinessAccountRoute'
import BusinessOnboardingGate from './components/auth/BusinessOnboardingGate'
import AppShell from './components/layout/AppShell'
import { AlertsProvider } from './context/AlertsContext'
import { PacaDataProvider } from './context/PacaDataContext'
import AuthPage from './pages/AuthPage'
import BalesPage from './pages/BalesPage'
import CustomersPage from './pages/CustomersPage'
import CustomerDetailPage from './pages/CustomerDetailPage'
import DamagedProductsPage from './pages/DamagedProductsPage'
import DashboardPage from './pages/DashboardPage'
import ExpensesPage from './pages/ExpensesPage'
import CashReconciliationPage from './pages/CashReconciliationPage'
import HistoryPage from './pages/HistoryPage'
import InventoryPage from './pages/InventoryPage'
import LegalPage from './pages/LegalPage'
import MorePage from './pages/MorePage'
import NewBalePage from './pages/NewBalePage'
import NewCustomerPage from './pages/NewCustomerPage'
import NewSalePage from './pages/NewSalePage'
import NotFoundPage from './pages/NotFoundPage'
import ReportsPage from './pages/ReportsPage'
import SalesPage from './pages/SalesPage'
import AlertsPage from './pages/AlertsPage'
import BusinessPreferencesPage from './pages/BusinessPreferencesPage'
import SettingsPage from './pages/SettingsPage'
import BusinessOnboardingPage from './pages/BusinessOnboardingPage'
import EditBalePage from './pages/EditBalePage'
import EditCustomerPage from './pages/EditCustomerPage'
import EditSalePage from './pages/EditSalePage'
import ActivateAccountPage from './pages/ActivateAccountPage'
import GettingStartedPage from './pages/GettingStartedPage'
import ProductIntroductionPage from './pages/ProductIntroductionPage'

function StoreDataShell() {
  return (
    <PacaDataProvider>
      <Outlet />
    </PacaDataProvider>
  )
}

function StoreShell() {
  return <AlertsProvider><AppShell /></AlertsProvider>
}

function App() {
  return (
    <Routes>
      <Route path="acceder" element={<AuthPage />} />
      <Route path="bienvenida/:token" element={<ActivateAccountPage />} />
      <Route path="activar" element={<ActivateAccountPage />} />
      <Route path="legal" element={<LegalPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<BusinessAccountRoute />}>
          <Route element={<StoreDataShell />}>
            <Route path="configurar-negocio" element={<BusinessOnboardingPage />} />
            <Route element={<BusinessOnboardingGate />}>
              <Route path="recorrido-inicial" element={<ProductIntroductionPage />} />
              <Route element={<StoreShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="pacas" element={<BalesPage />} />
                <Route path="pacas/nueva" element={<NewBalePage />} />
                <Route path="pacas/:baleId/editar" element={<EditBalePage />} />
                <Route path="inventario" element={<InventoryPage />} />
                <Route path="ventas/nueva" element={<NewSalePage />} />
                <Route path="ventas/:saleId/editar" element={<EditSalePage />} />
                <Route path="ventas" element={<SalesPage />} />
                <Route path="clientes/nuevo" element={<NewCustomerPage />} />
                <Route path="clientes" element={<CustomersPage />} />
                <Route path="clientes/:customerId" element={<CustomerDetailPage />} />
                <Route path="clientes/:customerId/editar" element={<EditCustomerPage />} />
                <Route path="gastos" element={<ExpensesPage />} />
                <Route path="caja" element={<CashReconciliationPage />} />
                <Route path="historial" element={<HistoryPage />} />
                <Route path="productos-danados" element={<DamagedProductsPage />} />
                <Route path="reportes" element={<ReportsPage />} />
                <Route path="mas" element={<MorePage />} />
                <Route path="primeros-pasos" element={<GettingStartedPage />} />
                <Route path="alertas" element={<AlertsPage />} />
                <Route path="preferencias" element={<BusinessPreferencesPage />} />
                <Route path="ajustes" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App

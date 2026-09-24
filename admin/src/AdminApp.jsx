import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../../src/components/auth/ProtectedRoute'
import { AdminDataProvider } from './AdminDataContext'
import AdminOnlyRoute from './AdminOnlyRoute'
import AdminShell from './AdminShell'
import AdminSignInPage from './AdminSignInPage'

const AdminAccountDetailPage = lazy(() => import('./pages/AdminAccountDetailPage'))
const AdminAccountsPage = lazy(() => import('./pages/AdminAccountsPage'))
const AdminNewAccountPage = lazy(() => import('./pages/AdminNewAccountPage'))
const AdminAlertsPage = lazy(() => import('./pages/AdminAlertsPage'))
const AdminBillingPage = lazy(() => import('./pages/AdminBillingPage'))
const AdminOverviewPage = lazy(() => import('./pages/AdminOverviewPage'))
const AdminSystemPage = lazy(() => import('./pages/AdminSystemPage'))

function AdminApp() {
  return (
    <Routes>
      <Route path="acceder" element={<AdminSignInPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminOnlyRoute />}>
          <Route element={<AdminDataProvider><AdminShell /></AdminDataProvider>}>
            <Route index element={<LazyPage><AdminOverviewPage /></LazyPage>} />
            <Route path="cuentas" element={<LazyPage><AdminAccountsPage /></LazyPage>} />
            <Route path="cuentas/nueva" element={<LazyPage><AdminNewAccountPage /></LazyPage>} />
            <Route path="cuentas/:accountId" element={<LazyPage><AdminAccountDetailPage /></LazyPage>} />
            <Route path="alertas" element={<LazyPage><AdminAlertsPage /></LazyPage>} />
            <Route path="cobros" element={<LazyPage><AdminBillingPage /></LazyPage>} />
            <Route path="sistema" element={<LazyPage><AdminSystemPage /></LazyPage>} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function LazyPage({ children }) {
  return <Suspense fallback={<div className="grid min-h-48 place-items-center text-sm font-extrabold text-brand-800">Cargando módulo…</div>}>{children}</Suspense>
}

export default AdminApp

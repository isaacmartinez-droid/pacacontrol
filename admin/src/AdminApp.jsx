import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../../src/components/auth/ProtectedRoute'
import AdminPage from './AdminPage'
import AdminOnlyRoute from './AdminOnlyRoute'
import AdminSignInPage from './AdminSignInPage'

function AdminApp() {
  return (
    <Routes>
      <Route path="acceder" element={<AdminSignInPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminOnlyRoute />}>
          <Route index element={<AdminPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default AdminApp

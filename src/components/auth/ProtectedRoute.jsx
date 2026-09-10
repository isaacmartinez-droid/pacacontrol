import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

function ProtectedRoute() {
  const { isConfigured, isLoading, user } = useAuth()
  const location = useLocation()

  if (!isConfigured) {
    return <Navigate to="/acceder" replace state={{ from: location.pathname }} />
  }

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-brand-50 px-4 text-center text-sm font-bold text-brand-800">
        Cargando tu tienda…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/acceder" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export default ProtectedRoute

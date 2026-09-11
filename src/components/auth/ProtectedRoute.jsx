import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LegalConsentGate from './LegalConsentGate'

function ProtectedRoute() {
  const {
    hasAcceptedCurrentLegal,
    isAccessActive,
    isConfigured,
    isLoading,
    isProfileLoading,
    profileError,
    user,
  } = useAuth()
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

  if (isProfileLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-brand-50 px-4 text-center text-sm font-bold text-brand-800">
        Verificando tu acceso…
      </div>
    )
  }

  if (profileError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-brand-50 px-4">
        <div role="alert" className="max-w-md rounded-3xl bg-white p-6 text-center shadow-soft ring-1 ring-coral-100">
          <h1 className="text-xl font-extrabold text-slate-950">No pudimos verificar tu cuenta</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{profileError}</p>
        </div>
      </div>
    )
  }

  if (!isAccessActive) {
    return (
      <div className="grid min-h-dvh place-items-center bg-brand-50 px-4">
        <div className="max-w-md rounded-3xl bg-white p-6 text-center shadow-soft ring-1 ring-amber-100">
          <h1 className="text-xl font-extrabold text-slate-950">Acceso pausado</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Esta cuenta esta suspendida o cerrada. Contacta al administrador para revisar pagos, condiciones del servicio o reactivacion.
          </p>
        </div>
      </div>
    )
  }

  if (!hasAcceptedCurrentLegal) return <LegalConsentGate />

  return <Outlet />
}

export default ProtectedRoute

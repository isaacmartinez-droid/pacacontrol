import { CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { usePacaData } from '../../context/PacaDataContext'

export default function BusinessOnboardingGate() {
  const { data, error, isLoading, refresh } = usePacaData()
  const location = useLocation()

  if (isLoading && !data.businessProfile) {
    return (
      <div className="grid min-h-dvh place-items-center bg-brand-50 px-5 text-center">
        <div><LoaderCircle className="mx-auto animate-spin text-brand-700" size={30} /><p className="mt-3 text-sm font-bold text-brand-900">Preparando tu espacio…</p></div>
      </div>
    )
  }

  if (!data.businessProfile) {
    return (
      <div className="grid min-h-dvh place-items-center bg-brand-50 px-5">
        <div role="alert" className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-soft ring-1 ring-coral-100">
          <CircleAlert className="mx-auto text-coral-600" size={30} />
          <h1 className="mt-4 text-xl font-extrabold text-slate-950">No pudimos cargar la configuración</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{error || 'No encontramos el perfil de este negocio.'}</p>
          <button type="button" onClick={() => refresh()} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-900 px-5 text-sm font-extrabold text-white">
            <RefreshCw size={17} />Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (data.businessProfile.onboardingStatus !== 'completed') {
    return <Navigate to="/configurar-negocio" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

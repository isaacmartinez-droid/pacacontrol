import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { normalizePortalUrl } from '../../utils/portalUrl'

function BusinessAccountRoute() {
  const { isAdmin, signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const adminPortalUrl = useMemo(
    () => normalizePortalUrl(import.meta.env.VITE_ADMIN_APP_URL),
    [],
  )

  useEffect(() => {
    if (isAdmin && adminPortalUrl) window.location.replace(adminPortalUrl)
  }, [adminPortalUrl, isAdmin])

  if (!isAdmin) return <Outlet />

  return (
    <main className="grid min-h-dvh place-items-center bg-brand-50 px-4 py-8">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-soft ring-1 ring-brand-100 sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-950 text-white">
          <ShieldCheck aria-hidden="true" size={26} />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-slate-950">Esta es una cuenta administrativa</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          La administración utiliza un portal independiente de la aplicación de los negocios.
        </p>

        {adminPortalUrl ? (
          <a href={adminPortalUrl} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white">
            <ExternalLink aria-hidden="true" size={18} />
            Abrir portal administrativo
          </a>
        ) : (
          <p role="alert" className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
            El portal administrativo todavía no está configurado en este entorno.
          </p>
        )}

        <button
          type="button"
          disabled={isSigningOut}
          onClick={async () => {
            setIsSigningOut(true)
            try { await signOut() } finally { setIsSigningOut(false) }
          }}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
        >
          {isSigningOut ? <LoaderCircle className="animate-spin" size={18} /> : <LogOut aria-hidden="true" size={18} />}
          Cerrar sesión
        </button>
      </section>
    </main>
  )
}

export default BusinessAccountRoute

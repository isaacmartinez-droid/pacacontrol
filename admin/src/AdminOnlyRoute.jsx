import { ExternalLink, LoaderCircle, LogOut, ShieldX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../src/context/AuthContext'
import { normalizePortalUrl } from '../../src/utils/portalUrl'

function AdminOnlyRoute() {
  const { isAdmin, signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const customerAppUrl = useMemo(
    () => normalizePortalUrl(import.meta.env.VITE_CUSTOMER_APP_URL),
    [],
  )

  if (isAdmin) return <Outlet />

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 px-4 py-8">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-700">
          <ShieldX aria-hidden="true" size={27} />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-slate-950">Acceso administrativo requerido</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Esta cuenta pertenece a un negocio y no tiene permisos para utilizar el portal interno.
        </p>
        {customerAppUrl && (
          <a href={customerAppUrl} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white">
            <ExternalLink aria-hidden="true" size={18} />
            Abrir aplicación comercial
          </a>
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

export default AdminOnlyRoute

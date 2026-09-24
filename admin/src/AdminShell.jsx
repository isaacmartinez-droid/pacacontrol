import { BellRing, Building2, CreditCard, Gauge, HeartPulse, LoaderCircle, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BrandWordmark } from '../../src/components/common/BrandLogo'
import { useAuth } from '../../src/context/AuthContext'

const navigation = [
  { to: '/', label: 'Resumen', icon: Gauge, end: true },
  { to: '/cuentas', label: 'Cuentas', icon: Building2 },
  { to: '/alertas', label: 'Alertas', icon: BellRing },
  { to: '/cobros', label: 'Cobros', icon: CreditCard },
  { to: '/sistema', label: 'Sistema', icon: HeartPulse },
]

function AdminShell() {
  const { profile, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    try { await signOut() } finally { setIsSigningOut(false) }
  }

  return (
    <div className="min-h-dvh bg-slate-50 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className={`${menuOpen ? 'fixed inset-0 z-40 flex' : 'hidden'} bg-slate-950 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col`}>
        <div className="flex w-full max-w-[18rem] flex-col bg-slate-950 p-4 lg:max-w-none lg:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <BrandWordmark surface="dark" className="h-8 w-auto max-w-[13rem]" />
              <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-200">Centro de control</p>
            </div>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Cerrar navegación" className="grid size-10 place-items-center rounded-xl text-slate-300 hover:bg-white/10 lg:hidden"><X size={21} /></button>
          </div>

          <nav aria-label="Navegación administrativa" className="mt-8 space-y-1">
            {navigation.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-extrabold transition ${isActive ? 'bg-white text-brand-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                <Icon aria-hidden="true" size={19} />{label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto border-t border-white/10 pt-4">
            <p className="truncate text-sm font-extrabold">{profile?.display_name || 'Administrador'}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">Acceso interno</p>
            <button type="button" onClick={handleSignOut} disabled={isSigningOut} className="mt-4 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-60">
              {isSigningOut ? <LoaderCircle className="animate-spin" size={19} /> : <LogOut aria-hidden="true" size={19} />}Cerrar sesión
            </button>
          </div>
        </div>
        <button type="button" aria-label="Cerrar navegación" onClick={() => setMenuOpen(false)} className="flex-1 bg-slate-950/70 lg:hidden" />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir navegación" className="grid size-10 place-items-center rounded-xl text-slate-700 hover:bg-slate-100 lg:hidden"><Menu size={22} /></button>
            <div><p className="text-sm font-extrabold text-slate-950">Administración</p><p className="hidden text-xs font-semibold text-slate-500 sm:block">Cuentas, acceso, cobros y salud operativa</p></div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-800 ring-1 ring-emerald-200"><span className="size-2 rounded-full bg-emerald-500" />Sesión protegida</span>
        </header>
        <main className="mx-auto w-full max-w-[96rem] p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  )
}

export default AdminShell

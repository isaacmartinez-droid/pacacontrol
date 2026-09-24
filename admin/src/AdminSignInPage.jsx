import { CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../src/context/AuthContext'

function AdminSignInPage() {
  const { isConfigured, isLoading, isProfileLoading, signIn, user } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (user && isProfileLoading) {
    return <main className="grid min-h-dvh place-items-center bg-slate-950 px-4 text-sm font-bold text-white">Verificando acceso administrativo…</main>
  }
  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await signIn({ username, password })
    } catch (nextError) {
      setError(nextError?.code === 'invalid_credentials' ? 'Usuario o contraseña incorrectos.' : nextError?.message || 'No fue posible iniciar sesión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 px-4 py-8">
      <section className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-white/10">
        <div className="bg-brand-950 p-6 text-white sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-950"><ShieldCheck aria-hidden="true" size={25} /></span>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-200">Acceso interno</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">ControlShop</h1>
          <p className="mt-2 text-sm leading-6 text-brand-100">Portal administrativo para cuentas, planes, accesos y vencimientos.</p>
        </div>
        <div className="p-6 sm:p-8">
          {!isConfigured ? (
            <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">Falta configurar la conexión de Supabase para este portal.</p>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm font-bold text-slate-700">
                Usuario administrador
                <input className="sale-input mt-2" type="text" autoComplete="username" autoCapitalize="none" spellCheck="false" pattern="[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+" placeholder="nombre.apellido" value={username} required onChange={(event) => { setUsername(event.target.value); setError('') }} />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Contraseña
                <span className="relative mt-2 block">
                  <input className="sale-input pr-12" type={showPassword ? 'text' : 'password'} minLength="6" autoComplete="current-password" value={password} required onChange={(event) => { setPassword(event.target.value); setError('') }} />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500 hover:text-brand-800">{showPassword ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}</button>
                </span>
              </label>
              {error && <p role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"><CircleAlert className="shrink-0" size={18} />{error}</p>}
              <button type="submit" disabled={isLoading || isSubmitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white hover:bg-brand-900 disabled:opacity-60">
                {isSubmitting ? <LoaderCircle className="animate-spin" size={18} /> : <LockKeyhole aria-hidden="true" size={18} />}
                Ingresar al portal
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}

export default AdminSignInPage

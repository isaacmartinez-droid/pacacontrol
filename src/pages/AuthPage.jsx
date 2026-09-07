import { useState } from 'react'
import { CircleAlert, LoaderCircle, LockKeyhole, Store, UserPlus } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function AuthPage() {
  const { isConfigured, isLoading, signIn, signInWithGoogle, signUp, user } = useAuth()
  const location = useLocation()
  const [isRegistering, setIsRegistering] = useState(false)
  const [form, setForm] = useState({ displayName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const destination = location.state?.from || '/'

  if (user) return <Navigate to={destination} replace />

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
    setMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)

    try {
      if (isRegistering) {
        const data = await signUp(form)
        setMessage(
          data.session
            ? 'Cuenta creada. Ya puedes comenzar a registrar tu inventario.'
            : 'Cuenta creada. Revisa tu correo y confirma el acceso para continuar.',
        )
      } else {
        await signIn(form)
      }
    } catch (nextError) {
      setError(nextError.message || 'No fue posible completar el acceso.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleSignIn() {
    setError('')
    setIsSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (nextError) {
      setError(nextError.message || 'No fue posible iniciar sesión con Google.')
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#edf3f1] px-4 py-8">
      <section className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-slate-100">
        <div className="bg-brand-950 p-6 text-white sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-950">
            <Store aria-hidden="true" size={24} />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">PacaControl</h1>
          <p className="mt-2 text-sm leading-6 text-brand-100">Tu inventario y ventas, protegidos en la nube.</p>
        </div>

        <div className="p-6 sm:p-8">
          {!isConfigured ? (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Falta configurar la clave publicable de Supabase en <code>.env.local</code>. Guarda el archivo y reinicia Vite.
            </p>
          ) : (
            <>
              <h2 className="text-xl font-extrabold text-slate-900">{isRegistering ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</h2>
              <p className="mt-1 text-sm text-slate-500">{isRegistering ? 'Usa tu correo para proteger los datos de tu tienda.' : 'Inicia sesión para continuar.'}</p>

              <button
                type="button"
                disabled={isLoading || isSubmitting}
                onClick={handleGoogleSignIn}
                className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GoogleMark />
                Continuar con Google
              </button>

              <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400"><span className="h-px flex-1 bg-slate-200" />o con correo<span className="h-px flex-1 bg-slate-200" /></div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {isRegistering && (
                  <label className="block text-sm font-bold text-slate-700">
                    Tu nombre
                    <input className="sale-input mt-2" value={form.displayName} required onChange={(event) => update('displayName', event.target.value)} />
                  </label>
                )}
                <label className="block text-sm font-bold text-slate-700">
                  Correo electrónico
                  <input className="sale-input mt-2" type="email" autoComplete="email" value={form.email} required onChange={(event) => update('email', event.target.value)} />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Contraseña
                  <input className="sale-input mt-2" type="password" minLength="6" autoComplete={isRegistering ? 'new-password' : 'current-password'} value={form.password} required onChange={(event) => update('password', event.target.value)} />
                </label>

                {error && <p role="alert" className="flex gap-2 rounded-xl bg-coral-50 p-3 text-sm font-semibold text-coral-600"><CircleAlert aria-hidden="true" size={18} />{error}</p>}
                {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p>}

                <button type="submit" disabled={isLoading || isSubmitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : isRegistering ? <UserPlus aria-hidden="true" size={18} /> : <LockKeyhole aria-hidden="true" size={18} />}
                  {isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}
                </button>
              </form>

              <button type="button" className="mt-5 w-full text-sm font-bold text-brand-700 hover:underline" onClick={() => { setIsRegistering((value) => !value); setError(''); setMessage('') }}>
                {isRegistering ? 'Ya tengo cuenta' : 'Crear mi primera cuenta'}
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export default AuthPage

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h5.23a4.47 4.47 0 0 1-1.94 2.93v2.79h3.6c2.1-1.94 3.31-4.8 3.31-7.75Z" />
      <path fill="#34A853" d="M12 21.75c2.62 0 4.82-.87 6.43-2.36l-3.6-2.79c-1 .67-2.28 1.06-3.83 1.06-2.94 0-5.43-1.99-6.32-4.66H.96v2.88A9.75 9.75 0 0 0 12 21.75Z" />
      <path fill="#FBBC05" d="M5.68 13c-.23-.67-.36-1.4-.36-2.13s.13-1.46.36-2.13V5.86H.96A9.75 9.75 0 0 0 .96 15.88L5.68 13Z" />
      <path fill="#EA4335" d="M12 4.08c1.7 0 3.23.59 4.43 1.75l3.32-3.32C16.82.77 14.62 0 12 0A9.75 9.75 0 0 0 .96 5.86l4.72 2.88C6.57 6.07 9.06 4.08 12 4.08Z" />
    </svg>
  )
}

import { useState } from 'react'
import { CircleAlert, LoaderCircle, LockKeyhole, Store, UserPlus } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function AuthPage() {
  const { isConfigured, isLoading, signIn, signUp, user } = useAuth()
  const location = useLocation()
  const [isRegistering, setIsRegistering] = useState(false)
  const [form, setForm] = useState({ username: '', password: '' })
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
            : 'Cuenta creada, pero Supabase requiere confirmación. Desactiva Confirm email para usar usuarios sin correo.',
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
              <p className="mt-1 text-sm text-slate-500">{isRegistering ? 'Elige un usuario con el formato nombre.apellido.' : 'Ingresa con tu usuario y contraseña.'}</p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <label className="block text-sm font-bold text-slate-700">
                  Usuario
                  <input
                    className="sale-input mt-2"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    pattern="[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+"
                    title="Usa el formato nombre.apellido, sin espacios ni tildes."
                    placeholder="nombre.apellido"
                    value={form.username}
                    required
                    onChange={(event) => update('username', event.target.value)}
                  />
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

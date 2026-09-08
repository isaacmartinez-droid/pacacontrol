import { useMemo, useState } from 'react'
import { CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, Store, UserPlus } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function AuthPage() {
  const { isConfigured, isLoading, signIn, signUp, user } = useAuth()
  const location = useLocation()
  const [isRegistering, setIsRegistering] = useState(false)
  const [form, setForm] = useState({ username: '', firstName: '', lastName: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const destination = location.state?.from || '/'
  const generatedUsername = useMemo(
    () => buildUsername(form.firstName, form.lastName),
    [form.firstName, form.lastName],
  )

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
        const data = await signUp({ ...form, username: generatedUsername })
        setMessage(
          data.session
            ? 'Cuenta creada. Ya puedes comenzar a registrar tu inventario.'
            : 'Cuenta creada, pero Supabase requiere confirmación. Desactiva Confirm email para usar usuarios sin correo.',
        )
      } else {
        await signIn(form)
      }
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError, isRegistering))
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
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Tienda J&amp;F</h1>
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
              <p className="mt-1 text-sm text-slate-500">{isRegistering ? 'Escribe tu nombre y apellido; generaremos tu usuario automáticamente.' : 'Ingresa con tu usuario y contraseña.'}</p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                {isRegistering ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-bold text-slate-700">Nombre<input className="sale-input mt-2" autoComplete="given-name" value={form.firstName} required onChange={(event) => update('firstName', event.target.value)} /></label>
                      <label className="block text-sm font-bold text-slate-700">Apellido<input className="sale-input mt-2" autoComplete="family-name" value={form.lastName} required onChange={(event) => update('lastName', event.target.value)} /></label>
                    </div>
                    <label className="block text-sm font-bold text-slate-700">Usuario generado<input className="sale-input mt-2 bg-brand-50" type="text" autoComplete="username" value={generatedUsername} readOnly aria-describedby="generated-username-help" /></label>
                    <p id="generated-username-help" className="-mt-2 text-xs text-slate-500">Se crea como nombre.apellido, sin espacios ni tildes.</p>
                  </>
                ) : (
                  <label className="block text-sm font-bold text-slate-700">Usuario<input className="sale-input mt-2" type="text" autoComplete="username" autoCapitalize="none" spellCheck="false" pattern="[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+" title="Usa el formato nombre.apellido, sin espacios ni tildes." placeholder="nombre.apellido" value={form.username} required onChange={(event) => update('username', event.target.value)} /></label>
                )}
                <label className="block text-sm font-bold text-slate-700">
                  Contraseña
                  <span className="relative mt-2 block"><input className="sale-input pr-12" type={showPassword ? 'text' : 'password'} minLength="6" autoComplete={isRegistering ? 'new-password' : 'current-password'} value={form.password} required onChange={(event) => update('password', event.target.value)} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500 hover:text-brand-800">{showPassword ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}</button></span>
                </label>

                {error && <p role="alert" className="flex gap-2 rounded-xl bg-coral-50 p-3 text-sm font-semibold text-coral-600"><CircleAlert aria-hidden="true" size={18} />{error}</p>}
                {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p>}

                <button type="submit" disabled={isLoading || isSubmitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : isRegistering ? <UserPlus aria-hidden="true" size={18} /> : <LockKeyhole aria-hidden="true" size={18} />}
                  {isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}
                </button>
              </form>

              <button type="button" className="mt-5 w-full text-sm font-bold text-brand-700 hover:underline" onClick={() => { setIsRegistering((value) => !value); setError(''); setMessage(''); setShowPassword(false) }}>
                {isRegistering ? 'Ya tengo cuenta' : 'Crear mi primera cuenta'}
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

function buildUsername(firstName, lastName) {
  const normalize = (value) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const first = normalize(firstName)
  const last = normalize(lastName)
  return first && last ? `${first}.${last}` : ''
}

export default AuthPage

function getAuthErrorMessage(error, isRegistering) {
  const messages = {
    invalid_credentials: 'Usuario o contraseña incorrectos.',
    email_not_confirmed: 'Esta cuenta quedó pendiente de confirmación. Elimínala en Supabase y créala nuevamente.',
    user_already_exists: 'Ese usuario ya existe. Usa la opción “Ya tengo cuenta” para ingresar.',
    signup_disabled: 'La creación de cuentas está desactivada en Supabase.',
    email_provider_disabled: 'El acceso con usuario y contraseña está desactivado en Supabase.',
    weak_password: 'La contraseña no cumple los requisitos de seguridad.',
    over_request_rate_limit: 'Se hicieron demasiados intentos. Espera un momento y vuelve a probar.',
  }

  if (messages[error?.code]) return messages[error.code]
  if (isRegistering && error?.message?.toLowerCase().includes('already registered')) {
    return 'Ese usuario ya existe. Usa la opción “Ya tengo cuenta” para ingresar.'
  }

  return error?.message || 'No fue posible completar el acceso.'
}

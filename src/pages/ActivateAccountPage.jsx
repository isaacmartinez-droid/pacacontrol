import { CheckCircle2, CircleAlert, Eye, EyeOff, KeyRound, LoaderCircle, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabaseClient'

function ActivateAccountPage() {
  const [searchParams] = useSearchParams()
  const { token: pathToken } = useParams()
  const navigate = useNavigate()
  const { signIn, user } = useAuth()
  // /activar?token=... se conserva para invitaciones ya emitidas.
  const token = pathToken?.trim() || searchParams.get('token')?.trim() || ''
  const [invitation, setInvitation] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!token) {
      setStatus('invalid')
      setError('El enlace de activación está incompleto.')
      return undefined
    }
    invokeActivation({ action: 'preview', token }).then((data) => {
      if (cancelled) return
      setInvitation(data.invitation)
      setStatus('ready')
    }).catch((nextError) => {
      if (cancelled) return
      setError(nextError.message)
      setStatus('invalid')
    })
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (user && status !== 'activating') navigate('/', { replace: true })
  }, [navigate, status, user])

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setStatus('activating')
    try {
      const result = await invokeActivation({ action: 'activate', token, password, acceptedLegal })
      await signIn({ username: result.username, password })
      navigate('/configurar-negocio', { replace: true })
    } catch (nextError) {
      setError(nextError.message || 'No pudimos activar la cuenta.')
      setStatus('ready')
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-brand-50 px-4 py-8">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-slate-100">
        <div className="bg-brand-950 p-6 text-white sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-950"><Store size={24} /></span>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-200">Invitación privada</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Activa tu cuenta</h1>
          <p className="mt-2 text-sm leading-6 text-brand-100">Tú eliges la contraseña. El administrador nunca podrá verla.</p>
        </div>

        <div className="p-6 sm:p-8">
          {status === 'loading' && <div className="flex min-h-48 items-center justify-center gap-3 text-sm font-extrabold text-brand-800"><LoaderCircle className="animate-spin" size={20} />Verificando invitación…</div>}

          {status === 'invalid' && <div className="py-6 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-700"><CircleAlert size={25} /></span><h2 className="mt-4 text-xl font-extrabold text-slate-950">No se puede usar este enlace</h2><p role="alert" className="mt-2 text-sm leading-6 text-slate-600">{error}</p><Link to="/acceder" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-brand-950 px-5 font-extrabold text-white">Ir al inicio de sesión</Link></div>}

          {(status === 'ready' || status === 'activating') && invitation && <form onSubmit={submit} className="space-y-5">
            <div className="rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100">
              <p className="text-xs font-extrabold uppercase tracking-wide text-brand-600">Cuenta preparada para</p>
              <p className="mt-1 text-lg font-extrabold text-brand-950">{invitation.business_name}</p>
              <p className="mt-1 text-sm font-bold text-brand-700">Usuario: {invitation.username}</p>
            </div>

            <label className="block text-sm font-extrabold text-slate-700">Crea tu contraseña
              <span className="relative mt-2 block"><input className="sale-input pr-12" type={showPassword ? 'text' : 'password'} minLength="10" maxLength="128" autoComplete="new-password" value={password} required onChange={(event) => { setPassword(event.target.value); setError('') }} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></span>
              <span className="mt-1 block text-xs font-medium text-slate-500">Usa al menos 10 caracteres y evita claves que ya utilices en otros sitios.</span>
            </label>
            <label className="block text-sm font-extrabold text-slate-700">Confirma tu contraseña<input className="sale-input mt-2" type={showPassword ? 'text' : 'password'} minLength="10" maxLength="128" autoComplete="new-password" value={confirmation} required onChange={(event) => { setConfirmation(event.target.value); setError('') }} /></label>

            <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700"><input type="checkbox" checked={acceptedLegal} required onChange={(event) => setAcceptedLegal(event.target.checked)} className="mt-1 size-5 shrink-0 accent-brand-800" /><span>Acepto los <Link to="/legal" target="_blank" rel="noreferrer" className="text-brand-700 underline">términos de uso y la política de privacidad</Link> indicados en esta invitación.</span></label>

            {error && <p role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700"><CircleAlert className="shrink-0" size={18} />{error}</p>}
            <button disabled={status === 'activating'} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-950 px-5 font-extrabold text-white hover:bg-brand-900 disabled:opacity-60">{status === 'activating' ? <LoaderCircle className="animate-spin" size={19} /> : <KeyRound size={19} />}{status === 'activating' ? 'Preparando tu cuenta…' : 'Activar y configurar mi negocio'}</button>
            <p className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-700"><CheckCircle2 size={15} />El enlace solo puede utilizarse una vez.</p>
          </form>}
        </div>
      </section>
    </main>
  )
}

async function invokeActivation(body) {
  const { data, error } = await getSupabaseClient().functions.invoke('activate-account', { body })
  if (!error) return data
  let message = error.message
  try {
    const payload = await error.context?.json()
    if (payload?.error) message = payload.error
  } catch { /* La respuesta no incluía JSON. */ }
  throw new Error(message || 'No pudimos comunicarnos con el servicio de activación.')
}

export default ActivateAccountPage

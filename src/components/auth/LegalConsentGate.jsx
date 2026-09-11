import { useState } from 'react'
import { CircleAlert, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react'
import LegalDocument from '../legal/LegalDocument'
import { legalHighlights } from '../../legal/legalContent'
import { useAuth } from '../../context/AuthContext'

function LegalConsentGate() {
  const { acceptLegalTerms, signOut } = useAuth()
  const [accepted, setAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleAccept() {
    if (!accepted) return
    setIsSubmitting(true)
    setError('')

    try {
      await acceptLegalTerms()
    } catch (nextError) {
      setError(nextError.message || 'No fue posible registrar la aceptacion.')
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-dvh bg-brand-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-800">
                <ShieldCheck aria-hidden="true" size={24} />
              </span>
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950">Acepta los terminos para continuar</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Antes de entrar al sistema necesitamos registrar que conoces las condiciones de uso, privacidad, etapa gratuita o pagada, soporte y limites de responsabilidad.
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50"
            >
              <LogOut aria-hidden="true" size={17} />
              Salir
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {legalHighlights.map((highlight) => (
              <p key={highlight} className="rounded-2xl bg-brand-50 p-4 text-sm font-bold leading-6 text-brand-900">
                {highlight}
              </p>
            ))}
          </div>

          <div className="mt-5 max-h-[32rem] overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <LegalDocument compact />
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 size-5 shrink-0 accent-brand-800"
            />
            <span>He leido y acepto los terminos de uso y la politica de privacidad vigentes.</span>
          </label>

          {error && (
            <p role="alert" className="mt-4 flex gap-2 rounded-xl bg-coral-50 p-3 text-sm font-semibold text-coral-600">
              <CircleAlert aria-hidden="true" size={18} />
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={!accepted || isSubmitting}
            onClick={handleAccept}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : <ShieldCheck aria-hidden="true" size={18} />}
            Aceptar y entrar
          </button>
        </section>
      </div>
    </main>
  )
}

export default LegalConsentGate

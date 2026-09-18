import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CheckCircle2, ChevronRight, CircleAlert, FileText, LoaderCircle, Save, SlidersHorizontal, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { defaultBusinessVocabulary, normalizeBusinessVocabulary } from '../utils/businessProfile'

const vocabularyFields = [
  ['purchaseSingular', 'Una compra o lote'],
  ['purchasePlural', 'Varias compras o lotes'],
  ['inventoryUnitSingular', 'Una unidad de inventario'],
  ['inventoryUnitPlural', 'Varias unidades de inventario'],
]

const settingsLinks = [
  { to: '/preferencias', icon: SlidersHorizontal, title: 'Ventas, precios e indicadores', description: 'Valores habituales, reglas de precios y tarjetas del panel.' },
  { to: '/alertas', icon: Bell, title: 'Notificaciones y alertas', description: 'Avisos internos, límites y notificaciones del dispositivo.' },
  { to: '/legal', icon: FileText, title: 'Cuenta, términos y privacidad', description: 'Consulta los documentos vigentes y la información de acceso.' },
]

function draftFromProfile(profile) {
  return {
    businessName: profile?.businessName ?? '',
    activityDescription: profile?.activityDescription ?? '',
    vocabulary: normalizeBusinessVocabulary(profile?.vocabulary ?? defaultBusinessVocabulary),
  }
}

export default function SettingsPage() {
  const { data, isLoading, saveBusinessProfile } = usePacaData()
  const profile = data.businessProfile
  const [draft, setDraft] = useState(() => draftFromProfile(profile))
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const dirty = useRef(false)

  useEffect(() => {
    if (!dirty.current) setDraft(draftFromProfile(profile))
  }, [profile])

  const templateName = useMemo(() => (
    data.businessTemplates.find((template) => template.key === profile?.templateKey && template.version === profile?.templateVersion)?.name
    ?? (profile?.templateKey === 'legacy_bales' ? 'Venta por pacas o lotes' : 'Sin plantilla confirmada')
  ), [data.businessTemplates, profile?.templateKey, profile?.templateVersion])

  function change(field, value) {
    dirty.current = true
    setMessage(null)
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function changeVocabulary(field, value) {
    dirty.current = true
    setMessage(null)
    setDraft((current) => ({
      ...current,
      vocabulary: { ...current.vocabulary, [field]: value },
    }))
  }

  async function handleSave(event) {
    event.preventDefault()
    const businessName = draft.businessName.trim()
    const activityDescription = draft.activityDescription.trim()
    const vocabulary = Object.fromEntries(Object.entries(draft.vocabulary).map(([key, value]) => [key, value.trim()]))
    if (!businessName || businessName.length > 120) {
      setMessage({ type: 'error', text: 'Escribe un nombre de negocio de hasta 120 caracteres.' })
      return
    }
    if (activityDescription.length > 500 || Object.values(vocabulary).some((value) => !value || value.length > 40)) {
      setMessage({ type: 'error', text: 'Revisa la descripción y las palabras personalizadas.' })
      return
    }
    setIsSaving(true)
    setMessage(null)
    try {
      const saved = await saveBusinessProfile({ businessName, activityDescription, vocabulary })
      dirty.current = false
      setDraft(draftFromProfile(saved))
      setMessage({ type: 'success', text: 'Información del negocio actualizada.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No fue posible guardar los ajustes.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Configuración" title="Ajustes" description="Administra la identidad y el funcionamiento de tu negocio desde un solo lugar." backTo="/mas" />
      <div className="page-content grid items-start gap-6 py-6 md:py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <form onSubmit={handleSave} className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Store aria-hidden="true" size={21} /></span>
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">Identidad del negocio</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Estos datos preparan el sistema para usar términos adecuados sin cambiar tu información histórica.</p>
            </div>
          </div>

          {!isLoading && !profile && (
            <p role="alert" className="mt-5 flex gap-2 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              <CircleAlert className="mt-0.5 shrink-0" size={18} />El perfil general todavía no está instalado en esta base de datos.
            </p>
          )}

          <div className="mt-6 grid gap-5">
            <label className="text-sm font-bold text-slate-700">Nombre visible del negocio
              <input className="sale-input mt-2" maxLength="120" value={draft.businessName} onChange={(event) => change('businessName', event.target.value)} placeholder="Ej. Mi tienda" disabled={!profile || isSaving} />
            </label>
            <label className="text-sm font-bold text-slate-700">¿Qué vende o cómo trabaja?
              <textarea className="sale-input mt-2 min-h-24 resize-y" maxLength="500" value={draft.activityDescription} onChange={(event) => change('activityDescription', event.target.value)} placeholder="Describe brevemente tu actividad" disabled={!profile || isSaving} />
              <span className="mt-1 block text-right text-xs font-medium text-slate-400">{draft.activityDescription.length}/500</span>
            </label>
          </div>

          <fieldset className="mt-6 border-t border-slate-100 pt-5">
            <legend className="text-sm font-extrabold text-slate-900">Palabras que usa el sistema</legend>
            <p className="mt-1 text-xs leading-5 text-slate-500">Por ahora se guardan como fundamento del cambio general. La sustitución completa de textos se hará de forma gradual y comprobable.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {vocabularyFields.map(([field, label]) => (
                <label key={field} className="text-xs font-bold text-slate-600">{label}
                  <input className="sale-input mt-2" maxLength="40" value={draft.vocabulary[field]} onChange={(event) => changeVocabulary(field, event.target.value)} disabled={!profile || isSaving} />
                </label>
              ))}
            </div>
          </fieldset>

          <button type="submit" disabled={!profile || isSaving || !dirty.current} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-900 px-5 text-sm font-extrabold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50">
            {isSaving ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}
            {isSaving ? 'Guardando…' : 'Guardar ajustes'}
          </button>
          {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`mt-4 flex gap-2 rounded-xl p-3 text-sm font-semibold ${message.type === 'error' ? 'bg-coral-50 text-coral-600' : 'bg-emerald-50 text-emerald-800'}`}>{message.type === 'success' && <CheckCircle2 className="shrink-0" size={18} />}{message.text}</p>}
        </form>

        <div className="space-y-5">
          <section className="rounded-3xl bg-brand-950 p-5 text-white shadow-soft sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-200">Modelo actual</p>
            <h2 className="mt-2 text-lg font-extrabold">{templateName}</h2>
            <p className="mt-2 text-sm leading-6 text-brand-100">{profile?.onboardingStatus === 'completed' ? 'Configuración completa y compatible con tus datos actuales.' : `Configuración pendiente, paso ${profile?.onboardingStep ?? 0} de 7.`}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl bg-white/8 p-3"><dt className="text-brand-200">Inventario</dt><dd className="mt-1 font-extrabold">{profile?.inventoryMode === 'units' ? 'Unidades' : profile?.inventoryMode === 'both' ? 'Unidades y lotes' : 'Lotes'}</dd></div>
              <div className="rounded-2xl bg-white/8 p-3"><dt className="text-brand-200">Variantes</dt><dd className="mt-1 font-extrabold">{profile?.tracksVariants ? 'Activadas' : 'Sin activar'}</dd></div>
            </dl>
          </section>

          <nav aria-label="Secciones de ajustes" className="space-y-3">
            {settingsLinks.map(({ to, icon: Icon, title, description }) => (
              <Link key={to} to={to} className="group flex min-h-20 items-center gap-4 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100 transition hover:bg-slate-50">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon aria-hidden="true" size={20} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-900">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span>
                <ChevronRight className="shrink-0 text-slate-300 group-hover:text-brand-600" size={19} />
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}

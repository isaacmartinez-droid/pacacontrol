import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Boxes, Check, CheckCircle2, CircleAlert, Clock3,
  Layers3, LoaderCircle, LogOut, PackageCheck, Plus, Save, ShoppingBag,
  Sparkles, Store, Tags, Truck, WalletCards, X,
} from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePacaData } from '../context/PacaDataContext'
import {
  BUSINESS_ONBOARDING_LAST_STEP,
  businessOnboardingSubmission,
  createBusinessOnboardingDraft,
  normalizeOnboardingCategories,
  selectBusinessTemplate,
  validateBusinessOnboardingStep,
} from '../utils/businessOnboarding'

const steps = [
  { title: 'Tu negocio', short: 'Negocio' },
  { title: 'Tipo de negocio', short: 'Tipo' },
  { title: 'Compras e inventario', short: 'Inventario' },
  { title: 'Forma de venta', short: 'Ventas' },
  { title: 'Entrega de pedidos', short: 'Entrega' },
  { title: 'Categorías reales', short: 'Categorías' },
  { title: 'Confirmar configuración', short: 'Confirmar' },
]

const inventoryChoices = [
  { value: 'units', icon: ShoppingBag, title: 'Por unidades', text: 'Compras y controlas productos individuales.' },
  { value: 'batches', icon: Layers3, title: 'Por lotes', text: 'Compras cajas, fardos, paquetes o lotes completos.' },
  { value: 'both', icon: Boxes, title: 'Ambas formas', text: 'Trabajas con lotes y también con unidades.' },
]

const salesChoices = [
  { value: 'immediate', icon: WalletCards, title: 'Pago inmediato', text: 'La mayoría de ventas se paga al momento.' },
  { value: 'credit', icon: Clock3, title: 'Con saldo pendiente', text: 'Vendes por encargo, apartado o crédito.' },
  { value: 'both', icon: PackageCheck, title: 'Ambas formas', text: 'Recibes pagos completos y también abonos.' },
]

function ChoiceCard({ checked, icon: Icon, title, text, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onClick}
      className={`relative flex min-h-32 w-full items-start gap-4 rounded-3xl border p-5 text-left transition ${checked ? 'border-brand-700 bg-brand-50 ring-2 ring-brand-200' : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50'}`}
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${checked ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon size={21} /></span>
      <span><span className="block text-sm font-extrabold text-slate-950">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{text}</span></span>
      {checked && <span className="absolute right-4 top-4 grid size-6 place-items-center rounded-full bg-brand-900 text-white"><Check size={14} /></span>}
    </button>
  )
}

function LoadingScreen({ text = 'Cargando la configuración…' }) {
  return <div className="grid min-h-dvh place-items-center bg-brand-50 px-5 text-center"><div><LoaderCircle className="mx-auto animate-spin text-brand-700" size={34} /><p className="mt-4 text-sm font-extrabold text-brand-950">{text}</p></div></div>
}

export default function BusinessOnboardingPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const {
    completeBusinessOnboarding,
    data,
    error: loadError,
    isLoading,
    refresh,
    saveBusinessOnboardingDraft,
  } = usePacaData()
  const profile = data.businessProfile
  const templates = useMemo(
    () => data.businessTemplates.filter((template) => template.key !== 'legacy_bales'),
    [data.businessTemplates],
  )
  const [draft, setDraft] = useState(null)
  const [step, setStep] = useState(0)
  const [categoryName, setCategoryName] = useState('')
  const [message, setMessage] = useState('')
  const [saveState, setSaveState] = useState('saved')
  const [isChangingStep, setIsChangingStep] = useState(false)
  const [phase, setPhase] = useState('editing')
  const initializedOwner = useRef(null)
  const autosaveTimer = useRef(null)
  const saveQueue = useRef(Promise.resolve())

  useEffect(() => {
    if (!profile || initializedOwner.current === profile.ownerId) return
    initializedOwner.current = profile.ownerId
    setDraft(createBusinessOnboardingDraft(profile))
    setStep(Math.min(BUSINESS_ONBOARDING_LAST_STEP, Math.max(0, profile.onboardingStep)))
  }, [profile])

  const templateKeys = useMemo(() => templates.map((template) => template.key), [templates])
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.key === draft?.templateKey) ?? null,
    [draft?.templateKey, templates],
  )

  const queueDraftSave = useCallback((targetStep, targetDraft) => {
    const next = saveQueue.current
      .catch(() => undefined)
      .then(() => saveBusinessOnboardingDraft(targetStep, targetDraft))
    saveQueue.current = next
    return next
  }, [saveBusinessOnboardingDraft])

  useEffect(() => {
    if (!draft || phase !== 'editing' || profile?.onboardingStatus === 'completed') return undefined
    window.clearTimeout(autosaveTimer.current)
    setSaveState('pending')
    autosaveTimer.current = window.setTimeout(async () => {
      setSaveState('saving')
      try {
        await queueDraftSave(step, draft)
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    }, 900)
    return () => window.clearTimeout(autosaveTimer.current)
  }, [draft, phase, profile?.onboardingStatus, queueDraftSave, step])

  if (isLoading && !profile) return <LoadingScreen />
  if (profile?.onboardingStatus === 'completed' && phase !== 'preparing') return <Navigate to="/ajustes" replace />
  if (loadError || (!isLoading && !profile)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-brand-50 px-5">
        <div role="alert" className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-soft ring-1 ring-coral-100">
          <CircleAlert className="mx-auto text-coral-600" size={32} />
          <h1 className="mt-4 text-xl font-extrabold text-slate-950">No pudimos iniciar la configuración</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{loadError || 'No encontramos el perfil de tu negocio.'}</p>
          <button type="button" onClick={() => refresh()} className="mt-5 min-h-11 rounded-xl bg-brand-900 px-5 text-sm font-extrabold text-white">Reintentar</button>
        </div>
      </div>
    )
  }
  if (!draft) return <LoadingScreen />

  if (phase === 'preparing') {
    return (
      <div className="relative grid min-h-dvh overflow-hidden bg-brand-950 px-5 text-center text-white">
        <div className="absolute -left-20 top-10 size-64 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -right-16 bottom-10 size-72 rounded-full bg-coral-500/20 blur-3xl" />
        <div className="relative m-auto max-w-lg">
          <span className="mx-auto grid size-20 place-items-center rounded-3xl bg-white/10 ring-1 ring-white/20"><Sparkles className="animate-pulse" size={38} /></span>
          <h1 className="mt-7 text-3xl font-extrabold sm:text-4xl">Estamos adaptando tu sistema</h1>
          <p className="mt-4 text-sm leading-7 text-brand-100 sm:text-base">Guardamos tus categorías, palabras y forma de trabajar. Espera un momento mientras preparamos tu espacio.</p>
          <div className="mx-auto mt-7 h-2 w-56 overflow-hidden rounded-full bg-white/10"><span className="block h-full w-2/3 animate-pulse rounded-full bg-brand-200" /></div>
        </div>
      </div>
    )
  }

  function updateDraft(values) {
    setMessage('')
    setDraft((current) => ({ ...current, ...values }))
  }

  function chooseTemplate(template) {
    const previous = templates.find((item) => item.key === draft.templateKey) ?? null
    setMessage('')
    setDraft((current) => selectBusinessTemplate(current, template, previous))
  }

  function toggleFulfillment(value) {
    const exists = draft.fulfillmentMethods.includes(value)
    const next = exists ? draft.fulfillmentMethods.filter((item) => item !== value) : [...draft.fulfillmentMethods, value]
    if (next.length) updateDraft({ fulfillmentMethods: next })
  }

  function addCategory() {
    const next = normalizeOnboardingCategories([...draft.categories, categoryName])
    if (!categoryName.trim()) return
    if (next.length === draft.categories.length) {
      setMessage('Esa categoría ya está en la lista o no es válida.')
      return
    }
    updateDraft({ categories: next })
    setCategoryName('')
  }

  async function moveTo(targetStep) {
    const validation = targetStep > step ? validateBusinessOnboardingStep(step, draft, templateKeys) : ''
    if (validation) {
      setMessage(validation)
      return
    }
    window.clearTimeout(autosaveTimer.current)
    setIsChangingStep(true)
    setMessage('')
    setSaveState('saving')
    try {
      await queueDraftSave(targetStep, draft)
      setStep(targetStep)
      setSaveState('saved')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (saveError) {
      setSaveState('error')
      setMessage(saveError.message || 'No pudimos guardar el avance.')
    } finally {
      setIsChangingStep(false)
    }
  }

  async function finish() {
    const validation = validateBusinessOnboardingStep(BUSINESS_ONBOARDING_LAST_STEP, draft, templateKeys)
    if (validation) {
      setMessage(validation)
      return
    }
    window.clearTimeout(autosaveTimer.current)
    setMessage('')
    setPhase('preparing')
    try {
      await saveQueue.current.catch(() => undefined)
      await Promise.all([
        completeBusinessOnboarding(draft),
        new Promise((resolve) => window.setTimeout(resolve, 900)),
      ])
      navigate('/', { replace: true })
    } catch (finishError) {
      setPhase('editing')
      setMessage(finishError.message || 'No pudimos completar la configuración.')
    }
  }

  const submission = businessOnboardingSubmission(draft)

  return (
    <div className="min-h-dvh bg-brand-50">
      <header className="border-b border-brand-100 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-brand-950 text-white"><Store size={20} /></span><div><p className="text-sm font-extrabold text-brand-950">Configura tu negocio</p><p className="text-xs text-slate-500">Tus datos se guardan mientras avanzas</p></div></div>
          <div className="flex items-center gap-3">
            <span className={`hidden items-center gap-1.5 text-xs font-bold sm:flex ${saveState === 'error' ? 'text-coral-600' : 'text-slate-500'}`}>
              {saveState === 'saving' || saveState === 'pending' ? <LoaderCircle className="animate-spin" size={14} /> : saveState === 'error' ? <CircleAlert size={14} /> : <Save size={14} />}
              {saveState === 'saving' ? 'Guardando…' : saveState === 'pending' ? 'Cambio pendiente' : saveState === 'error' ? 'Sin guardar' : 'Avance guardado'}
            </span>
            <button type="button" onClick={() => signOut()} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-extrabold text-slate-600 hover:bg-slate-100"><LogOut size={16} />Salir</button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-7 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-3xl bg-brand-950 p-5 text-white shadow-soft">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-200">Paso {step + 1} de {steps.length}</p>
            <p className="mt-2 text-lg font-extrabold">{steps[step].title}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand-200 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
          </div>
          <ol className="mt-4 hidden space-y-1 lg:block">
            {steps.map((item, index) => <li key={item.short} className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-xs font-bold ${index === step ? 'bg-white text-brand-950 shadow-sm' : index < step ? 'text-brand-700' : 'text-slate-400'}`}><span className={`grid size-6 place-items-center rounded-full text-[0.68rem] ${index <= step ? 'bg-brand-900 text-white' : 'bg-slate-200 text-slate-500'}`}>{index < step ? <Check size={13} /> : index + 1}</span>{item.short}</li>)}
          </ol>
        </aside>

        <section className="rounded-[2rem] bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-8">
          {step === 0 && <div>
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Store size={23} /></span>
            <h1 className="mt-5 text-2xl font-extrabold text-slate-950 sm:text-3xl">Cuéntanos sobre tu negocio</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Usaremos esta información para mostrar palabras y opciones apropiadas. No cambiaremos operaciones ni inventaremos productos.</p>
            <div className="mt-7 grid gap-5">
              <label className="text-sm font-extrabold text-slate-700">Nombre del negocio
                <input autoFocus className="sale-input mt-2" maxLength="120" value={draft.businessName} onChange={(event) => updateDraft({ businessName: event.target.value })} placeholder="Ej. Variedades Luna" />
              </label>
              <label className="text-sm font-extrabold text-slate-700">¿Qué vendes o cómo trabajas? <span className="font-medium text-slate-400">(opcional)</span>
                <textarea className="sale-input mt-2 min-h-28 resize-y" maxLength="500" value={draft.activityDescription} onChange={(event) => updateDraft({ activityDescription: event.target.value })} placeholder="Ej. Vendo calzado y accesorios por redes sociales y en un local." />
                <span className="mt-1 block text-right text-xs font-semibold text-slate-400">{draft.activityDescription.length}/500</span>
              </label>
            </div>
          </div>}

          {step === 1 && <div>
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Sparkles size={23} /></span>
            <h1 className="mt-5 text-2xl font-extrabold text-slate-950 sm:text-3xl">¿Qué tipo de negocio tienes?</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Elige la opción más cercana. Solo sirve como punto de partida y podrás editar todas las categorías.</p>
            <div className="mt-7 grid gap-4 md:grid-cols-2">{templates.map((template) => <ChoiceCard key={`${template.key}-${template.version}`} checked={draft.templateKey === template.key} icon={template.key === 'manual' ? Tags : Store} title={template.name} text={template.description} onClick={() => chooseTemplate(template)} />)}</div>
          </div>}

          {step === 2 && <div>
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Boxes size={23} /></span>
            <h1 className="mt-5 text-2xl font-extrabold text-slate-950 sm:text-3xl">¿Cómo compras y controlas inventario?</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Esto adapta la forma de hablar de compras, lotes y productos.</p>
            <div className="mt-7 grid gap-4 md:grid-cols-3">{inventoryChoices.map((choice) => <ChoiceCard key={choice.value} checked={draft.inventoryMode === choice.value} {...choice} onClick={() => updateDraft({ inventoryMode: choice.value })} />)}</div>
            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><input type="checkbox" className="mt-1 size-4 accent-[#1b3554]" checked={draft.tracksVariants} onChange={(event) => updateDraft({ tracksVariants: event.target.checked })} /><span><span className="block text-sm font-extrabold text-slate-900">Necesito diferenciar tallas, colores u otras variantes</span><span className="mt-1 block text-xs leading-5 text-slate-500">Guardaremos esta necesidad para adaptar el inventario en las siguientes mejoras.</span></span></label>
          </div>}

          {step === 3 && <div>
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><WalletCards size={23} /></span>
            <h1 className="mt-5 text-2xl font-extrabold text-slate-950 sm:text-3xl">¿Cómo suelen pagarte?</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">El sistema conservará pagos, abonos y saldos según tu forma de venta.</p>
            <div className="mt-7 grid gap-4 md:grid-cols-3">{salesChoices.map((choice) => <ChoiceCard key={choice.value} checked={draft.salesMode === choice.value} {...choice} onClick={() => updateDraft({ salesMode: choice.value })} />)}</div>
          </div>}

          {step === 4 && <div>
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Truck size={23} /></span>
            <h1 className="mt-5 text-2xl font-extrabold text-slate-950 sm:text-3xl">¿Cómo entregas los pedidos?</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Puedes elegir una o ambas opciones.</p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <ChoiceCard checked={draft.fulfillmentMethods.includes('pickup')} icon={Store} title="Retiro o entrega directa" text="El cliente recoge o recibe el producto directamente en tu negocio." onClick={() => toggleFulfillment('pickup')} />
              <ChoiceCard checked={draft.fulfillmentMethods.includes('delivery')} icon={Truck} title="Envío o delivery" text="Das seguimiento al costo, cobro y estado del envío." onClick={() => toggleFulfillment('delivery')} />
            </div>
          </div>}

          {step === 5 && <div>
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Tags size={23} /></span>
            <h1 className="mt-5 text-2xl font-extrabold text-slate-950 sm:text-3xl">Confirma tus categorías reales</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{selectedTemplate?.suggestedCategories.length ? 'Partimos de sugerencias de la plantilla. Elimina, cambia o agrega lo que necesites.' : 'Agrega únicamente categorías que realmente usarás.'} Nada se crea hasta que confirmes el último paso.</p>
            <div className="mt-7 flex gap-2"><label className="sr-only" htmlFor="new-business-category">Nueva categoría</label><input id="new-business-category" className="sale-input" maxLength="80" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCategory() } }} placeholder="Ej. Zapatos" /><button type="button" onClick={addCategory} className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-brand-900 px-4 text-sm font-extrabold text-white"><Plus size={18} />Agregar</button></div>
            <div className="mt-5 flex min-h-24 flex-wrap content-start gap-2 rounded-3xl border border-dashed border-brand-200 bg-brand-50/60 p-4">
              {draft.categories.length ? draft.categories.map((category) => <span key={category.toLocaleLowerCase('es')} className="inline-flex h-10 items-center gap-2 rounded-full bg-white pl-4 pr-2 text-sm font-extrabold text-brand-950 shadow-sm ring-1 ring-brand-100">{category}<button type="button" aria-label={`Eliminar ${category}`} onClick={() => updateDraft({ categories: draft.categories.filter((item) => item !== category) })} className="grid size-7 place-items-center rounded-full text-slate-400 hover:bg-coral-50 hover:text-coral-600"><X size={15} /></button></span>) : <p className="m-auto text-sm font-semibold text-slate-400">Todavía no agregaste categorías.</p>}
            </div>
            <p className="mt-3 text-right text-xs font-bold text-slate-400">{draft.categories.length}/30 categorías</p>
          </div>}

          {step === 6 && <div>
            <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><CheckCircle2 size={24} /></span>
            <h1 className="mt-5 text-2xl font-extrabold text-slate-950 sm:text-3xl">Revisa antes de preparar tu espacio</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Al confirmar se crearán únicamente las categorías de esta lista. Después podrás cambiarlas desde Ajustes y Preferencias.</p>
            <dl className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-bold text-slate-400">Negocio</dt><dd className="mt-1 text-sm font-extrabold text-slate-950">{submission.businessName}</dd></div>
              <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-bold text-slate-400">Tipo</dt><dd className="mt-1 text-sm font-extrabold text-slate-950">{selectedTemplate?.name ?? 'Sin seleccionar'}</dd></div>
              <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-bold text-slate-400">Inventario</dt><dd className="mt-1 text-sm font-extrabold text-slate-950">{inventoryChoices.find((item) => item.value === submission.inventoryMode)?.title ?? 'Sin seleccionar'}</dd></div>
              <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-bold text-slate-400">Ventas</dt><dd className="mt-1 text-sm font-extrabold text-slate-950">{salesChoices.find((item) => item.value === submission.salesMode)?.title ?? 'Sin seleccionar'}</dd></div>
            </dl>
            <div className="mt-4 rounded-2xl bg-brand-50 p-4"><p className="text-xs font-bold text-brand-600">Categorías que se crearán</p><p className="mt-2 text-sm font-extrabold leading-6 text-brand-950">{submission.categories.join(' · ') || 'Ninguna'}</p></div>
          </div>}

          {message && <p role="alert" className="mt-6 flex items-start gap-2 rounded-2xl bg-coral-50 p-4 text-sm font-bold text-coral-600"><CircleAlert className="mt-0.5 shrink-0" size={18} />{message}</p>}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" disabled={step === 0 || isChangingStep} onClick={() => moveTo(step - 1)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold text-slate-600 hover:bg-slate-100 disabled:invisible"><ArrowLeft size={18} />Anterior</button>
            {step < BUSINESS_ONBOARDING_LAST_STEP
              ? <button type="button" disabled={isChangingStep} onClick={() => moveTo(step + 1)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-900 px-6 text-sm font-extrabold text-white hover:bg-brand-800 disabled:opacity-60">{isChangingStep ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowRight size={18} />}{isChangingStep ? 'Guardando…' : 'Continuar'}</button>
              : <button type="button" onClick={finish} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-900 px-6 text-sm font-extrabold text-white hover:bg-brand-800"><Sparkles size={18} />Preparar mi sistema</button>}
          </div>
        </section>
      </main>
    </div>
  )
}

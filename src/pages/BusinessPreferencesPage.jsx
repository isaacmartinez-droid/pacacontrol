import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, BadgeDollarSign, BarChart3, Check, CircleAlert, LoaderCircle, Save, Settings2 } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { getDashboardKpiOptions, normalizeBusinessSettings } from '../utils/businessSettings'
import { recordedCategories, lastRecordedOperations } from '../utils/recordedPreferences'
import { formatCurrency } from '../utils/currency'
import { getBusinessTerms } from '../utils/businessProfile'

const tabs = (terms) => [
  { id: 'prices', label: 'Precios', icon: BadgeDollarSign },
  { id: 'dashboard', label: 'Indicadores', icon: BarChart3 },
  { id: 'defaults', label: `Ventas y ${terms.purchasePluralLower}`, icon: Settings2 },
]

const paymentMethods = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'transfer', label: 'Transferencia' },
  { id: 'card', label: 'Tarjeta' },
  { id: 'other', label: 'Otro' },
]

function priceDraft(categories) {
  return categories.map((category) => ({
    categoryId: category.id,
    name: category.name,
    economicPrice: category.prices?.economic || '',
    standardPrice: category.prices?.standard || '',
    premiumPrice: category.prices?.premium || '',
  }))
}

function BusinessPreferencesPage() {
  const { data, isLoading, saveBusinessSettings, saveCategoryPrices, createCategory } = usePacaData()
  const terms = getBusinessTerms(data.businessProfile)
  const dashboardKpiOptions = useMemo(() => getDashboardKpiOptions(terms), [data.businessProfile])
  const [activeTab, setActiveTab] = useState('prices')
  const [settings, setSettings] = useState(() => normalizeBusinessSettings(data.settings))
  const [prices, setPrices] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [categoryName, setCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const dirtySettings = useRef(new Set())
  const dirtyPrices = useRef(new Set())
  const categories = useMemo(() => recordedCategories(data), [data.categories, data.bales, data.baleInventory])
  const last = useMemo(() => lastRecordedOperations(data), [data.sales, data.bales])

  useEffect(() => setSettings((current) => {
    const next = normalizeBusinessSettings(data.settings)
    for (const field of dirtySettings.current) next[field] = current[field]
    return next
  }), [data.settings])
  useEffect(() => setPrices((current) => priceDraft(categories).map((rule) => {
    const previous = current.find((item) => item.categoryId === rule.categoryId)
    if (previous) for (const field of ['economicPrice', 'standardPrice', 'premiumPrice']) {
      if (dirtyPrices.current.has(`${rule.categoryId}:${field}`)) rule[field] = previous[field]
    }
    return rule
  })), [categories])

  async function addCategory(event) {
    event.preventDefault()
    setAddingCategory(true)
    setMessage(null)
    try {
      await createCategory(categoryName)
      setCategoryName('')
      setMessage({ type: 'success', text: 'Categoría agregada. No se creó inventario ni una compra.' })
    } catch (error) { setMessage({ type: 'error', text: error.message }) }
    finally { setAddingCategory(false) }
  }

  function copyDefaults(values) {
    for (const field of Object.keys(values)) dirtySettings.current.add(field)
    setSettings((current) => ({ ...current, ...values }))
    setMessage({ type: 'success', text: 'Valores copiados de tus registros. Pulsa Guardar preferencias para conservarlos.' })
  }

  const selectedKpis = useMemo(
    () => settings.dashboardKpis.map((id) => dashboardKpiOptions.find((option) => option.id === id)).filter(Boolean),
    [settings.dashboardKpis, dashboardKpiOptions],
  )

  function updateSetting(field, value) {
    dirtySettings.current.add(field)
    setSettings((current) => ({ ...current, [field]: value }))
    setMessage(null)
  }

  function toggleKpi(id) {
    const selected = settings.dashboardKpis.includes(id)
    if (!selected && settings.dashboardKpis.length >= 4) {
      setMessage({ type: 'error', text: 'Puedes mostrar un máximo de cuatro indicadores.' })
      return
    }
    const dashboardKpis = selected
      ? settings.dashboardKpis.filter((item) => item !== id)
      : [...settings.dashboardKpis, id]
    if (!dashboardKpis.length) {
      setMessage({ type: 'error', text: 'Elige al menos un indicador.' })
      return
    }
    setMessage(null)
    dirtySettings.current.add('dashboardKpis')
    setSettings((current) => ({ ...current, dashboardKpis }))
  }

  function moveKpi(index, direction) {
    dirtySettings.current.add('dashboardKpis')
    setSettings((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.dashboardKpis.length) return current
      const dashboardKpis = [...current.dashboardKpis]
      ;[dashboardKpis[index], dashboardKpis[nextIndex]] = [dashboardKpis[nextIndex], dashboardKpis[index]]
      return { ...current, dashboardKpis }
    })
  }

  function updatePrice(categoryId, field, value) {
    dirtyPrices.current.add(`${categoryId}:${field}`)
    setPrices((current) => current.map((rule) => rule.categoryId === categoryId ? { ...rule, [field]: value } : rule))
    setMessage(null)
  }

  async function saveCurrentTab() {
    setIsSaving(true)
    setMessage(null)
    try {
      if (activeTab === 'prices') {
        const normalized = prices.map((rule) => ({
          ...rule,
          economicPrice: Number(rule.economicPrice) || 0,
          standardPrice: Number(rule.standardPrice) || 0,
          premiumPrice: Number(rule.premiumPrice) || 0,
        }))
        if (normalized.some((rule) => [rule.economicPrice, rule.standardPrice, rule.premiumPrice].some((price) => price < 0))) {
          throw new Error('Los precios no pueden ser negativos.')
        }
        if (normalized.some((rule) => rule.standardPrice > 0 && rule.economicPrice > rule.standardPrice)) {
          throw new Error('El precio económico no puede superar al precio normal.')
        }
        if (normalized.some((rule) => rule.premiumPrice > 0 && rule.standardPrice > rule.premiumPrice)) {
          throw new Error('El precio normal no puede superar al precio premium.')
        }
        if (normalized.some((rule) => rule.premiumPrice > 0 && rule.economicPrice > rule.premiumPrice)) {
          throw new Error('El precio económico no puede superar al precio premium.')
        }
        await saveCategoryPrices(normalized)
        dirtyPrices.current.clear()
        setPrices(normalized.map((rule) => ({ ...rule, economicPrice: rule.economicPrice || '', standardPrice: rule.standardPrice || '', premiumPrice: rule.premiumPrice || '' })))
      } else {
        await saveBusinessSettings(settings)
        dirtySettings.current.clear()
        setSettings(normalizeBusinessSettings(settings))
      }
      setMessage({ type: 'success', text: 'Preferencias guardadas correctamente.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No fue posible guardar las preferencias.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Personalización" title="Preferencias del negocio" description="Adapta precios, indicadores y valores habituales a tu forma de trabajar." backTo="/mas" />
      <div className="page-content py-6 md:py-8">
        <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
          <nav aria-label="Secciones de preferencias" className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            {tabs(terms).map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setActiveTab(id); setMessage(null) }} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-xs font-extrabold transition lg:justify-start lg:text-sm ${activeTab === id ? 'bg-brand-900 text-white shadow-lg shadow-brand-950/15' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}><Icon size={18} /><span>{label}</span></button>)}
          </nav>

          <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
            <fieldset disabled={isSaving || addingCategory || isLoading}>
            {activeTab === 'prices' && <><PricePreferences prices={prices} updatePrice={updatePrice} isLoading={isLoading} lastPrices={last.prices} /><form onSubmit={addCategory} className="mt-6 rounded-2xl bg-slate-50 p-4"><label className="block text-sm font-bold text-slate-700">Nombre de la nueva categoría<input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={80} required placeholder="Escribe el nombre que utilizas" className="sale-input mt-2" /></label><button type="submit" disabled={addingCategory || isLoading || !categoryName.trim()} className="mt-3 min-h-11 rounded-xl border border-brand-200 bg-white px-4 text-sm font-extrabold text-brand-900 disabled:opacity-50">{addingCategory ? 'Agregando…' : 'Agregar más'}</button><p className="mt-2 text-xs text-slate-500">Agrega solo lo que vendes. El nombre se recuerda para tus próximas compras.</p></form></>}
            {activeTab === 'dashboard' && <DashboardPreferences settings={settings} options={dashboardKpiOptions} selectedKpis={selectedKpis} toggleKpi={toggleKpi} moveKpi={moveKpi} updateSetting={updateSetting} />}
            {activeTab === 'defaults' && <DefaultPreferences settings={settings} updateSetting={updateSetting} last={last} copyDefaults={copyDefaults} terms={terms} />}
            </fieldset>

            {message && <p role="status" className={`mt-6 flex items-center gap-2 rounded-2xl p-3 text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{message.type === 'success' ? <Check size={18} /> : <CircleAlert size={18} />}{message.text}</p>}
            <button type="button" disabled={isSaving || addingCategory || isLoading || (activeTab === 'prices' && !prices.length)} onClick={saveCurrentTab} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white disabled:opacity-50 sm:w-auto">{isSaving ? <LoaderCircle className="animate-spin" size={19} /> : <Save size={19} />}{isSaving ? 'Guardando…' : 'Guardar preferencias'}</button>
          </section>
        </div>
      </div>
    </div>
  )
}

function PricePreferences({ prices, updatePrice, isLoading, lastPrices }) {
  const levels = [['economicPrice', 'Económico'], ['standardPrice', 'Normal'], ['premiumPrice', 'Premium']]
  return <>
    <Title icon={BadgeDollarSign} title="Precios por categoría" description="Tus categorías registradas, con las compras más recientes primero. No se asignan precios por suposición: puedes escribirlos o copiar un precio vendido. Un campo vacío mantiene el cálculo por costo y ganancia deseada." />
    {!isLoading && !prices.length && <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Todavía no hay categorías registradas en tus compras. Agrega una por nombre o registra tu primera compra.</p>}
    <div className="mt-6 space-y-4">{prices.map((rule) => <article key={rule.categoryId} className="rounded-2xl border border-slate-200 p-4">
      <h3 className="font-extrabold text-slate-900">{rule.name}</h3>
      {lastPrices.has(rule.categoryId) && <div className="mt-2 text-xs text-slate-500"><p>Precios de la última venta registrada de esta categoría. Tú eliges el importe y el nivel.</p>{lastPrices.get(rule.categoryId).map((price) => <div key={price} className="mt-2"><p className="font-bold">{formatCurrency(price)}</p><div className="mt-2 flex flex-wrap gap-2">{levels.map(([field, label]) => <button key={field} type="button" aria-label={`Copiar ${formatCurrency(price)} a ${label} de ${rule.name}`} onClick={() => updatePrice(rule.categoryId, field, String(price))} className="min-h-9 rounded-lg bg-brand-50 px-3 font-bold text-brand-800">Copiar a {label}</button>)}</div></div>)}</div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{levels.map(([field, label]) => <Money key={field} label={label} value={rule[field]} onChange={(value) => updatePrice(rule.categoryId, field, value)} />)}</div>
    </article>)}</div>
  </>
}

function DashboardPreferences({ settings, options, selectedKpis, toggleKpi, moveKpi, updateSetting }) {
  return <><Title icon={BarChart3} title="Tu resumen de inicio" description="Elige entre uno y cuatro indicadores y ordénalos como quieras verlos." /><label className="mt-6 block text-sm font-bold text-slate-700">Período predeterminado<select value={settings.dashboardPeriod} onChange={(event) => updateSetting('dashboardPeriod', event.target.value)} className="sale-input mt-2 max-w-sm"><option value="today">Hoy</option><option value="week">Esta semana</option><option value="month">Este mes</option></select></label><div className="mt-6 grid gap-6 xl:grid-cols-2"><div><h3 className="text-sm font-extrabold text-slate-900">Indicadores disponibles</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{options.map((option) => { const checked = settings.dashboardKpis.includes(option.id); return <button key={option.id} type="button" aria-pressed={checked} onClick={() => toggleKpi(option.id)} className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 text-left text-sm font-bold ${checked ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-slate-200 text-slate-600'}`}><span className={`grid size-5 place-items-center rounded-md border ${checked ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300'}`}>{checked && <Check size={14} />}</span>{option.label}</button>})}</div></div><div><h3 className="text-sm font-extrabold text-slate-900">Orden en el inicio</h3><div className="mt-3 space-y-2">{selectedKpis.map((option, index) => <div key={option.id} className="flex min-h-12 items-center gap-3 rounded-xl bg-slate-50 px-3"><span className="grid size-7 place-items-center rounded-lg bg-brand-900 text-xs font-extrabold text-white">{index + 1}</span><span className="min-w-0 flex-1 text-sm font-bold text-slate-700">{option.label}</span><button type="button" disabled={index === 0} onClick={() => moveKpi(index, -1)} className="rounded-lg p-2 text-slate-500 disabled:opacity-25" aria-label={`Subir ${option.label}`}><ArrowUp size={17} /></button><button type="button" disabled={index === selectedKpis.length - 1} onClick={() => moveKpi(index, 1)} className="rounded-lg p-2 text-slate-500 disabled:opacity-25" aria-label={`Bajar ${option.label}`}><ArrowDown size={17} /></button></div>)}</div></div></div></>
}

function DefaultPreferences({ settings, updateSetting, last, copyDefaults, terms }) {
  return <>
    <Title icon={Settings2} title="Valores habituales" description="Plantillas para comenzar una operación, no pagos ni ganancias ya registrados. Puedes ajustarlas o recuperar valores de tus registros; se conservan al guardar preferencias." />
    <DefaultsGroup title="Ventas" description="Puedes copiar el método del primer pago y el estado actual de la última venta. Cada nueva venta sigue necesitando sus importes y validaciones." action={last.sale && <CopyButton onClick={() => copyDefaults({ defaultPaymentMethod: last.sale.method, defaultPaymentStatus: last.sale.status })}>Usar valores de última venta</CopyButton>}>
      <label className="text-sm font-bold text-slate-700">Método de pago<select value={settings.defaultPaymentMethod} onChange={(event) => updateSetting('defaultPaymentMethod', event.target.value)} className="sale-input mt-2">{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label>
      <label className="text-sm font-bold text-slate-700">Estado de pago<select value={settings.defaultPaymentStatus} onChange={(event) => updateSetting('defaultPaymentStatus', event.target.value)} className="sale-input mt-2"><option value="paid">Pago completo</option><option value="partial">Pago parcial</option><option value="pending">Sin pago inicial</option></select></label>
    </DefaultsGroup>
    <DefaultsGroup title={terms.purchasePlural} description="La ganancia deseada es tu objetivo, no dinero ganado ni efectivo en caja." action={last.purchase && <CopyButton onClick={() => copyDefaults({ defaultTargetProfitAmount: last.purchase.targetProfitAmount })}>Usar objetivo de última compra</CopyButton>}>
      <Money label={`Ganancia deseada para nuevas ${terms.purchasePluralLower}`} value={settings.defaultTargetProfitAmount} onChange={(value) => updateSetting('defaultTargetProfitAmount', value)} />
    </DefaultsGroup>
    <DefaultsGroup title="Envíos" description="Costo: lo que pagas al repartidor. Cobro: lo que paga el cliente. Solo aplican cuando eliges delivery." action={last.delivery && <CopyButton onClick={() => copyDefaults({ defaultDeliveryCost: last.delivery.deliveryCost, defaultDeliveryCharge: last.delivery.deliveryCharge })}>Usar valores del último envío</CopyButton>}>
      <Money label="Costo habitual de delivery" value={settings.defaultDeliveryCost} onChange={(value) => updateSetting('defaultDeliveryCost', value)} />
      <Money label="Cobro habitual de delivery" value={settings.defaultDeliveryCharge} onChange={(value) => updateSetting('defaultDeliveryCharge', value)} />
    </DefaultsGroup>
    <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-50 p-4"><input type="checkbox" checked={settings.warnBelowRecommended} onChange={(event) => updateSetting('warnBelowRecommended', event.target.checked)} className="mt-0.5 size-5 accent-brand-800" /><span><b className="block text-sm text-brand-950">Avisar cuando el precio esté bajo</b><span className="mt-1 block text-xs text-brand-700">Marca precios debajo del costo o del recomendado antes de registrar una venta.</span></span></label>
  </>
}

function CopyButton({ children, onClick }) { return <button type="button" onClick={onClick} className="mt-3 min-h-10 rounded-lg bg-brand-50 px-3 text-xs font-extrabold text-brand-800">{children}</button> }
function DefaultsGroup({ title, description, action, children }) { return <article className="mt-5 rounded-2xl border border-slate-200 p-4"><h3 className="font-extrabold text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-500">{description}</p>{action}<div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div></article> }

function Title({ icon: Icon, title, description }) { return <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon size={21} /></span><div><h2 className="text-lg font-extrabold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div></div> }
function Money({ label, value, onChange }) { return <label className="text-sm font-bold text-slate-700">{label}<div className="relative mt-2"><span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">C$</span><input type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} className="sale-input sale-input--currency" /></div></label> }

export default BusinessPreferencesPage

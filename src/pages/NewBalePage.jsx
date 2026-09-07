import { useMemo, useState } from 'react'
import { BadgeDollarSign, CircleCheck, PackageCheck, PackagePlus, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import { formatCurrency } from '../utils/currency'
import { formatShortDate } from '../utils/dates'
import { usePacaData } from '../context/PacaDataContext'

const today = new Date().toISOString().slice(0, 10)
const blankEntry = () => ({ id: crypto.randomUUID(), name: '', quantity: '', damagedPieces: '0', damageReason: '' })
const clean = (value) => value.trim().replace(/\s+/g, ' ')

function NewBalePage() {
  const { data, createBale, isLoading } = usePacaData()
  const [form, setForm] = useState({ purchaseDate: today, purchaseCost: '', transportCost: '0', otherExpenses: '0', entries: [blankEntry()] })
  const [formError, setFormError] = useState('')
  const [registeredBale, setRegisteredBale] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const totals = useMemo(() => {
    const receivedPieces = form.entries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0)
    const damagedPieces = form.entries.reduce((sum, entry) => sum + (Number(entry.damagedPieces) || 0), 0)
    const totalInvestment = (Number(form.purchaseCost) || 0) + (Number(form.transportCost) || 0) + (Number(form.otherExpenses) || 0)
    const sellablePieces = Math.max(0, receivedPieces - damagedPieces)
    return { receivedPieces, damagedPieces, totalInvestment, sellablePieces, costPerPiece: sellablePieces ? totalInvestment / sellablePieces : 0 }
  }, [form])
  const update = (field, value) => { setForm((current) => ({ ...current, [field]: value })); setFormError('') }
  const updateEntry = (id, field, value) => { setForm((current) => ({ ...current, entries: current.entries.map((item) => item.id === id ? { ...item, [field]: value } : item) })); setFormError('') }
  const addEntry = () => setForm((current) => ({ ...current, entries: [...current.entries, blankEntry()] }))
  const removeEntry = (id) => setForm((current) => current.entries.length === 1 ? current : { ...current, entries: current.entries.filter((item) => item.id !== id) })

  async function submit(event) {
    event.preventDefault()
    const purchaseCost = Number(form.purchaseCost) || 0
    if (!form.purchaseDate || purchaseCost <= 0) { setFormError('Selecciona la fecha e ingresa el costo de compra.'); return }
    const names = new Set(); const categoryEntries = []
    for (const entry of form.entries) {
      const name = clean(entry.name); const quantity = Number(entry.quantity) || 0; const damagedPieces = Number(entry.damagedPieces) || 0; const damageReason = clean(entry.damageReason)
      if (!name || quantity < 1) { setFormError('Cada categoría necesita nombre y al menos una pieza.'); return }
      if (name.length > 80 || names.has(name.toLocaleLowerCase('es'))) { setFormError('No repitas categorías y usa nombres de hasta 80 caracteres.'); return }
      if (damagedPieces < 0 || damagedPieces > quantity) { setFormError(`Revisa los daños de ${name}.`); return }
      if (damagedPieces > 0 && !damageReason) { setFormError(`Escribe el motivo del daño en ${name}.`); return }
      names.add(name.toLocaleLowerCase('es')); categoryEntries.push({ name, quantity, damagedPieces, damageReason })
    }
    setIsSaving(true)
    try {
      const bale = await createBale({ purchaseDate: form.purchaseDate, purchaseCost, transportCost: Number(form.transportCost) || 0, otherExpenses: Number(form.otherExpenses) || 0, receivedPieces: totals.receivedPieces, categoryEntries })
      setRegisteredBale({ ...bale, ...totals })
    } catch (error) { setFormError(error.message || 'No fue posible registrar la paca.') } finally { setIsSaving(false) }
  }
  if (registeredBale) return <Confirmation bale={registeredBale} onAgain={() => { setRegisteredBale(null); setForm({ purchaseDate: today, purchaseCost: '', transportCost: '0', otherExpenses: '0', entries: [blankEntry()] }) }} />
  return <div><PageHeader eyebrow="Nueva inversión" title="Registrar paca" description="Divide una paca variada en las categorías reales que contiene." backTo="/pacas" /><div className="page-content py-6 md:py-8"><form className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] lg:gap-8" onSubmit={submit}><div className="space-y-5">
    <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><PackagePlus size={21} /></span><div><h2 className="text-lg font-extrabold text-slate-900">Datos de la compra</h2><p className="mt-1 text-sm text-slate-500">Una paca puede tener varias categorías.</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Fecha de compra"><input type="date" required value={form.purchaseDate} onChange={(e) => update('purchaseDate', e.target.value)} className="sale-input" /></Field><Money label="Costo de compra" required value={form.purchaseCost} onChange={(e) => update('purchaseCost', e.target.value)} /><Money label="Transporte" value={form.transportCost} onChange={(e) => update('transportCost', e.target.value)} /><Money label="Otros gastos" value={form.otherExpenses} onChange={(e) => update('otherExpenses', e.target.value)} /></div></section>
    <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold text-slate-900">Clasificación de la paca</h2><p className="mt-1 text-sm text-slate-500">Escribe categorías nuevas o reutiliza las existentes.</p></div><button type="button" onClick={addEntry} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-brand-50 px-3 text-xs font-extrabold text-brand-800"><Plus size={16} />Agregar</button></div><datalist id="categories">{data.categories.map((category) => <option key={category.id} value={category.name} />)}</datalist><div className="mt-5 space-y-4">{form.entries.map((entry, index) => <div key={entry.id} className="rounded-2xl border border-slate-200 p-4"><div className="mb-3 flex justify-between"><b className="text-sm text-slate-700">Categoría {index + 1}</b>{form.entries.length > 1 && <button type="button" onClick={() => removeEntry(entry.id)} className="text-coral-600" aria-label="Quitar categoría"><Trash2 size={18} /></button>}</div><div className="grid gap-3 sm:grid-cols-3"><Field label="Nombre"><input list="categories" placeholder="Ej. Deportiva" value={entry.name} onChange={(e) => updateEntry(entry.id, 'name', e.target.value)} className="sale-input" /></Field><Field label="Piezas"><input type="number" min="1" value={entry.quantity} onChange={(e) => updateEntry(entry.id, 'quantity', e.target.value)} className="sale-input" /></Field><Field label="Dañadas"><input type="number" min="0" max={Number(entry.quantity) || undefined} value={entry.damagedPieces} onChange={(e) => updateEntry(entry.id, 'damagedPieces', e.target.value)} className="sale-input" /></Field></div>{Number(entry.damagedPieces) > 0 && <Field label="Motivo del daño"><input placeholder="Ej. Manchas" value={entry.damageReason} onChange={(e) => updateEntry(entry.id, 'damageReason', e.target.value)} className="sale-input" /></Field>}</div>)}</div></section></div>
    <aside className="rounded-3xl bg-brand-950 p-5 text-white shadow-lg shadow-brand-950/15 lg:sticky lg:top-8 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-white/10"><BadgeDollarSign size={21} /></span><b>Resumen de inversión</b></div><dl className="mt-6 space-y-4 border-y border-white/10 py-5 text-sm"><Row label="Categorías" value={form.entries.length} /><Row label="Piezas recibidas" value={`${totals.receivedPieces} prendas`} /><Row label="Dañadas" value={`${totals.damagedPieces} prendas`} /><Row label="Disponibles" value={`${totals.sellablePieces} prendas`} /><Row label="Costo por pieza" value={totals.sellablePieces ? formatCurrency(totals.costPerPiece) : '—'} /></dl><p className="mt-5 text-3xl font-extrabold">{formatCurrency(totals.totalInvestment)}</p>{formError && <p role="alert" className="mt-4 rounded-xl bg-coral-500/15 p-3 text-sm font-semibold">{formError}</p>}<button type="submit" disabled={isSaving || isLoading} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-brand-950 disabled:opacity-60"><PackageCheck size={19} />{isSaving ? 'Guardando…' : 'Registrar paca'}</button></aside></form></div></div>
}
const Field = ({ label, children }) => <label className="block text-sm font-bold text-slate-700"><span className="mb-2 block">{label}</span>{children}</label>
const Money = ({ label, value, onChange, required }) => <Field label={label}><div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">C$</span><input type="number" min="0" required={required} value={value} onChange={onChange} className="sale-input sale-input--currency" /></div></Field>
const Row = ({ label, value }) => <div className="flex justify-between gap-3"><dt className="text-brand-200">{label}</dt><dd className="font-bold">{value}</dd></div>
function Confirmation({ bale, onAgain }) { return <div className="page-content py-6"><section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center shadow-soft"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><CircleCheck size={28} /></span><p className="mt-4 font-bold text-emerald-700">Paca registrada</p><h2 className="mt-1 text-2xl font-extrabold">{bale.code}</h2><p className="mt-3 text-slate-600">{bale.receivedPieces} piezas distribuidas en: {bale.categoryNames.join(', ')}.</p><p className="mt-2 font-bold">Disponibles: {bale.sellablePieces} · Inversión: {formatCurrency(bale.totalInvestment)}</p><div className="mt-6 flex justify-center gap-3"><button onClick={onAgain} className="rounded-xl bg-brand-950 px-5 py-3 font-bold text-white">Registrar otra</button><Link to="/pacas" className="rounded-xl border px-5 py-3 font-bold">Ver pacas</Link></div></section></div> }
export default NewBalePage

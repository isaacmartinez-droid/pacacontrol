import { useEffect, useState } from 'react'
import { Archive, CircleAlert, LoaderCircle, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { formatCurrency } from '../utils/currency'
import { inventoryPricingLevels as pricingLevels } from '../utils/pricing'

const clean = (value) => value.trim().replace(/\s+/g, ' ')
const blankOtherExpense = (amount = '') => ({ id: crypto.randomUUID(), concept: '', amount: amount === '' ? '' : String(amount) })

export default function EditBalePage() {
  const { baleId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, updateBale, archiveBale } = usePacaData()
  const bale = data.bales.find((item) => item.id === baleId)
  const inventory = data.baleInventory.filter((item) => item.baleId === baleId)
  const storedOtherExpenses = data.baleOtherExpenses.filter((item) => item.baleId === baleId)
  const [form, setForm] = useState(null)
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (bale && !form) {
      const hasBreakdown = storedOtherExpenses.length > 0 || bale.otherExpenses === 0
      setForm({
        purchaseDate: bale.purchaseDate,
        purchaseCost: bale.purchaseCost,
        transportCost: bale.acquisitionTransport,
        targetProfitAmount: bale.targetProfitAmount,
        notes: bale.notes,
        otherExpenseMode: hasBreakdown ? 'detailed' : 'legacy',
        otherExpenseItems: storedOtherExpenses.map((item) => ({ id: item.id, concept: item.concept, amount: String(item.amount) })),
        inventoryLines: inventory.map((item) => ({
          id: item.id,
          categoryName: item.categoryName,
          receivedPieces: item.receivedPieces,
          minimumPieces: item.soldPieces + item.damagedPieces,
          priceLevel: item.priceLevel,
          customRecommendedPrice: item.customRecommendedPrice || '',
        })),
      })
    }
  }, [bale, form, inventory, storedOtherExpenses])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setMessage('')
  }

  function updateInventory(id, field, value) {
    setForm((current) => ({
      ...current,
      inventoryLines: current.inventoryLines.map((line) => line.id === id
        ? { ...line, [field]: value, ...(field === 'priceLevel' && value !== 'custom' ? { customRecommendedPrice: '' } : {}) }
        : line),
    }))
    setMessage('')
  }

  function startBreakdown() {
    setForm((current) => ({
      ...current,
      otherExpenseMode: 'detailed',
      otherExpenseItems: [blankOtherExpense(bale.otherExpenses)],
    }))
    setMessage('Escribe el concepto real antes de guardar. El monto anterior se colocó solo para ayudarte a desglosarlo.')
  }

  function addOtherExpense() {
    setForm((current) => ({ ...current, otherExpenseItems: [...current.otherExpenseItems, blankOtherExpense()] }))
    setMessage('')
  }

  function updateOtherExpense(id, field, value) {
    setForm((current) => ({
      ...current,
      otherExpenseItems: current.otherExpenseItems.map((item) => item.id === id ? { ...item, [field]: value } : item),
    }))
    setMessage('')
  }

  function removeOtherExpense(id) {
    setForm((current) => ({ ...current, otherExpenseItems: current.otherExpenseItems.filter((item) => item.id !== id) }))
    setMessage('')
  }

  async function submit(event) {
    event.preventDefault()
    if (bale.isArchived) return setMessage('Reactiva la paca antes de corregir sus datos.')

    let otherExpenseItems = null
    if (form.otherExpenseMode === 'detailed') {
      otherExpenseItems = []
      for (const item of form.otherExpenseItems) {
        const concept = clean(item.concept)
        const amount = Number(item.amount)
        if (!concept || concept.length > 160 || !Number.isFinite(amount) || amount <= 0) {
          return setMessage('Cada otro gasto necesita un concepto y un monto mayor que cero.')
        }
        otherExpenseItems.push({ concept, amount })
      }
    }

    const values = {
      ...form,
      purchaseCost: Number(form.purchaseCost),
      transportCost: Number(form.transportCost) || 0,
      targetProfitAmount: Number(form.targetProfitAmount) || 0,
      otherExpenseItems,
      inventoryLines: form.inventoryLines.map((line) => ({ ...line, receivedPieces: Number(line.receivedPieces) })),
    }
    if (!values.purchaseDate || values.purchaseCost <= 0) return setMessage('Revisa la fecha y el costo de compra.')
    if (values.targetProfitAmount < 0) return setMessage('La ganancia deseada no puede ser negativa.')
    if (values.inventoryLines.some((line) => !Number.isInteger(line.receivedPieces) || line.receivedPieces < line.minimumPieces)) return setMessage('Una cantidad no puede ser menor que sus piezas vendidas y dañadas.')
    if (values.inventoryLines.some((line) => line.priceLevel === 'custom' && !(Number(line.customRecommendedPrice) > 0))) return setMessage('Escribe el precio personalizado de cada categoría marcada como personalizada.')

    setIsSaving(true)
    try {
      await updateBale(baleId, values)
      navigate(`/pacas?paca=${encodeURIComponent(baleId)}`, { replace: true })
    } catch (error) {
      setMessage(error.message || 'No fue posible editar la paca.')
    } finally {
      setIsSaving(false)
    }
  }

  async function changeArchive() {
    const prompt = bale.isArchived
      ? `¿Reactivar ${bale.code}? Su inventario volverá a estar disponible.`
      : `¿Archivar ${bale.code}? No se borrarán ventas ni pagos. Su inventario dejará de estar disponible.`
    if (!window.confirm(prompt)) return
    setIsDeleting(true)
    setMessage('')
    try {
      await archiveBale(baleId, !bale.isArchived)
      navigate('/pacas', { replace: true })
    } catch (error) {
      setMessage(error.message || 'No fue posible cambiar el archivo de la paca.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!bale && !isLoading) return <div><PageHeader title="Paca no encontrada" backTo="/pacas" /><div className="page-content py-6"><EmptyState icon={CircleAlert} title="Esta paca no está disponible" description="Puede no pertenecer a esta cuenta." /></div></div>
  if (!form) return <div><PageHeader title="Cargando paca…" backTo="/pacas" /></div>

  const detailedTotal = form.otherExpenseItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  return <div>
    <PageHeader eyebrow="Compras e inversión" title={`Editar ${bale.code}`} description="Corrige costos, fecha, ganancia objetivo y cantidades sin perder el historial." backTo={`/pacas?paca=${encodeURIComponent(baleId)}`} />
    <div className="page-content py-6 md:py-8">
      <form onSubmit={submit} className="max-w-4xl space-y-5">
        <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
          <h2 className="text-lg font-extrabold text-slate-900">Datos de la paca</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Fecha de compra"><input type="date" required value={form.purchaseDate} onChange={(event) => update('purchaseDate', event.target.value)} className="sale-input" /></Field>
            <Money label="Costo de compra" value={form.purchaseCost} onChange={(value) => update('purchaseCost', value)} required />
            <Money label="Transporte" value={form.transportCost} onChange={(value) => update('transportCost', value)} />
            <Money label="Ganancia deseada para toda la paca" value={form.targetProfitAmount} onChange={(value) => update('targetProfitAmount', value)} required />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-extrabold text-slate-900">Otros gastos de la compra</h3><p className="mt-1 text-xs text-slate-500">Cada monto nuevo debe quedar asociado a su concepto real.</p></div>
              {form.otherExpenseMode === 'detailed' && <button type="button" onClick={addOtherExpense} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-brand-50 px-3 text-xs font-extrabold text-brand-800"><Plus size={16} />Agregar otro gasto</button>}
            </div>
            {form.otherExpenseMode === 'legacy' ? <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              <p><b>{formatCurrency(bale.otherExpenses)}</b> corresponde a un total histórico que no tenía conceptos guardados.</p>
              <p className="mt-1 text-xs">El sistema no supondrá en qué se gastó. Puedes conservarlo así o desglosarlo con información real.</p>
              <button type="button" onClick={startBreakdown} className="mt-3 min-h-10 rounded-xl bg-white px-4 text-xs font-extrabold text-amber-900 ring-1 ring-amber-200">Desglosar este total</button>
            </div> : <>
              {form.otherExpenseItems.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No hay otros gastos en esta compra.</p> : <div className="mt-4 space-y-3">{form.otherExpenseItems.map((item, index) => <div key={item.id} className="grid items-end gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
                <Field label={`Concepto de otro gasto ${index + 1}`}><input maxLength="160" value={item.concept} onChange={(event) => updateOtherExpense(item.id, 'concept', event.target.value)} className="sale-input" /></Field>
                <Money label={`Monto de otro gasto ${index + 1}`} value={item.amount} onChange={(value) => updateOtherExpense(item.id, 'amount', value)} required />
                <button type="button" onClick={() => removeOtherExpense(item.id)} aria-label={`Quitar otro gasto ${index + 1}`} className="mb-1 grid size-11 place-items-center rounded-xl text-coral-600 hover:bg-red-50"><Trash2 size={18} /></button>
              </div>)}</div>}
              <p className="mt-4 text-right text-sm font-extrabold text-brand-900">Total de otros gastos: {formatCurrency(detailedTotal)}</p>
            </>}
          </div>

          <div className="mt-5"><Field label="Notas"><textarea rows="3" maxLength="1000" value={form.notes} onChange={(event) => update('notes', event.target.value)} className="sale-input mt-2 resize-y" /></Field></div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
          <h2 className="text-lg font-extrabold text-slate-900">Piezas por categoría</h2>
          <p className="mt-1 text-sm text-slate-500">Puedes corregir o aumentar cantidades y cambiar su nivel de precio. Nunca pueden quedar por debajo de lo vendido o dañado.</p>
          <div className="mt-5 space-y-3">{form.inventoryLines.map((line) => <div key={line.id} className="rounded-2xl bg-slate-50 p-4">
            <div><p className="font-extrabold text-slate-900">{line.categoryName}</p><p className="mt-1 text-xs text-slate-500">Mínimo permitido: {line.minimumPieces}</p></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Piezas recibidas"><input type="number" min={line.minimumPieces} step="1" value={line.receivedPieces} onChange={(event) => updateInventory(line.id, 'receivedPieces', event.target.value)} className="sale-input" /></Field>
              <Field label="Nivel de precio"><select value={line.priceLevel} onChange={(event) => updateInventory(line.id, 'priceLevel', event.target.value)} className="sale-input">{pricingLevels.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}</select></Field>
              {line.priceLevel === 'custom' && <Money label="Precio personalizado" value={line.customRecommendedPrice} onChange={(value) => updateInventory(line.id, 'customRecommendedPrice', value)} required />}
            </div>
          </div>)}</div>
        </section>

        {message && <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button type="button" disabled={isDeleting || isSaving} onClick={changeArchive} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-extrabold text-red-700 disabled:opacity-50">{bale.isArchived ? <RotateCcw size={18} /> : <Archive size={18} />}{isDeleting ? 'Procesando…' : bale.isArchived ? 'Reactivar paca' : 'Archivar paca'}</button>
          <button type="submit" disabled={isSaving || isDeleting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-950 px-6 text-sm font-extrabold text-white disabled:opacity-50">{isSaving ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}{isSaving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </div>
  </div>
}

function Field({ label, children }) {
  return <label className="block text-sm font-bold text-slate-700"><span className="mb-2 block">{label}</span>{children}</label>
}

function Money({ label, value, onChange, required = false }) {
  return <Field label={label}><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">C$</span><input type="number" min="0" step="0.01" required={required} value={value} onChange={(event) => onChange(event.target.value)} className="sale-input sale-input--currency" /></div></Field>
}

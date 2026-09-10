import { useEffect, useState } from 'react'
import { CircleAlert, LoaderCircle, Save, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { pricingLevels } from '../utils/pricing'

export default function EditBalePage() {
  const { baleId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, updateBale, deleteBale } = usePacaData()
  const bale = data.bales.find((item) => item.id === baleId)
  const inventory = data.baleInventory.filter((item) => item.baleId === baleId)
  const [form, setForm] = useState(null)
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (bale && !form) setForm({
      purchaseDate: bale.purchaseDate,
      purchaseCost: bale.purchaseCost,
      transportCost: bale.acquisitionTransport,
      otherExpenses: bale.otherExpenses,
      targetMargin: bale.targetMargin,
      notes: bale.notes,
      inventoryLines: inventory.map((item) => ({
        id: item.id,
        categoryName: item.categoryName,
        receivedPieces: item.receivedPieces,
        minimumPieces: item.soldPieces + item.damagedPieces,
        priceLevel: item.priceLevel,
        customRecommendedPrice: item.customRecommendedPrice || '',
      })),
    })
  }, [bale, form, inventory])

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); setMessage('') }
  function updateInventory(id, field, value) { setForm((current) => ({ ...current, inventoryLines: current.inventoryLines.map((line) => line.id === id ? { ...line, [field]: value, ...(field === 'priceLevel' && value !== 'custom' ? { customRecommendedPrice: '' } : {}) } : line) })); setMessage('') }

  async function submit(event) {
    event.preventDefault()
    const values = {
      ...form,
      purchaseCost: Number(form.purchaseCost),
      transportCost: Number(form.transportCost) || 0,
      otherExpenses: Number(form.otherExpenses) || 0,
      targetMargin: Number(form.targetMargin),
      inventoryLines: form.inventoryLines.map((line) => ({ ...line, receivedPieces: Number(line.receivedPieces) })),
    }
    if (!values.purchaseDate || values.purchaseCost <= 0) return setMessage('Revisa la fecha y el costo de compra.')
    if (values.targetMargin < 1 || values.targetMargin > 90) return setMessage('El margen debe estar entre 1% y 90%.')
    if (values.inventoryLines.some((line) => !Number.isInteger(line.receivedPieces) || line.receivedPieces < line.minimumPieces)) return setMessage('Una cantidad no puede ser menor que sus piezas vendidas y dañadas.')
    if (values.inventoryLines.some((line) => line.priceLevel === 'custom' && !(Number(line.customRecommendedPrice) > 0))) return setMessage('Escribe el precio personalizado de cada categoría marcada como personalizada.')
    setIsSaving(true)
    try {
      await updateBale(baleId, values)
      navigate(`/pacas?paca=${encodeURIComponent(baleId)}`, { replace: true })
    } catch (error) { setMessage(error.message || 'No fue posible editar la paca.') }
    finally { setIsSaving(false) }
  }

  async function remove() {
    if (!window.confirm(`¿Borrar ${bale.code}? Esta acción solo se permitirá si no tiene ventas ni daños.`)) return
    setIsDeleting(true)
    setMessage('')
    try {
      await deleteBale(baleId)
      navigate('/pacas', { replace: true })
    } catch (error) { setMessage(error.message || 'No fue posible borrar la paca.') }
    finally { setIsDeleting(false) }
  }

  if (!bale && !isLoading) return <div><PageHeader title="Paca no encontrada" backTo="/pacas" /><div className="page-content py-6"><EmptyState icon={CircleAlert} title="Esta paca no está disponible" description="Puede haberse eliminado o no pertenecer a esta cuenta." /></div></div>
  if (!form) return <div><PageHeader title="Cargando paca…" backTo="/pacas" /></div>

  return <div><PageHeader eyebrow="Compras e inversión" title={`Editar ${bale.code}`} description="Corrige costos, fecha, margen y cantidades sin perder el historial." backTo={`/pacas?paca=${encodeURIComponent(baleId)}`} /><div className="page-content py-6 md:py-8"><form onSubmit={submit} className="max-w-4xl space-y-5"><section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6"><h2 className="text-lg font-extrabold text-slate-900">Datos de la paca</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Fecha de compra"><input type="date" required value={form.purchaseDate} onChange={(event) => update('purchaseDate', event.target.value)} className="sale-input" /></Field><Money label="Costo de compra" value={form.purchaseCost} onChange={(value) => update('purchaseCost', value)} required /><Money label="Transporte" value={form.transportCost} onChange={(value) => update('transportCost', value)} /><Money label="Otros gastos" value={form.otherExpenses} onChange={(value) => update('otherExpenses', value)} /><Field label="Margen deseado"><div className="relative"><input type="number" min="1" max="90" value={form.targetMargin} onChange={(event) => update('targetMargin', event.target.value)} className="sale-input pr-10" /><span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">%</span></div></Field></div><Field label="Notas"><textarea rows="3" maxLength="1000" value={form.notes} onChange={(event) => update('notes', event.target.value)} className="sale-input mt-2 resize-y" /></Field></section><section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6"><h2 className="text-lg font-extrabold text-slate-900">Piezas por categoría</h2><p className="mt-1 text-sm text-slate-500">Puedes corregir o aumentar cantidades y cambiar su nivel de precio. Nunca pueden quedar por debajo de lo vendido o dañado.</p><div className="mt-5 space-y-3">{form.inventoryLines.map((line) => <div key={line.id} className="rounded-2xl bg-slate-50 p-4"><div><p className="font-extrabold text-slate-900">{line.categoryName}</p><p className="mt-1 text-xs text-slate-500">Mínimo permitido: {line.minimumPieces}</p></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Piezas recibidas"><input type="number" min={line.minimumPieces} step="1" value={line.receivedPieces} onChange={(event) => updateInventory(line.id, 'receivedPieces', event.target.value)} className="sale-input" /></Field><Field label="Nivel de precio"><select value={line.priceLevel} onChange={(event) => updateInventory(line.id, 'priceLevel', event.target.value)} className="sale-input">{pricingLevels.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}</select></Field>{line.priceLevel === 'custom' && <Money label="Precio personalizado" value={line.customRecommendedPrice} onChange={(value) => updateInventory(line.id, 'customRecommendedPrice', value)} required />}</div></div>)}</div></section>{message && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{message}</p>}<div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><button type="button" disabled={isDeleting || isSaving} onClick={remove} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-extrabold text-red-700 disabled:opacity-50"><Trash2 size={18} />{isDeleting ? 'Borrando…' : 'Borrar paca'}</button><button type="submit" disabled={isSaving || isDeleting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-950 px-6 text-sm font-extrabold text-white disabled:opacity-50">{isSaving ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}{isSaving ? 'Guardando…' : 'Guardar cambios'}</button></div></form></div></div>
}

function Field({ label, children }) { return <label className="block text-sm font-bold text-slate-700"><span className="mb-2 block">{label}</span>{children}</label> }
function Money({ label, value, onChange, required = false }) { return <Field label={label}><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">C$</span><input type="number" min="0" step="0.01" required={required} value={value} onChange={(event) => onChange(event.target.value)} className="sale-input sale-input--currency" /></div></Field> }

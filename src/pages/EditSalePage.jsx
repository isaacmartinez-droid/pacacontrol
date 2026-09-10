import { useEffect, useMemo, useState } from 'react'
import { CircleAlert, LoaderCircle, PackageCheck, Plus, Save, Store, Trash2, Truck } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { formatCurrency } from '../utils/currency'
import { summarizePriceLines } from '../utils/pricing'

const blankLine = (unitPrice = '') => ({ id: crypto.randomUUID(), quantity: 1, unitPrice })
const blankItem = (categoryId = '') => ({ id: crypto.randomUUID(), categoryId, baleInventoryId: '', priceLines: [blankLine()] })

function itemsFromSale(sale) {
  const grouped = new Map()
  sale.items.forEach((item) => {
    const key = item.baleInventoryId
    if (!grouped.has(key)) grouped.set(key, {
      id: crypto.randomUUID(),
      categoryId: item.categoryId,
      baleInventoryId: item.baleInventoryId,
      priceLines: [],
    })
    grouped.get(key).priceLines.push({ id: crypto.randomUUID(), quantity: item.quantity, unitPrice: item.unitPrice })
  })
  const items = [...grouped.values()]
  return items.length ? items : [blankItem()]
}

export default function EditSalePage() {
  const { saleId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, updateSaleOrder } = usePacaData()
  const sale = data.sales.find((item) => item.id === saleId)
  const [form, setForm] = useState(null)
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (sale && !form) setForm({
      items: itemsFromSale(sale),
      customerId: sale.customerId ?? 'walk-in',
      fulfillmentMethod: sale.fulfillmentMethod,
      deliveryCost: sale.deliveryCost,
      deliveryCharge: sale.deliveryCharge,
      notes: sale.notes,
    })
  }, [form, sale])

  const originalQuantityByInventory = useMemo(() => {
    const quantities = new Map()
    sale?.items.forEach((item) => quantities.set(item.baleInventoryId, (quantities.get(item.baleInventoryId) ?? 0) + item.quantity))
    return quantities
  }, [sale])

  const calculatedItems = useMemo(() => (form?.items ?? []).map((item) => {
    const inventory = data.baleInventory.find((row) => row.id === item.baleInventoryId)
    const priceLines = item.priceLines.map((line) => ({ ...line, quantity: Number(line.quantity) || 0, unitPrice: Number(line.unitPrice) || 0 }))
    const totals = summarizePriceLines(priceLines)
    return {
      ...item,
      inventory,
      category: data.categories.find((category) => category.id === item.categoryId),
      priceLines,
      quantity: totals.quantity,
      merchandiseTotal: totals.merchandiseTotal,
      availablePieces: (inventory?.availablePieces ?? 0) + (originalQuantityByInventory.get(item.baleInventoryId) ?? 0),
      merchandiseCost: totals.quantity * (inventory?.estimatedUnitCost ?? 0),
    }
  }), [data.baleInventory, data.categories, form, originalQuantityByInventory])

  if (!sale && !isLoading) return <div><PageHeader title="Pedido no encontrado" backTo="/ventas" /><div className="page-content py-6"><EmptyState icon={CircleAlert} title="Este pedido no está disponible" description="Puede no pertenecer a esta cuenta o haber sido eliminado." /></div></div>
  if (!form) return <div><PageHeader title="Cargando pedido…" backTo="/ventas" /></div>

  const hasDelivery = form.fulfillmentMethod === 'delivery'
  const deliveryCost = hasDelivery ? Number(form.deliveryCost) || 0 : 0
  const deliveryCharge = hasDelivery ? Number(form.deliveryCharge) || 0 : 0
  const merchandiseTotal = calculatedItems.reduce((sum, item) => sum + item.merchandiseTotal, 0)
  const merchandiseCost = calculatedItems.reduce((sum, item) => sum + item.merchandiseCost, 0)
  const total = merchandiseTotal + deliveryCharge
  const balance = total - sale.paidAmount
  const estimatedProfit = total - merchandiseCost - deliveryCost

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); setMessage('') }
  function updateItem(id, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? {
        ...item,
        [field]: value,
        ...(field === 'categoryId' ? { baleInventoryId: '', priceLines: [blankLine()] } : {}),
        ...(field === 'baleInventoryId' ? { priceLines: [blankLine(data.baleInventory.find((inventory) => inventory.id === value)?.recommendedUnitPrice || '')] } : {}),
      } : item),
    }))
    setMessage('')
  }
  function updateLine(itemId, lineId, field, value) {
    setForm((current) => ({ ...current, items: current.items.map((item) => item.id === itemId ? { ...item, priceLines: item.priceLines.map((line) => line.id === lineId ? { ...line, [field]: value } : line) } : item) }))
    setMessage('')
  }
  function addItem() { setForm((current) => ({ ...current, items: [...current.items, blankItem(data.categories[0]?.id ?? '')] })) }
  function removeItem(id) { setForm((current) => current.items.length === 1 ? current : { ...current, items: current.items.filter((item) => item.id !== id) }) }
  function addLine(itemId) {
    const recommended = calculatedItems.find((item) => item.id === itemId)?.inventory?.recommendedUnitPrice || ''
    setForm((current) => ({ ...current, items: current.items.map((item) => item.id === itemId ? { ...item, priceLines: [...item.priceLines, blankLine(recommended)] } : item) }))
  }
  function removeLine(itemId, lineId) {
    setForm((current) => ({ ...current, items: current.items.map((item) => item.id === itemId && item.priceLines.length > 1 ? { ...item, priceLines: item.priceLines.filter((line) => line.id !== lineId) } : item) }))
  }

  async function submit(event) {
    event.preventDefault()
    if (sale.deliveryStatus === 'delivered') return setMessage('Un pedido entregado ya forma parte del historial y no se puede editar.')
    if (calculatedItems.some((item) => !item.category || !item.inventory)) return setMessage('Selecciona la categoría y la paca de cada artículo.')
    if (new Set(calculatedItems.map((item) => item.baleInventoryId)).size !== calculatedItems.length) return setMessage('No repitas la misma categoría y paca; reúne sus precios en un solo artículo.')
    for (const item of calculatedItems) {
      if (item.priceLines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.unitPrice <= 0)) return setMessage('Cada precio necesita una cantidad entera y un monto mayores que cero.')
      if (item.quantity > item.availablePieces) return setMessage(`${item.inventory.baleCode} solo permite ${item.availablePieces} piezas en este pedido.`)
    }
    if (hasDelivery && form.customerId === 'walk-in') return setMessage('Elige un cliente para realizar el envío.')
    if (hasDelivery && deliveryCost <= 0) return setMessage('Ingresa el costo real del delivery.')
    if (form.customerId === 'walk-in' && balance > 0) return setMessage('Elige un cliente para conservar un saldo pendiente.')
    if (balance < 0) return setMessage(`El nuevo total no puede ser menor que los ${formatCurrency(sale.paidAmount)} ya pagados.`)
    if (sale.secondPaymentAmount > 0 && balance > 0) return setMessage('El pedido ya tiene dos pagos y no puede quedar necesitando un tercer pago.')

    setIsSaving(true)
    setMessage('')
    try {
      await updateSaleOrder(saleId, {
        items: calculatedItems.map((item) => ({ categoryId: item.categoryId, baleInventoryId: item.baleInventoryId, priceLines: item.priceLines })),
        customerId: form.customerId,
        fulfillmentMethod: form.fulfillmentMethod,
        deliveryCost,
        deliveryCharge,
        notes: form.notes,
      })
      navigate('/ventas', { replace: true })
    } catch (error) { setMessage(error.message || 'No fue posible editar el pedido.') }
    finally { setIsSaving(false) }
  }

  return <div>
    <PageHeader eyebrow="Corrección segura" title="Editar pedido" description="Cambia el cliente, los artículos o la entrega sin perder los pagos registrados." backTo="/ventas" />
    <div className="page-content py-6 md:py-8">
      <form onSubmit={submit} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] lg:gap-8">
        <div className="space-y-5">
          <Section title="Artículos del pedido" description="Puedes agregar, quitar o corregir piezas y precios.">
            <button type="button" onClick={addItem} className="mb-4 inline-flex min-h-10 items-center gap-1 rounded-xl bg-brand-900 px-4 text-xs font-extrabold text-white"><Plus size={16} />Agregar artículo</button>
            <div className="space-y-4">{calculatedItems.map((item, index) => {
              const options = data.baleInventory.filter((inventory) => inventory.categoryId === item.categoryId && ((inventory.availablePieces + (originalQuantityByInventory.get(inventory.id) ?? 0)) > 0 || inventory.id === item.baleInventoryId))
              return <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between"><b>Artículo {index + 1}</b>{form.items.length > 1 && <button type="button" onClick={() => removeItem(item.id)} className="p-2 text-red-600" aria-label={`Quitar artículo ${index + 1}`}><Trash2 size={18} /></button>}</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Categoría"><select className="sale-input" value={item.categoryId} onChange={(event) => updateItem(item.id, 'categoryId', event.target.value)}>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="Paca de origen"><select className="sale-input" required value={item.baleInventoryId} onChange={(event) => updateItem(item.id, 'baleInventoryId', event.target.value)}><option value="">Selecciona una paca</option>{options.map((inventory) => <option key={inventory.id} value={inventory.id}>{inventory.baleCode} · {inventory.availablePieces + (originalQuantityByInventory.get(inventory.id) ?? 0)} disponibles para editar</option>)}</select></Field></div>
                <div className="mt-3 space-y-2">{item.priceLines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"><Field label="Cantidad"><input className="sale-input" type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(item.id, line.id, 'quantity', event.target.value)} /></Field><Money label="Precio por pieza" value={line.unitPrice} onChange={(value) => updateLine(item.id, line.id, 'unitPrice', value)} required /><button type="button" disabled={item.priceLines.length === 1} onClick={() => removeLine(item.id, line.id)} className="mb-1 grid size-10 place-items-center rounded-xl text-red-600 disabled:opacity-25" aria-label="Quitar precio"><Trash2 size={17} /></button></div>)}</div>
                <button type="button" onClick={() => addLine(item.id)} className="mt-3 text-xs font-extrabold text-brand-800">+ Otro precio en este artículo</button>
              </article>
            })}</div>
          </Section>

          <Section title="Cliente y entrega" description="Un cliente registrado también puede recoger su pedido.">
            <Field label="Cliente"><select className="sale-input" value={form.customerId} onChange={(event) => update('customerId', event.target.value)}><option value="walk-in">Venta de mostrador</option>{data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></Field>
            <div className="mt-4 grid grid-cols-2 gap-2"><Choice selected={!hasDelivery} onClick={() => update('fulfillmentMethod', 'pickup')} icon={Store} label="Recoge en tienda" /><Choice selected={hasDelivery} onClick={() => update('fulfillmentMethod', 'delivery')} icon={Truck} label="Enviar al cliente" /></div>
            {hasDelivery && <div className="mt-4 grid gap-3 sm:grid-cols-2"><Money label="Costo real del delivery" value={form.deliveryCost} onChange={(value) => update('deliveryCost', value)} required /><Money label="Cobro de delivery al cliente" value={form.deliveryCharge} onChange={(value) => update('deliveryCharge', value)} /></div>}
            <Field label="Notas"><textarea className="sale-input mt-2 resize-y" rows="3" maxLength="1000" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></Field>
          </Section>
        </div>

        <aside className="rounded-3xl bg-brand-950 p-5 text-white shadow-lg lg:sticky lg:top-8">
          <h2 className="flex items-center gap-2 font-extrabold"><PackageCheck size={20} />Nuevo resumen</h2>
          <dl className="mt-5 space-y-3 border-y border-white/10 py-5 text-sm"><Row label="Total prendas" value={formatCurrency(merchandiseTotal)} /><Row label="Cobro delivery" value={formatCurrency(deliveryCharge)} /><Row label="Nuevo total" value={formatCurrency(total)} /><Row label="Ya pagado" value={formatCurrency(sale.paidAmount)} /><Row label="Saldo resultante" value={formatCurrency(Math.max(0, balance))} /><Row label="Ganancia estimada" value={formatCurrency(estimatedProfit)} /></dl>
          <p className="mt-4 rounded-xl bg-white/10 p-3 text-xs leading-5 text-brand-100">Los pagos anteriores no se modifican. Si el nuevo total queda debajo de lo pagado, primero debes resolver la devolución.</p>
          {message && <p role="alert" className="mt-4 rounded-xl bg-red-400/15 p-3 text-sm font-semibold text-red-100">{message}</p>}
          <button type="submit" disabled={isSaving} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-brand-950 disabled:opacity-60">{isSaving ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}{isSaving ? 'Guardando…' : 'Guardar pedido'}</button>
        </aside>
      </form>
    </div>
  </div>
}

function Section({ title, description, children }) { return <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6"><h2 className="text-lg font-extrabold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p><div className="mt-5">{children}</div></section> }
function Field({ label, children }) { return <label className="block text-sm font-bold text-slate-700"><span className="mb-2 block">{label}</span>{children}</label> }
function Money({ label, value, onChange, required = false }) { return <Field label={label}><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">C$</span><input className="sale-input sale-input--currency" type="number" min="0" step="0.01" required={required} value={value} onChange={(event) => onChange(event.target.value)} /></div></Field> }
function Choice({ selected, onClick, icon: Icon, label }) { return <button type="button" aria-pressed={selected} onClick={onClick} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-extrabold ${selected ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-slate-200 text-slate-500'}`}><Icon size={18} />{label}</button> }
function Row({ label, value }) { return <div className="flex justify-between gap-3"><dt className="text-brand-200">{label}</dt><dd className="text-right font-bold">{value}</dd></div> }

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CircleCheck, CreditCard, PackageCheck, PackageX, Plus, ShoppingBag, Store, Trash2, Truck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { formatCurrency } from '../utils/currency'
import { usePacaData } from '../context/PacaDataContext'
import { summarizePriceLines } from '../utils/pricing'

export const paymentMethods = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'transfer', label: 'Transferencia' },
  { id: 'card', label: 'Tarjeta' },
  { id: 'other', label: 'Otro' },
]

const blankPriceLine = (unitPrice = '') => ({ id: crypto.randomUUID(), quantity: 1, unitPrice })
const blankItem = (categoryId = '') => ({ id: crypto.randomUUID(), categoryId, baleInventoryId: '', priceLines: [blankPriceLine()] })
const initialSaleForm = (settings = {}) => ({
  items: [blankItem()],
  customerId: 'walk-in',
  newCustomerName: '',
  newCustomerPhone: '',
  fulfillmentMethod: 'pickup',
  deliveryCost: settings.defaultDeliveryCost ?? 0,
  deliveryCharge: settings.defaultDeliveryCharge ?? 0,
  paymentStatus: settings.defaultPaymentStatus ?? 'paid',
  paymentMethod: settings.defaultPaymentMethod ?? 'cash',
  paidAmount: '',
})

function NewSalePage() {
  const { data, registerSale, createCustomer, isLoading, error } = usePacaData()
  const categories = useMemo(() => data.categories.filter((category) => category.availablePieces > 0), [data.categories])
  const [form, setForm] = useState(() => initialSaleForm(data.settings))
  const [settingsApplied, setSettingsApplied] = useState(false)
  const [formError, setFormError] = useState('')
  const [completedSale, setCompletedSale] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isLoading && !settingsApplied) {
      setForm((current) => ({
        ...current,
        items: current.items.map((item, index) => index === 0 && !item.categoryId ? { ...item, categoryId: categories[0]?.id ?? '' } : item),
        paymentStatus: data.settings.defaultPaymentStatus,
        paymentMethod: data.settings.defaultPaymentMethod,
        deliveryCost: data.settings.defaultDeliveryCost,
        deliveryCharge: data.settings.defaultDeliveryCharge,
      }))
      setSettingsApplied(true)
    }
  }, [categories, data.settings, isLoading, settingsApplied])

  useEffect(() => {
    if (!categories.length) return
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => categories.some((category) => category.id === item.categoryId)
        ? item
        : { ...item, categoryId: categories[0].id, baleInventoryId: '', priceLines: [blankPriceLine()] }),
    }))
  }, [categories])

  const calculatedItems = useMemo(() => form.items.map((item) => {
    const inventory = data.baleInventory.find((row) => row.id === item.baleInventoryId)
    const priceLines = item.priceLines.map((line) => ({ ...line, quantity: Number(line.quantity) || 0, unitPrice: Number(line.unitPrice) || 0 }))
    const totals = summarizePriceLines(priceLines)
    return {
      ...item,
      category: categories.find((category) => category.id === item.categoryId),
      inventory,
      priceLines,
      quantity: totals.quantity,
      merchandiseTotal: totals.merchandiseTotal,
      merchandiseCost: totals.quantity * (inventory?.estimatedUnitCost ?? 0),
    }
  }), [categories, data.baleInventory, form.items])

  const quantity = calculatedItems.reduce((sum, item) => sum + item.quantity, 0)
  const merchandiseTotal = calculatedItems.reduce((sum, item) => sum + item.merchandiseTotal, 0)
  const merchandiseCost = calculatedItems.reduce((sum, item) => sum + item.merchandiseCost, 0)
  const hasDelivery = form.fulfillmentMethod === 'delivery'
  const deliveryCost = hasDelivery ? Number(form.deliveryCost) || 0 : 0
  const deliveryCharge = hasDelivery ? Number(form.deliveryCharge) || 0 : 0
  const total = merchandiseTotal + deliveryCharge
  const firstPayment = form.paymentStatus === 'paid' ? total : form.paymentStatus === 'pending' ? 0 : Number(form.paidAmount) || 0
  const balance = Math.max(0, total - firstPayment)
  const estimatedProfit = total - merchandiseCost - deliveryCost
  const hasPriceWarning = calculatedItems.some((item) => item.priceLines.some((line) => line.unitPrice > 0 && line.unitPrice < (item.inventory?.recommendedUnitPrice ?? 0)))
  const selectedCustomer = data.customers.find((customer) => customer.id === form.customerId)
  const customerName = form.customerId === 'new' ? form.newCustomerName.trim() || 'Cliente nuevo' : selectedCustomer?.name ?? 'Venta de mostrador'

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setFormError('')
  }

  function updateItem(itemId, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId ? {
        ...item,
        [field]: value,
        ...(field === 'categoryId' ? { baleInventoryId: '', priceLines: [blankPriceLine()] } : {}),
        ...(field === 'baleInventoryId' ? {
          priceLines: [blankPriceLine(data.baleInventory.find((inventory) => inventory.id === value)?.recommendedUnitPrice || '')],
        } : {}),
      } : item),
    }))
    setFormError('')
  }

  function updatePriceLine(itemId, lineId, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId ? {
        ...item,
        priceLines: item.priceLines.map((line) => line.id === lineId ? { ...line, [field]: value } : line),
      } : item),
    }))
    setFormError('')
  }

  function addItem() {
    setForm((current) => ({ ...current, items: [...current.items, blankItem(categories[0]?.id ?? '')] }))
  }

  function removeItem(itemId) {
    setForm((current) => current.items.length === 1 ? current : { ...current, items: current.items.filter((item) => item.id !== itemId) })
  }

  function addPriceLine(itemId) {
    const inventory = calculatedItems.find((item) => item.id === itemId)?.inventory
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, priceLines: [...item.priceLines, blankPriceLine(inventory?.recommendedUnitPrice || '')] } : item),
    }))
  }

  function removePriceLine(itemId, lineId) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId && item.priceLines.length > 1
        ? { ...item, priceLines: item.priceLines.filter((line) => line.id !== lineId) }
        : item),
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!calculatedItems.length) return setFormError('Agrega al menos un artículo.')
    if (calculatedItems.some((item) => !item.category || !item.inventory)) return setFormError('Selecciona la categoría y la paca de cada artículo.')
    if (new Set(calculatedItems.map((item) => item.baleInventoryId)).size !== calculatedItems.length) return setFormError('No repitas la misma categoría y paca; agrega sus precios dentro del mismo artículo.')
    for (const item of calculatedItems) {
      if (item.priceLines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.unitPrice <= 0)) return setFormError('Cada precio necesita una cantidad entera y un monto mayores que cero.')
      if (item.quantity > item.inventory.availablePieces) return setFormError(`${item.inventory.baleCode} solo tiene ${item.inventory.availablePieces} piezas disponibles de ${item.category.name}.`)
    }
    if (form.customerId === 'new' && !form.newCustomerName.trim()) return setFormError('Escribe el nombre del cliente nuevo.')
    if (hasDelivery && form.customerId === 'walk-in') return setFormError('Elige o crea un cliente para realizar el envío.')
    if (hasDelivery && deliveryCost <= 0) return setFormError('El costo real del delivery es obligatorio solamente cuando hay envío.')
    if (deliveryCharge < 0) return setFormError('El cobro de delivery no puede ser negativo.')
    if (form.paymentStatus !== 'paid' && form.customerId === 'walk-in') return setFormError('Elige un cliente para dejar un saldo pendiente.')
    if (form.paymentStatus === 'partial' && (!(firstPayment > 0) || firstPayment >= total)) return setFormError('El primer pago debe ser mayor que cero y menor que el total.')

    setIsSaving(true)
    try {
      let customerId = form.customerId
      if (customerId === 'new') {
        const customer = await createCustomer({ name: form.newCustomerName, phone: form.newCustomerPhone, isPriority: false })
        customerId = customer.id
      }
      await registerSale({
        items: calculatedItems.map((item) => ({ categoryId: item.categoryId, baleInventoryId: item.baleInventoryId, priceLines: item.priceLines })),
        customerId,
        fulfillmentMethod: form.fulfillmentMethod,
        deliveryCost,
        deliveryCharge,
        paymentStatus: form.paymentStatus,
        paymentMethod: form.paymentMethod,
        paidAmount: firstPayment,
      })
      setCompletedSale({
        customerName, fulfillmentMethod: form.fulfillmentMethod, items: calculatedItems,
        quantity, total, firstPayment, balance,
        paymentMethod: paymentMethods.find((method) => method.id === form.paymentMethod)?.label,
        estimatedProfit,
      })
    } catch (saveError) {
      setFormError(saveError.message || 'No fue posible registrar la venta.')
    } finally {
      setIsSaving(false)
    }
  }

  if (completedSale) return <div><PageHeader eyebrow="Salida de inventario" title="Registrar venta" backTo="/ventas" /><div className="page-content py-6"><SaleConfirmation sale={completedSale} onAgain={() => { setCompletedSale(null); setForm(initialSaleForm(data.settings)) }} /></div></div>
  const hasInventory = categories.length > 0

  return <div>
    <PageHeader eyebrow="Salida de inventario" title="Registrar venta" description="Agrega todos los artículos del pedido, su forma de entrega y el primer pago." backTo="/ventas" />
    <div className="page-content py-6 md:py-8">
      {!isLoading && !error && !hasInventory ? <EmptyState icon={PackageX} title="No hay piezas disponibles para vender" description="Registra primero una paca con inventario." action={{ to: '/pacas/nueva', label: 'Registrar una paca' }} /> :
      <form className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] lg:gap-8" onSubmit={handleSubmit}>
        <div className="space-y-5">
          <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><ShoppingBag size={21} /></span><div><h2 className="text-lg font-extrabold text-slate-900">Artículos del pedido</h2><p className="mt-1 text-sm text-slate-500">Cada artículo conserva su categoría, paca, cantidad y precio.</p></div></div><button type="button" onClick={addItem} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-brand-900 px-4 text-xs font-extrabold text-white"><Plus size={16} />Agregar artículo</button></div>
            <div className="mt-5 space-y-4">{calculatedItems.map((item, itemIndex) => {
              const baleOptions = data.baleInventory.filter((inventory) => inventory.categoryId === item.categoryId && inventory.availablePieces > 0)
              return <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3"><h3 className="font-extrabold text-slate-900">Artículo {itemIndex + 1}</h3>{form.items.length > 1 && <button type="button" onClick={() => removeItem(item.id)} className="rounded-lg p-2 text-coral-600" aria-label={`Quitar artículo ${itemIndex + 1}`}><Trash2 size={18} /></button>}</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Categoría"><select value={item.categoryId} onChange={(event) => updateItem(item.id, 'categoryId', event.target.value)} className="sale-input">{categories.map((category) => <option key={category.id} value={category.id}>{category.name} · {category.availablePieces} disponibles</option>)}</select></Field><Field label="Paca de origen"><select required value={item.baleInventoryId} onChange={(event) => updateItem(item.id, 'baleInventoryId', event.target.value)} className="sale-input"><option value="">Selecciona una paca</option>{baleOptions.map((inventory) => <option key={inventory.id} value={inventory.id}>{inventory.baleCode} · {inventory.availablePieces} disponibles · sugerido {formatCurrency(inventory.recommendedUnitPrice)}</option>)}</select></Field></div>
                {item.inventory && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-50 p-3 text-xs text-brand-800"><span>Costo {formatCurrency(item.inventory.estimatedUnitCost)} · sugerido <b>{formatCurrency(item.inventory.recommendedUnitPrice)}</b></span><button type="button" onClick={() => setForm((current) => ({ ...current, items: current.items.map((row) => row.id === item.id ? { ...row, priceLines: row.priceLines.map((line) => ({ ...line, unitPrice: item.inventory.recommendedUnitPrice })) } : row) }))} className="font-extrabold underline">Aplicar a este artículo</button></div>}
                <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs font-bold text-slate-500">Cantidades con el mismo precio</p><button type="button" onClick={() => addPriceLine(item.id)} className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-800"><Plus size={15} />Otro precio</button></div>
                <div className="mt-2 space-y-2">{item.priceLines.map((line, lineIndex) => {
                  const belowCost = item.inventory && line.unitPrice > 0 && line.unitPrice < item.inventory.estimatedUnitCost
                  const belowRecommended = item.inventory && line.unitPrice >= item.inventory.estimatedUnitCost && line.unitPrice < item.inventory.recommendedUnitPrice
                  const warning = data.settings.warnBelowRecommended && (belowCost || belowRecommended)
                  return <div key={line.id} className={`rounded-xl border p-3 ${warning ? belowCost ? 'border-red-200 bg-red-50/40' : 'border-amber-200 bg-amber-50/40' : 'border-slate-100 bg-slate-50/50'}`}><div className="grid items-end gap-2 sm:grid-cols-[0.55fr_1fr_0.75fr_auto]"><Field label={`Cantidad ${lineIndex + 1}`}><input type="number" min="1" value={line.quantity} onChange={(event) => updatePriceLine(item.id, line.id, 'quantity', event.target.value)} className="sale-input" /></Field><MoneyField label="Precio por pieza" value={line.unitPrice} min="1" onChange={(value) => updatePriceLine(item.id, line.id, 'unitPrice', value)} /><div className="rounded-xl bg-white p-3 text-right"><p className="text-[0.65rem] text-slate-500">Subtotal</p><b className="text-sm">{formatCurrency(line.quantity * line.unitPrice)}</b></div>{item.priceLines.length > 1 && <button type="button" onClick={() => removePriceLine(item.id, line.id)} className="mb-1 rounded-lg p-2 text-coral-600" aria-label="Quitar precio"><Trash2 size={17} /></button>}</div>{warning && <p className={`mt-2 flex items-center gap-1 text-xs font-bold ${belowCost ? 'text-red-700' : 'text-amber-800'}`}><AlertTriangle size={14} />{belowCost ? 'Este precio está debajo del costo.' : 'Este precio está debajo del recomendado.'}</p>}</div>
                })}</div>
              </article>
            })}</div>
          </section>

          <FormSection icon={Users} title="Cliente" description="También puedes asociar un cliente que recogerá su compra en tienda."><Field label="Cliente"><select value={form.customerId} onChange={(event) => update('customerId', event.target.value)} className="sale-input"><option value="walk-in">Venta de mostrador</option><option value="new">+ Crear cliente nuevo</option>{data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></Field>{form.customerId === 'new' && <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Nombre completo"><input value={form.newCustomerName} onChange={(event) => update('newCustomerName', event.target.value)} className="sale-input" /></Field><Field label="Teléfono"><input type="tel" value={form.newCustomerPhone} onChange={(event) => update('newCustomerPhone', event.target.value)} className="sale-input" /></Field></div>}</FormSection>

          <FormSection icon={hasDelivery ? Truck : Store} title="Forma de entrega" description="El delivery solo se solicita cuando realmente habrá un envío."><div className="grid grid-cols-2 gap-2"><ChoiceButton selected={!hasDelivery} onClick={() => update('fulfillmentMethod', 'pickup')} icon={Store} label="Recoge en tienda" /><ChoiceButton selected={hasDelivery} onClick={() => update('fulfillmentMethod', 'delivery')} icon={Truck} label="Enviar al cliente" /></div>{hasDelivery && <div className="mt-4 grid gap-4 sm:grid-cols-2"><MoneyField label="Costo real del delivery" min="1" value={form.deliveryCost} onChange={(value) => update('deliveryCost', value)} required /><MoneyField label="Cobro de delivery al cliente" value={form.deliveryCharge} onChange={(value) => update('deliveryCharge', value)} /></div>}</FormSection>

          <FormSection icon={CreditCard} title="Primer pago" description="Puede quedar pendiente, pagarse una parte o completarse de una vez."><Field label="Estado"><select value={form.paymentStatus} onChange={(event) => update('paymentStatus', event.target.value)} className="sale-input"><option value="paid">Pago completo</option><option value="partial">Primer pago parcial</option><option value="pending">Sin pago inicial</option></select></Field>{form.paymentStatus !== 'pending' && <><fieldset className="mt-4"><legend className="mb-2 text-sm font-bold text-slate-700">Método</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{paymentMethods.map((method) => <button key={method.id} type="button" aria-pressed={form.paymentMethod === method.id} onClick={() => update('paymentMethod', method.id)} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${form.paymentMethod === method.id ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600'}`}>{method.label}</button>)}</div></fieldset>{form.paymentStatus === 'partial' && <div className="mt-4"><MoneyField label="Monto del primer pago" min="1" value={form.paidAmount} onChange={(value) => update('paidAmount', value)} required /></div>}</>}</FormSection>
        </div>

        <aside className="rounded-3xl bg-brand-950 p-5 text-white shadow-lg shadow-brand-950/15 lg:sticky lg:top-8 sm:p-6"><h2 className="flex items-center gap-2 font-extrabold"><PackageCheck size={20} />Resumen financiero</h2><dl className="mt-5 space-y-3 border-y border-white/10 py-5 text-sm"><SummaryRow label="Artículos" value={calculatedItems.length} /><SummaryRow label="Piezas totales" value={quantity} /><SummaryRow label="Total prendas" value={formatCurrency(merchandiseTotal)} /><SummaryRow label="Entrega" value={hasDelivery ? 'Envío' : 'Recoge en tienda'} /><SummaryRow label="Cobro delivery" value={formatCurrency(deliveryCharge)} /><SummaryRow label="Total a cobrar" value={formatCurrency(total)} /><SummaryRow label="Primer pago" value={formatCurrency(firstPayment)} /><SummaryRow label="Saldo" value={formatCurrency(balance)} /><SummaryRow label="Costo prendas" value={formatCurrency(merchandiseCost)} /><SummaryRow label="Costo delivery" value={formatCurrency(deliveryCost)} /></dl><p className="mt-5 text-xs font-bold uppercase tracking-wider text-brand-200">Ganancia estimada en córdobas</p><p className={`mt-1 text-3xl font-extrabold ${estimatedProfit < 0 ? 'text-coral-200' : 'text-white'}`}>{formatCurrency(estimatedProfit)}</p>{data.settings.warnBelowRecommended && hasPriceWarning && <p className="mt-3 text-xs font-semibold text-amber-100">Revisa los precios marcados antes de registrar.</p>}{formError && <p role="alert" className="mt-4 rounded-xl bg-coral-500/15 p-3 text-sm font-semibold text-coral-100">{formError}</p>}<button type="submit" disabled={isSaving || isLoading} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-brand-950 disabled:opacity-50"><PackageCheck size={19} />{isSaving ? 'Guardando…' : 'Registrar pedido'}</button></aside>
      </form>}
    </div>
  </div>
}

function ChoiceButton({ selected, onClick, icon: Icon, label }) { return <button type="button" aria-pressed={selected} onClick={onClick} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-extrabold ${selected ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-slate-200 text-slate-600'}`}><Icon size={18} />{label}</button> }
function FormSection({ icon: Icon, title, description, children }) { return <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6"><div className="mb-5 flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon size={21} /></span><div><h2 className="text-lg font-extrabold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div></div>{children}</section> }
function Field({ label, children }) { return <label className="block text-sm font-bold text-slate-700"><span className="mb-2 block">{label}</span>{children}</label> }
function MoneyField({ label, min = 0, value, onChange, required = false }) { return <Field label={label}><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-bold text-slate-400">C$</span><input type="number" min={min} step="0.01" required={required} value={value} onChange={(event) => onChange(event.target.value)} className="sale-input sale-input--currency" /></div></Field> }
function SummaryRow({ label, value }) { return <div className="flex justify-between gap-4"><dt className="text-brand-200">{label}</dt><dd className="text-right font-bold">{value}</dd></div> }

function SaleConfirmation({ sale, onAgain }) {
  return <section className="mx-auto max-w-3xl rounded-3xl bg-white p-6 text-center shadow-soft"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><CircleCheck size={28} /></span><h2 className="mt-4 text-2xl font-extrabold">Pedido registrado</h2><p className="mt-2 text-slate-600">{sale.customerName} · {sale.quantity} piezas · {sale.fulfillmentMethod === 'delivery' ? 'Envío' : 'Recoge en tienda'}</p><div className="mx-auto mt-4 max-w-xl space-y-3 rounded-2xl bg-slate-50 p-4 text-left">{sale.items.map((item, index) => <div key={item.id}><p className="text-sm font-extrabold text-slate-900">{index + 1}. {item.category?.name} · {item.inventory?.baleCode}</p>{item.priceLines.map((line) => <p key={line.id} className="mt-1 flex justify-between text-sm text-slate-600"><span>{line.quantity} × {formatCurrency(line.unitPrice)}</span><b>{formatCurrency(line.quantity * line.unitPrice)}</b></p>)}</div>)}</div><dl className="mx-auto mt-5 grid max-w-xl gap-2 text-left sm:grid-cols-2"><ConfirmationRow label="Total" value={formatCurrency(sale.total)} /><ConfirmationRow label="Primer pago" value={`${formatCurrency(sale.firstPayment)}${sale.firstPayment ? ` · ${sale.paymentMethod}` : ''}`} /><ConfirmationRow label="Saldo" value={formatCurrency(sale.balance)} /><ConfirmationRow label="Ganancia estimada" value={formatCurrency(sale.estimatedProfit)} /></dl><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={onAgain} className="min-h-12 rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white">Registrar otro</button><Link to="/ventas" className="inline-flex min-h-12 items-center justify-center rounded-xl border px-5 text-sm font-extrabold text-brand-800">Ver ventas</Link></div></section>
}
function ConfirmationRow({ label, value }) { return <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-extrabold text-slate-900">{value}</dd></div> }

export default NewSalePage

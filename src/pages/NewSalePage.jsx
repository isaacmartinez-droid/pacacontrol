import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CircleCheck, CreditCard, PackageCheck, PackageX, Plus, ShoppingBag, Trash2, Truck, Users } from 'lucide-react'
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

function NewSalePage() {
  const { data, registerSale, createCustomer, isLoading, error } = usePacaData()
  const categories = data.categories.filter((category) => category.availablePieces > 0)
  const [form, setForm] = useState({
    categoryId: '',
    baleInventoryId: '',
    priceLines: [blankPriceLine()],
    customerId: 'walk-in',
    newCustomerName: '',
    newCustomerPhone: '',
    deliveryCost: 0,
    deliveryCharge: 0,
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    paidAmount: '',
  })
  const [formError, setFormError] = useState('')
  const [completedSale, setCompletedSale] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (categories.length && !categories.some((category) => category.id === form.categoryId)) {
      setForm((current) => ({ ...current, categoryId: categories[0].id, baleInventoryId: '', priceLines: [blankPriceLine()] }))
    }
  }, [categories, form.categoryId])

  const selectedCategory = categories.find((category) => category.id === form.categoryId)
  const baleOptions = useMemo(
    () => data.baleInventory.filter((inventory) => inventory.categoryId === form.categoryId && inventory.availablePieces > 0),
    [data.baleInventory, form.categoryId],
  )
  const selectedInventory = baleOptions.find((inventory) => inventory.id === form.baleInventoryId)
  const priceLines = form.priceLines.map((line) => ({
    ...line,
    quantity: Number(line.quantity) || 0,
    unitPrice: Number(line.unitPrice) || 0,
  }))
  const { quantity, merchandiseTotal } = summarizePriceLines(priceLines)
  const hasDelivery = form.customerId !== 'walk-in'
  const deliveryCost = hasDelivery ? Number(form.deliveryCost) || 0 : 0
  const deliveryCharge = hasDelivery ? Number(form.deliveryCharge) || 0 : 0
  const total = merchandiseTotal + deliveryCharge
  const firstPayment = form.paymentStatus === 'paid' ? total : form.paymentStatus === 'pending' ? 0 : Number(form.paidAmount) || 0
  const balance = Math.max(0, total - firstPayment)
  const merchandiseCost = quantity * (selectedInventory?.estimatedUnitCost ?? 0)
  const estimatedProfit = total - merchandiseCost - deliveryCost
  const hasPriceBelowCost = priceLines.some((line) => line.unitPrice > 0 && line.unitPrice < (selectedInventory?.estimatedUnitCost ?? 0))
  const hasPriceBelowRecommended = priceLines.some((line) => line.unitPrice >= (selectedInventory?.estimatedUnitCost ?? 0) && line.unitPrice < (selectedInventory?.recommendedUnitPrice ?? 0))
  const selectedCustomer = data.customers.find((customer) => customer.id === form.customerId)
  const customerName = form.customerId === 'new' ? form.newCustomerName.trim() || 'Cliente nuevo' : selectedCustomer?.name ?? 'Venta de mostrador'

  function update(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'categoryId' ? { baleInventoryId: '', priceLines: [blankPriceLine()] } : {}),
      ...(field === 'baleInventoryId' ? {
        priceLines: [blankPriceLine(data.baleInventory.find((inventory) => inventory.id === value)?.recommendedUnitPrice || '')],
      } : {}),
      ...(field === 'customerId' && value === 'walk-in' ? { deliveryCost: 0, deliveryCharge: 0 } : {}),
    }))
    setFormError('')
  }

  function updatePriceLine(id, field, value) {
    setForm((current) => ({
      ...current,
      priceLines: current.priceLines.map((line) => line.id === id ? { ...line, [field]: value } : line),
    }))
    setFormError('')
  }

  function addPriceLine() {
    setForm((current) => ({
      ...current,
      priceLines: [...current.priceLines, blankPriceLine(selectedInventory?.recommendedUnitPrice || '')],
    }))
  }

  function removePriceLine(id) {
    setForm((current) => current.priceLines.length === 1 ? current : {
      ...current,
      priceLines: current.priceLines.filter((line) => line.id !== id),
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedCategory) return setFormError('Primero registra una paca con inventario disponible.')
    if (!selectedInventory) return setFormError('Selecciona la paca exacta de donde salieron las prendas.')
    if (priceLines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.unitPrice <= 0)) return setFormError('Cada renglón necesita una cantidad entera y un precio mayores que cero.')
    if (quantity > selectedInventory.availablePieces) return setFormError(`Esta paca tiene ${selectedInventory.availablePieces} piezas disponibles de esta categoría.`)
    if (form.customerId === 'new' && !form.newCustomerName.trim()) return setFormError('Escribe el nombre del cliente nuevo.')
    if (hasDelivery && deliveryCost <= 0) return setFormError('El costo real del delivery es obligatorio para ventas a clientes.')
    if (deliveryCharge < 0) return setFormError('El cobro de delivery no puede ser negativo.')
    if (form.paymentStatus !== 'paid' && !hasDelivery) return setFormError('Elige un cliente para dejar un saldo pendiente.')
    if (form.paymentStatus === 'partial' && (!(firstPayment > 0) || firstPayment >= total)) return setFormError('El primer pago debe ser mayor que cero y menor que el total.')

    setIsSaving(true)
    try {
      let customerId = form.customerId
      if (customerId === 'new') {
        const customer = await createCustomer({ name: form.newCustomerName, phone: form.newCustomerPhone, isPriority: false })
        customerId = customer.id
      }
      await registerSale({
        categoryId: form.categoryId,
        baleInventoryId: form.baleInventoryId,
        priceLines,
        customerId,
        deliveryCost,
        deliveryCharge,
        paymentStatus: form.paymentStatus,
        paymentMethod: form.paymentMethod,
        paidAmount: firstPayment,
      })
      setCompletedSale({
        customerName,
        baleCode: selectedInventory.baleCode,
        quantity,
        priceLines,
        total,
        firstPayment,
        balance,
        paymentMethod: paymentMethods.find((method) => method.id === form.paymentMethod)?.label,
        estimatedProfit,
      })
    } catch (saveError) {
      setFormError(saveError.message || 'No fue posible registrar la venta.')
    } finally {
      setIsSaving(false)
    }
  }

  if (completedSale) return <div><PageHeader eyebrow="Salida de inventario" title="Registrar venta" backTo="/ventas" /><div className="page-content py-6"><SaleConfirmation sale={completedSale} onAgain={() => setCompletedSale(null)} /></div></div>
  const hasInventory = categories.length > 0

  return <div>
    <PageHeader eyebrow="Salida de inventario" title="Registrar venta" description="Registra uno o varios precios, el delivery y el primer pago del cliente." backTo="/ventas" />
    <div className="page-content py-6 md:py-8">
      {!isLoading && !error && !hasInventory ? <EmptyState icon={PackageX} title="No hay piezas disponibles para vender" description="Registra primero una paca con inventario." action={{ to: '/pacas/nueva', label: 'Registrar una paca' }} /> :
      <form className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] lg:gap-8" onSubmit={handleSubmit}>
        <div className="space-y-5">
          <FormSection icon={ShoppingBag} title="Prendas de la venta" description="Selecciona la categoría y la paca física exacta.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoría" htmlFor="sale-category"><select id="sale-category" value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)} className="sale-input">{categories.map((category) => <option key={category.id} value={category.id}>{category.name} · {category.availablePieces} disponibles</option>)}</select></Field>
              <Field label="Paca de origen" htmlFor="sale-bale"><select id="sale-bale" required value={form.baleInventoryId} onChange={(event) => update('baleInventoryId', event.target.value)} className="sale-input"><option value="">Selecciona una paca</option>{baleOptions.map((inventory) => <option key={inventory.id} value={inventory.id}>{inventory.baleCode} · {inventory.availablePieces} disponibles · sugerido {formatCurrency(inventory.recommendedUnitPrice)}</option>)}</select></Field>
            </div>

            {selectedInventory && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 p-4 text-sm"><div><p className="font-bold text-brand-950">Costo real: {formatCurrency(selectedInventory.estimatedUnitCost)}</p><p className="mt-1 text-brand-700">Precio recomendado: <b>{formatCurrency(selectedInventory.recommendedUnitPrice)}</b> · margen base {selectedInventory.targetMargin}%</p></div><button type="button" onClick={() => setForm((current) => ({ ...current, priceLines: current.priceLines.map((line) => ({ ...line, unitPrice: selectedInventory.recommendedUnitPrice })) }))} className="rounded-xl bg-brand-900 px-4 py-2 font-bold text-white">Aplicar a todos</button></div>}

            <div className="mt-5 flex items-center justify-between gap-3"><div><h3 className="text-sm font-extrabold text-slate-900">Cantidades y precios</h3><p className="mt-1 text-xs text-slate-500">Agrupa las piezas que tengan el mismo precio.</p></div><button type="button" onClick={addPriceLine} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-brand-50 px-3 text-xs font-extrabold text-brand-800"><Plus size={16} />Otro precio</button></div>
            <div className="mt-3 space-y-3">{form.priceLines.map((line, index) => {
              const numericQuantity = Number(line.quantity) || 0
              const numericPrice = Number(line.unitPrice) || 0
              const belowCost = selectedInventory && numericPrice > 0 && numericPrice < selectedInventory.estimatedUnitCost
              const belowRecommended = selectedInventory && numericPrice >= selectedInventory.estimatedUnitCost && numericPrice < selectedInventory.recommendedUnitPrice
              return <div key={line.id} className={`rounded-2xl border p-4 ${belowCost ? 'border-red-200 bg-red-50/40' : belowRecommended ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'}`}>
                <div className="mb-3 flex items-center justify-between"><b className="text-sm text-slate-700">Precio {index + 1}</b>{form.priceLines.length > 1 && <button type="button" onClick={() => removePriceLine(line.id)} className="text-coral-600" aria-label={`Quitar precio ${index + 1}`}><Trash2 size={18} /></button>}</div>
                <div className="grid items-end gap-3 sm:grid-cols-[0.65fr_1fr_0.8fr]">
                  <Field label="Cantidad" htmlFor={`sale-quantity-${line.id}`}><input id={`sale-quantity-${line.id}`} type="number" min="1" value={line.quantity} onChange={(event) => updatePriceLine(line.id, 'quantity', event.target.value)} className="sale-input" /></Field>
                  <MoneyField label="Precio por pieza" id={`sale-price-${line.id}`} min="1" value={line.unitPrice} onChange={(value) => updatePriceLine(line.id, 'unitPrice', value)} />
                  <div className="rounded-xl bg-slate-50 p-3 text-right"><p className="text-xs text-slate-500">Subtotal</p><p className="mt-1 font-extrabold text-slate-900">{formatCurrency(numericQuantity * numericPrice)}</p></div>
                </div>
                {belowCost && <p className="mt-2 flex items-center gap-2 text-xs font-bold text-red-700"><AlertTriangle size={15} />Este grupo produciría pérdida antes del delivery.</p>}
                {belowRecommended && <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-amber-800"><AlertTriangle size={15} />Este grupo está debajo del margen recomendado.</p>}
              </div>
            })}</div>
          </FormSection>

          <FormSection icon={Users} title="Cliente" description="Elige uno existente o créalo sin salir de la venta.">
            <Field label="Cliente" htmlFor="sale-customer"><select id="sale-customer" value={form.customerId} onChange={(event) => update('customerId', event.target.value)} className="sale-input"><option value="walk-in">Venta de mostrador</option><option value="new">+ Crear cliente nuevo</option>{data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></Field>
            {form.customerId === 'new' && <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Nombre completo" htmlFor="new-customer-name"><input id="new-customer-name" value={form.newCustomerName} onChange={(event) => update('newCustomerName', event.target.value)} className="sale-input" /></Field><Field label="Teléfono" htmlFor="new-customer-phone"><input id="new-customer-phone" type="tel" value={form.newCustomerPhone} onChange={(event) => update('newCustomerPhone', event.target.value)} className="sale-input" /></Field></div>}
          </FormSection>

          {hasDelivery && <FormSection icon={Truck} title="Delivery" description="El costo real siempre se descuenta de la ganancia."><div className="grid gap-4 sm:grid-cols-2"><MoneyField label="Costo real del delivery" id="delivery-cost" min="1" value={form.deliveryCost} onChange={(value) => update('deliveryCost', value)} required /><MoneyField label="Cobro de delivery al cliente" id="delivery-charge" min="0" value={form.deliveryCharge} onChange={(value) => update('deliveryCharge', value)} /></div></FormSection>}

          <FormSection icon={CreditCard} title="Primer pago" description="Puede quedar pendiente, pagarse una parte o completarse de una vez.">
            <Field label="Estado" htmlFor="payment-status"><select id="payment-status" value={form.paymentStatus} onChange={(event) => update('paymentStatus', event.target.value)} className="sale-input"><option value="paid">Pago completo</option><option value="partial">Primer pago parcial</option><option value="pending">Sin pago inicial</option></select></Field>
            {form.paymentStatus !== 'pending' && <><fieldset className="mt-4"><legend className="mb-2 text-sm font-bold text-slate-700">Método</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{paymentMethods.map((method) => <button key={method.id} type="button" aria-pressed={form.paymentMethod === method.id} onClick={() => update('paymentMethod', method.id)} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${form.paymentMethod === method.id ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600'}`}>{method.label}</button>)}</div></fieldset>{form.paymentStatus === 'partial' && <div className="mt-4"><MoneyField label="Monto del primer pago" id="first-payment" min="1" value={form.paidAmount} onChange={(value) => update('paidAmount', value)} required /></div>}</>}
          </FormSection>
        </div>

        <aside className="rounded-3xl bg-brand-950 p-5 text-white shadow-lg shadow-brand-950/15 lg:sticky lg:top-8 sm:p-6">
          <h2 className="flex items-center gap-2 font-extrabold"><PackageCheck size={20} />Resumen financiero</h2>
          <dl className="mt-5 space-y-3 border-y border-white/10 py-5 text-sm"><SummaryRow label="Paca" value={selectedInventory?.baleCode ?? 'Sin seleccionar'} /><SummaryRow label="Piezas totales" value={quantity} /><SummaryRow label="Total prendas" value={formatCurrency(merchandiseTotal)} /><SummaryRow label="Cobro delivery" value={formatCurrency(deliveryCharge)} /><SummaryRow label="Total a cobrar" value={formatCurrency(total)} /><SummaryRow label="Primer pago" value={formatCurrency(firstPayment)} /><SummaryRow label="Saldo" value={formatCurrency(balance)} /><SummaryRow label="Costo prendas" value={formatCurrency(merchandiseCost)} /><SummaryRow label="Costo delivery" value={formatCurrency(deliveryCost)} /></dl>
          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-brand-200">Ganancia estimada</p><p className={`mt-1 text-3xl font-extrabold ${estimatedProfit < 0 ? 'text-coral-200' : 'text-white'}`}>{formatCurrency(estimatedProfit)}</p>
          {(hasPriceBelowCost || hasPriceBelowRecommended) && <p className="mt-3 text-xs font-semibold text-amber-100">Revisa los precios marcados antes de registrar.</p>}
          {formError && <p role="alert" className="mt-4 rounded-xl bg-coral-500/15 p-3 text-sm font-semibold text-coral-100">{formError}</p>}
          <button type="submit" disabled={isSaving || isLoading} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-brand-950 disabled:opacity-50"><PackageCheck size={19} />{isSaving ? 'Guardando…' : 'Registrar venta'}</button>
        </aside>
      </form>}
    </div>
  </div>
}

function FormSection({ icon: Icon, title, description, children }) { return <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6"><div className="mb-5 flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon size={21} /></span><div><h2 className="text-lg font-extrabold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div></div>{children}</section> }
function Field({ label, htmlFor, children }) { return <div><label htmlFor={htmlFor} className="mb-2 block text-sm font-bold text-slate-700">{label}</label>{children}</div> }
function MoneyField({ label, id, min = 0, value, onChange, required = false }) { return <Field label={label} htmlFor={id}><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-bold text-slate-400">C$</span><input id={id} type="number" min={min} step="0.01" required={required} value={value} onChange={(event) => onChange(event.target.value)} className="sale-input sale-input--currency" /></div></Field> }
function SummaryRow({ label, value }) { return <div className="flex justify-between gap-4"><dt className="text-brand-200">{label}</dt><dd className="text-right font-bold">{value}</dd></div> }

function SaleConfirmation({ sale, onAgain }) {
  return <section className="mx-auto max-w-3xl rounded-3xl bg-white p-6 text-center shadow-soft"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><CircleCheck size={28} /></span><h2 className="mt-4 text-2xl font-extrabold">Venta registrada</h2><p className="mt-2 text-slate-600">{sale.customerName} · {sale.baleCode} · {sale.quantity} piezas</p><div className="mx-auto mt-4 max-w-xl space-y-2 rounded-2xl bg-slate-50 p-4 text-left">{sale.priceLines.map((line, index) => <p key={line.id ?? index} className="flex justify-between text-sm"><span>{line.quantity} {line.quantity === 1 ? 'pieza' : 'piezas'} × {formatCurrency(line.unitPrice)}</span><b>{formatCurrency(line.quantity * line.unitPrice)}</b></p>)}</div><dl className="mx-auto mt-5 grid max-w-xl gap-2 text-left sm:grid-cols-2"><ConfirmationRow label="Total" value={formatCurrency(sale.total)} /><ConfirmationRow label="Primer pago" value={`${formatCurrency(sale.firstPayment)}${sale.firstPayment ? ` · ${sale.paymentMethod}` : ''}`} /><ConfirmationRow label="Saldo" value={formatCurrency(sale.balance)} /><ConfirmationRow label="Ganancia estimada" value={formatCurrency(sale.estimatedProfit)} /></dl><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={onAgain} className="min-h-12 rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white">Registrar otra</button><Link to="/ventas" className="inline-flex min-h-12 items-center justify-center rounded-xl border px-5 text-sm font-extrabold text-brand-800">Ver ventas</Link></div></section>
}

function ConfirmationRow({ label, value }) { return <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-extrabold text-slate-900">{value}</dd></div> }

export default NewSalePage

import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, CreditCard, PackageCheck, PackageX, ShoppingBag, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { formatCurrency } from '../utils/currency'
import { usePacaData } from '../context/PacaDataContext'

const paymentMethods = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'transfer', label: 'Transferencia' },
]

function NewSalePage() {
  const { data, registerSale, isLoading, error } = usePacaData()
  const clothingCategories = data.categories
  const customers = data.customers
  const [form, setForm] = useState({
    categoryId: '',
    quantity: 1,
    unitPrice: 180,
    customerId: 'walk-in',
    paymentMethod: 'cash',
  })
  const [formError, setFormError] = useState('')
  const [completedSale, setCompletedSale] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const firstAvailableCategory = clothingCategories.find((category) => category.availablePieces > 0)
    const selectedCategoryIsAvailable = clothingCategories.some(
      (category) => category.id === form.categoryId && category.availablePieces > 0,
    )

    if (firstAvailableCategory && !selectedCategoryIsAvailable) {
      setForm((current) => ({ ...current, categoryId: firstAvailableCategory.id }))
    }
  }, [clothingCategories, form.categoryId])

  const selectedCategory = useMemo(
    () => clothingCategories.find((category) => category.id === form.categoryId),
    [clothingCategories, form.categoryId],
  )
  const availablePieces = Math.max(
    0,
    selectedCategory?.availablePieces ?? 0,
  )
  const quantity = Number(form.quantity) || 0
  const unitPrice = Number(form.unitPrice) || 0
  const total = quantity * unitPrice
  const selectedCustomer = customers.find((customer) => customer.id === form.customerId)
  const customerName = selectedCustomer?.name ?? 'Venta de mostrador'
  const paymentLabel = paymentMethods.find((method) => method.id === form.paymentMethod)?.label

  function updateForm(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
    setFormError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!selectedCategory) {
      setFormError('Primero registra una paca con inventario disponible.')
      return
    }

    if (quantity < 1) {
      setFormError('Ingresa al menos una pieza para continuar.')
      return
    }

    if (quantity > availablePieces) {
      setFormError(`Solo hay ${availablePieces} piezas disponibles en esta categoría.`)
      return
    }

    if (unitPrice <= 0) {
      setFormError('Ingresa un precio válido por pieza.')
      return
    }

    setIsSaving(true)
    try {
      await registerSale({ categoryId: form.categoryId, quantity, unitPrice, paymentMethod: form.paymentMethod, customerId: form.customerId })
      setCompletedSale({ categoryName: selectedCategory.name, customerName, paymentLabel, pieces: quantity, total })
    } catch (error) {
      setFormError(error.message || 'No fue posible registrar la venta.')
    } finally {
      setIsSaving(false)
    }
  }

  function registerAnotherSale() {
    setCompletedSale(null)
    setForm((currentForm) => ({ ...currentForm, quantity: 1, unitPrice: 180 }))
  }

  const hasAvailableInventory = clothingCategories.some((category) => category.availablePieces > 0)

  return (
    <div>
      <PageHeader
        eyebrow="Salida de inventario"
        title="Registrar venta"
        description="Elige las prendas, asigna el cliente y confirma el cobro en unos pocos pasos."
        backTo="/ventas"
      />
      <div className="page-content py-6 md:py-8">
        {!isLoading && !error && !hasAvailableInventory ? (
          <EmptyState
            icon={PackageX}
            title="No hay piezas disponibles para vender"
            description="Registra primero una paca. Cuando tenga inventario, podrás crear la venta desde aquí."
            action={{ to: '/pacas/nueva', label: 'Registrar una paca' }}
          />
        ) : completedSale ? (
          <SaleConfirmation sale={completedSale} onRegisterAnother={registerAnotherSale} />
        ) : (
          <form className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] lg:gap-8" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                    <ShoppingBag aria-hidden="true" size={21} />
                  </span>
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Prendas de la venta</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Selecciona una categoría y define cuántas piezas se llevarán.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field label="Categoría" htmlFor="sale-category" className="sm:col-span-2">
                    <select
                      id="sale-category"
                      value={form.categoryId}
                      onChange={(event) => updateForm('categoryId', event.target.value)}
                      className="sale-input"
                    >
                      {clothingCategories.map((category) => {
                        const categoryAvailable = Math.max(
                          0,
                          category.availablePieces,
                        )

                        return (
                          <option key={category.id} value={category.id} disabled={categoryAvailable === 0}>
                            {category.name} · {categoryAvailable} disponibles
                          </option>
                        )
                      })}
                    </select>
                  </Field>

                  <Field label="Cantidad" htmlFor="sale-quantity">
                    <input
                      id="sale-quantity"
                      type="number"
                      min="1"
                      max={availablePieces}
                      inputMode="numeric"
                      value={form.quantity}
                      onChange={(event) => updateForm('quantity', event.target.value)}
                      className="sale-input"
                    />
                    <p className="mt-2 text-xs font-medium text-brand-700">
                      {availablePieces} piezas disponibles
                    </p>
                  </Field>

                  <Field label="Precio por pieza" htmlFor="sale-price">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-bold text-slate-400">
                        C$
                      </span>
                      <input
                        id="sale-price"
                        type="number"
                        min="1"
                        step="1"
                        inputMode="decimal"
                        value={form.unitPrice}
                        onChange={(event) => updateForm('unitPrice', event.target.value)}
                        className="sale-input sale-input--currency"
                      />
                    </div>
                  </Field>
                </div>
              </section>

              <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700">
                    <Users aria-hidden="true" size={21} />
                  </span>
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Cliente y cobro</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Puedes asociar la venta a un cliente o registrarla como venta de mostrador.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-5">
                  <Field label="Cliente" htmlFor="sale-customer">
                    <select
                      id="sale-customer"
                      value={form.customerId}
                      onChange={(event) => updateForm('customerId', event.target.value)}
                      className="sale-input"
                    >
                      <option value="walk-in">Venta de mostrador</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                    <Link
                      to="/clientes/nuevo"
                      className="mt-2 inline-flex min-h-8 items-center text-xs font-bold text-brand-700 hover:underline"
                    >
                      Registrar un cliente nuevo
                    </Link>
                  </Field>

                  <fieldset>
                    <legend className="mb-2 text-sm font-bold text-slate-700">Método de pago</legend>
                    <div className="grid grid-cols-2 gap-3">
                      {paymentMethods.map((method) => {
                        const isSelected = form.paymentMethod === method.id

                        return (
                          <button
                            key={method.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => updateForm('paymentMethod', method.id)}
                            className={`flex min-h-12 items-center justify-center rounded-xl border px-3 text-sm font-bold transition active:scale-[0.98] ${
                              isSelected
                                ? 'border-brand-700 bg-brand-50 text-brand-800 ring-1 ring-brand-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50/50'
                            }`}
                          >
                            {method.label}
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                </div>
              </section>
            </div>

            <aside className="rounded-3xl bg-brand-950 p-5 text-white shadow-lg shadow-brand-950/15 lg:sticky lg:top-8 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-brand-100">
                  <CreditCard aria-hidden="true" size={21} />
                </span>
                <div>
                  <p className="text-sm font-bold">Resumen de cobro</p>
                  <p className="mt-0.5 text-xs text-brand-200">Revisa los datos antes de confirmar</p>
                </div>
              </div>

              <dl className="mt-6 space-y-4 border-y border-white/10 py-5 text-sm">
                <SummaryRow label="Categoría" value={selectedCategory?.name ?? 'Sin seleccionar'} />
                <SummaryRow label="Piezas" value={`${quantity || 0} prendas`} />
                <SummaryRow label="Cliente" value={customerName} />
                <SummaryRow label="Pago" value={paymentLabel} />
              </dl>

              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-200">Total a cobrar</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight">{formatCurrency(total)}</p>
              </div>

              {formError && (
                <p role="alert" className="mt-4 rounded-xl bg-coral-500/15 px-3 py-2 text-sm font-semibold text-coral-100">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSaving || isLoading}
                className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-brand-950 transition hover:bg-brand-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PackageCheck aria-hidden="true" size={19} />
                {isSaving ? 'Guardando…' : 'Registrar venta'}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-brand-200">
                El inventario disponible se ajustará al confirmar la venta.
              </p>
            </aside>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, htmlFor, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </label>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-brand-200">{label}</dt>
      <dd className="max-w-[60%] text-right font-bold text-white">{value}</dd>
    </div>
  )
}

function SaleConfirmation({ sale, onRegisterAnother }) {
  return (
    <section className="mx-auto max-w-3xl rounded-3xl bg-white p-5 text-center shadow-soft ring-1 ring-slate-100 sm:p-8">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
        <CircleCheck aria-hidden="true" size={28} />
      </span>
      <p className="mt-5 text-sm font-bold text-emerald-700">Venta registrada</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
        {formatCurrency(sale.total)} cobrados
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Registraste {sale.pieces} {sale.pieces === 1 ? 'pieza' : 'piezas'} de {sale.categoryName} para{' '}
        {sale.customerName} por {sale.paymentLabel.toLowerCase()}.
      </p>

      <dl className="mx-auto mt-6 grid max-w-xl gap-px overflow-hidden rounded-2xl bg-slate-100 text-left sm:grid-cols-3">
        <ConfirmationDetail label="Categoría" value={sale.categoryName} />
        <ConfirmationDetail label="Cliente" value={sale.customerName} />
        <ConfirmationDetail label="Pago" value={sale.paymentLabel} />
      </dl>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRegisterAnother}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white transition hover:bg-brand-900 active:scale-[0.98]"
        >
          Registrar otra venta
        </button>
        <Link
          to="/ventas"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-extrabold text-brand-800 transition hover:bg-brand-50 active:scale-[0.98]"
        >
          Ver ventas recientes
        </Link>
      </div>
    </section>
  )
}

function ConfirmationDetail({ label, value }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-sm font-extrabold text-slate-900">{value}</dd>
    </div>
  )
}

export default NewSalePage

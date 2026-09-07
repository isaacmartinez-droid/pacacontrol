import { useState } from 'react'
import { BadgeDollarSign, CalendarDays, CircleCheck, PackageCheck, PackagePlus, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import { formatCurrency } from '../utils/currency'
import { formatShortDate } from '../utils/dates'
import { usePacaData } from '../context/PacaDataContext'

const today = new Date().toISOString().slice(0, 10)

function NewBalePage() {
  const { data, createBale, isLoading } = usePacaData()
  const categories = data.categories
  const [form, setForm] = useState({
    purchaseDate: today,
    purchaseCost: '',
    transportCost: '0',
    otherExpenses: '0',
    receivedPieces: '',
    damagedPieces: '0',
    damageReason: '',
    categoryName: '',
  })
  const [formError, setFormError] = useState('')
  const [registeredBale, setRegisteredBale] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const purchaseCost = Number(form.purchaseCost) || 0
  const transportCost = Number(form.transportCost) || 0
  const otherExpenses = Number(form.otherExpenses) || 0
  const receivedPieces = Number(form.receivedPieces) || 0
  const damagedPieces = Number(form.damagedPieces) || 0
  const sellablePieces = Math.max(0, receivedPieces - damagedPieces)
  const totalInvestment = purchaseCost + transportCost + otherExpenses
  const costPerSellablePiece = sellablePieces > 0 ? totalInvestment / sellablePieces : 0

  function updateForm(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
    setFormError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!form.purchaseDate) {
      setFormError('Selecciona la fecha de compra para continuar.')
      return
    }

    if (purchaseCost <= 0) {
      setFormError('Ingresa el costo de compra de la paca.')
      return
    }

    if (receivedPieces <= 0) {
      setFormError('Ingresa la cantidad de piezas recibidas.')
      return
    }

    if (damagedPieces < 0) {
      setFormError('La cantidad de piezas dañadas no puede ser negativa.')
      return
    }

    if (damagedPieces > receivedPieces) {
      setFormError('Las piezas dañadas no pueden superar las piezas recibidas.')
      return
    }

    const damageReason = form.damageReason.trim().replace(/\s+/g, ' ')
    if (damagedPieces > 0 && !damageReason) {
      setFormError('Escribe el motivo de las piezas dañadas.')
      return
    }

    const categoryName = form.categoryName.trim().replace(/\s+/g, ' ')
    if (!categoryName) {
      setFormError('Escribe la categoría de las prendas.')
      return
    }

    if (categoryName.length > 80) {
      setFormError('La categoría debe tener 80 caracteres o menos.')
      return
    }

    setIsSaving(true)
    try {
      const bale = await createBale({
        ...form,
        categoryName,
        damageReason,
        purchaseCost,
        transportCost,
        otherExpenses,
        receivedPieces,
        damagedPieces,
      })
      setRegisteredBale({ ...bale, totalInvestment, sellablePieces, costPerSellablePiece })
    } catch (error) {
      setFormError(error.message || 'No fue posible registrar la paca.')
    } finally {
      setIsSaving(false)
    }
  }

  function registerAnotherBale() {
    setRegisteredBale(null)
    setForm({
      purchaseDate: today,
      purchaseCost: '',
      transportCost: '0',
      otherExpenses: '0',
      receivedPieces: '',
      damagedPieces: '0',
      damageReason: '',
      categoryName: '',
    })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Nueva inversión"
        title="Registrar paca"
        description="Registra la compra, costos asociados y la cantidad de prendas que recibiste."
        backTo="/pacas"
      />
      <div className="page-content py-6 md:py-8">
        {registeredBale ? (
          <BaleConfirmation bale={registeredBale} onRegisterAnother={registerAnotherBale} />
        ) : (
          <form className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] lg:gap-8" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                    <PackagePlus aria-hidden="true" size={21} />
                  </span>
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Datos de la compra</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Identifica la paca y registra cuándo se realizó la inversión.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field label="Código de paca" htmlFor="bale-code">
                    <input
                      id="bale-code"
                      type="text"
                      value="Se genera al guardar"
                      readOnly
                      className="sale-input cursor-default bg-slate-50 text-slate-500"
                    />
                    <p className="mt-2 text-xs font-medium text-slate-400">Se genera automáticamente.</p>
                  </Field>

                  <Field label="Fecha de compra" htmlFor="bale-date">
                    <div className="relative">
                      <CalendarDays
                        aria-hidden="true"
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        id="bale-date"
                        type="date"
                        required
                        value={form.purchaseDate}
                        onChange={(event) => updateForm('purchaseDate', event.target.value)}
                        className="sale-input sale-input--icon"
                      />
                    </div>
                  </Field>
                </div>
              </section>

              <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-coral-50 text-coral-600">
                    <Truck aria-hidden="true" size={21} />
                  </span>
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Inversión y existencias</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Incluye todos los costos cubiertos para conocer el valor real de cada prenda.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <CurrencyField
                    label="Costo de compra"
                    id="bale-purchase-cost"
                    value={form.purchaseCost}
                    onChange={(event) => updateForm('purchaseCost', event.target.value)}
                    required
                  />
                  <CurrencyField
                    label="Transporte"
                    id="bale-transport-cost"
                    value={form.transportCost}
                    onChange={(event) => updateForm('transportCost', event.target.value)}
                  />
                  <CurrencyField
                    label="Otros gastos"
                    id="bale-other-expenses"
                    value={form.otherExpenses}
                    onChange={(event) => updateForm('otherExpenses', event.target.value)}
                  />
                  <Field label="Piezas recibidas" htmlFor="bale-pieces">
                    <input
                      id="bale-pieces"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      required
                      value={form.receivedPieces}
                      onChange={(event) => updateForm('receivedPieces', event.target.value)}
                      className="sale-input"
                    />
                    <p className="mt-2 text-xs font-medium text-brand-700">Cantidad total antes de clasificarla.</p>
                  </Field>
                  <Field label="Piezas dañadas" htmlFor="bale-damaged-pieces">
                    <input
                      id="bale-damaged-pieces"
                      type="number"
                      min="0"
                      max={receivedPieces || undefined}
                      step="1"
                      inputMode="numeric"
                      value={form.damagedPieces}
                      onChange={(event) => updateForm('damagedPieces', event.target.value)}
                      className="sale-input"
                    />
                    <p className="mt-2 text-xs font-medium text-amber-700">Se descontarán del inventario disponible.</p>
                  </Field>
                  {damagedPieces > 0 && (
                    <Field label="Motivo del daño" htmlFor="bale-damage-reason">
                      <input
                        id="bale-damage-reason"
                        type="text"
                        required
                        maxLength="500"
                        placeholder="Ej. Manchas o roturas"
                        value={form.damageReason}
                        onChange={(event) => updateForm('damageReason', event.target.value)}
                        className="sale-input"
                      />
                    </Field>
                  )}
                  <Field label="Categoría de prendas" htmlFor="bale-category">
                    <input
                      id="bale-category"
                      type="text"
                      list="bale-category-suggestions"
                      required
                      maxLength="80"
                      autoComplete="off"
                      placeholder="Ej. Ropa deportiva"
                      value={form.categoryName}
                      onChange={(event) => updateForm('categoryName', event.target.value)}
                      className="sale-input"
                    />
                    <datalist id="bale-category-suggestions">
                      {categories.map((category) => (
                        <option key={category.id} value={category.name} />
                      ))}
                    </datalist>
                    <p className="mt-2 text-xs font-medium text-brand-700">
                      Escribe una categoría nueva o reutiliza una que ya exista.
                    </p>
                  </Field>
                </div>
              </section>
            </div>

            <aside className="rounded-3xl bg-brand-950 p-5 text-white shadow-lg shadow-brand-950/15 lg:sticky lg:top-8 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-brand-100">
                  <BadgeDollarSign aria-hidden="true" size={21} />
                </span>
                <div>
                  <p className="text-sm font-bold">Resumen de inversión</p>
                  <p className="mt-0.5 text-xs text-brand-200">Comprueba los datos antes de guardar</p>
                </div>
              </div>

              <dl className="mt-6 space-y-4 border-y border-white/10 py-5 text-sm">
                <SummaryRow label="Código" value="Se asigna al guardar" />
                <SummaryRow label="Fecha" value={form.purchaseDate ? formatShortDate(form.purchaseDate) : 'Sin seleccionar'} />
                <SummaryRow label="Categoría" value={form.categoryName.trim() || 'Sin escribir'} />
                <SummaryRow label="Piezas recibidas" value={`${receivedPieces || 0} prendas`} />
                <SummaryRow label="Piezas dañadas" value={`${damagedPieces} prendas`} />
                <SummaryRow label="Disponibles para venta" value={`${sellablePieces} prendas`} />
                <SummaryRow label="Costo por pieza vendible" value={sellablePieces > 0 ? formatCurrency(costPerSellablePiece) : '—'} />
              </dl>

              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-200">Inversión total</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight">{formatCurrency(totalInvestment)}</p>
              </div>

              {formError && (
                <p role="alert" className="mt-4 rounded-xl bg-coral-500/15 px-3 py-2 text-sm font-semibold text-coral-100">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSaving || isLoading}
                className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-brand-950 transition hover:bg-brand-50 active:scale-[0.98]"
              >
                <PackageCheck aria-hidden="true" size={19} />
                {isSaving ? 'Guardando…' : 'Registrar paca'}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-brand-200">
                La categoría quedará disponible para registrar ventas después de guardar la paca.
              </p>
            </aside>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </label>
      {children}
    </div>
  )
}

function CurrencyField({ label, id, value, onChange, required = false }) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-bold text-slate-400">
          C$
        </span>
        <input
          id={id}
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          required={required}
          value={value}
          onChange={onChange}
          className="sale-input sale-input--currency"
        />
      </div>
    </Field>
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

function BaleConfirmation({ bale, onRegisterAnother }) {
  return (
    <section className="mx-auto max-w-3xl rounded-3xl bg-white p-5 text-center shadow-soft ring-1 ring-slate-100 sm:p-8">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
        <CircleCheck aria-hidden="true" size={28} />
      </span>
      <p className="mt-5 text-sm font-bold text-emerald-700">Paca registrada</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
        {bale.code} lista para clasificar
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Registraste {bale.receivedPieces} piezas, de las cuales {bale.damagedPieces} quedaron marcadas como dañadas,
        con una inversión total de {formatCurrency(bale.totalInvestment)}.
      </p>

      <dl className="mx-auto mt-6 grid max-w-3xl gap-px overflow-hidden rounded-2xl bg-slate-100 text-left sm:grid-cols-2 lg:grid-cols-3">
        <ConfirmationDetail label="Fecha" value={formatShortDate(bale.purchaseDate)} />
        <ConfirmationDetail label="Categoría" value={bale.categoryName} />
        <ConfirmationDetail label="Piezas recibidas" value={`${bale.receivedPieces} prendas`} />
        <ConfirmationDetail label="Piezas dañadas" value={`${bale.damagedPieces} prendas`} />
        <ConfirmationDetail label="Disponibles" value={`${bale.sellablePieces} prendas`} />
        <ConfirmationDetail
          label="Costo por pieza vendible"
          value={bale.sellablePieces > 0 ? formatCurrency(bale.costPerSellablePiece) : '—'}
        />
      </dl>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRegisterAnother}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white transition hover:bg-brand-900 active:scale-[0.98]"
        >
          Registrar otra paca
        </button>
        <Link
          to="/pacas"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-extrabold text-brand-800 transition hover:bg-brand-50 active:scale-[0.98]"
        >
          Ver mis pacas
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

export default NewBalePage

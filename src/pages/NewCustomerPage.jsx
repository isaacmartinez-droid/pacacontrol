import { useState } from 'react'
import { CircleCheck, Crown, Phone, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'

function NewCustomerPage() {
  const { createCustomer } = usePacaData()
  const [form, setForm] = useState({ name: '', phone: '', isPriority: false })
  const [createdCustomer, setCreatedCustomer] = useState(null)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setFormError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const name = form.name.trim()

    if (!name) {
      setFormError('Escribe el nombre del cliente.')
      return
    }

    setIsSaving(true)
    setFormError('')

    try {
      const customer = await createCustomer({ ...form, name })
      setCreatedCustomer(customer)
    } catch (error) {
      setFormError(error.message || 'No fue posible registrar el cliente.')
    } finally {
      setIsSaving(false)
    }
  }

  function registerAnotherCustomer() {
    setCreatedCustomer(null)
    setForm({ name: '', phone: '', isPriority: false })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Relaciones"
        title="Nuevo cliente"
        description="Guarda sus datos para encontrarlo rápidamente al registrar una venta."
        backTo="/clientes"
      />

      <div className="page-content py-6 md:py-8">
        {createdCustomer ? (
          <CustomerConfirmation customer={createdCustomer} onRegisterAnother={registerAnotherCustomer} />
        ) : (
          <form className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)] lg:gap-8" onSubmit={handleSubmit}>
            <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <UserPlus aria-hidden="true" size={21} />
                </span>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Datos del cliente</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">El nombre es obligatorio; el teléfono es opcional.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-5">
                <label className="block text-sm font-bold text-slate-700">
                  Nombre completo
                  <input
                    className="sale-input mt-2"
                    type="text"
                    maxLength="120"
                    autoComplete="name"
                    placeholder="Ej. María López"
                    value={form.name}
                    required
                    onChange={(event) => updateForm('name', event.target.value)}
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Teléfono
                  <div className="relative mt-2">
                    <Phone aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input
                      className="sale-input sale-input--icon"
                      type="tel"
                      maxLength="30"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="Ej. 8888 8888"
                      value={form.phone}
                      onChange={(event) => updateForm('phone', event.target.value)}
                    />
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <input
                    className="mt-1 size-4 accent-amber-600"
                    type="checkbox"
                    checked={form.isPriority}
                    onChange={(event) => updateForm('isPriority', event.target.checked)}
                  />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-extrabold text-amber-900">
                      <Crown aria-hidden="true" size={17} />
                      Cliente prioritario
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-amber-800">Márcalo para identificar clientes frecuentes o especiales.</span>
                  </span>
                </label>
              </div>
            </section>

            <aside className="rounded-3xl bg-brand-950 p-5 text-white shadow-lg shadow-brand-950/15 sm:p-6 lg:sticky lg:top-8">
              <p className="text-sm font-bold text-brand-100">Cliente por registrar</p>
              <p className="mt-2 break-words text-2xl font-extrabold tracking-tight">{form.name.trim() || 'Sin nombre'}</p>
              <p className="mt-2 text-sm text-brand-200">{form.phone.trim() || 'Sin teléfono'}</p>
              {form.isPriority && (
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1.5 text-xs font-bold text-amber-100">
                  <Crown aria-hidden="true" size={14} />
                  Prioritario
                </span>
              )}

              {formError && <p role="alert" className="mt-5 rounded-xl bg-coral-500/15 px-3 py-2 text-sm font-semibold text-coral-100">{formError}</p>}

              <button
                type="submit"
                disabled={isSaving}
                className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-brand-950 transition hover:bg-brand-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlus aria-hidden="true" size={19} />
                {isSaving ? 'Guardando…' : 'Registrar cliente'}
              </button>
            </aside>
          </form>
        )}
      </div>
    </div>
  )
}

function CustomerConfirmation({ customer, onRegisterAnother }) {
  return (
    <section className="mx-auto max-w-3xl rounded-3xl bg-white p-5 text-center shadow-soft ring-1 ring-slate-100 sm:p-8">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
        <CircleCheck aria-hidden="true" size={28} />
      </span>
      <p className="mt-5 text-sm font-bold text-emerald-700">Cliente registrado</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{customer.name}</h2>
      <p className="mt-2 text-sm text-slate-500">Ya puedes seleccionarlo al registrar una venta.</p>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRegisterAnother}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-950 px-5 text-sm font-extrabold text-white transition hover:bg-brand-900 active:scale-[0.98]"
        >
          Registrar otro cliente
        </button>
        <Link
          to="/ventas/nueva"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-extrabold text-brand-800 transition hover:bg-brand-50 active:scale-[0.98]"
        >
          Ir a registrar venta
        </Link>
      </div>
    </section>
  )
}

export default NewCustomerPage

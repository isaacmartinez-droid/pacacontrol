import { useEffect, useState } from 'react'
import { CircleAlert, Crown, LoaderCircle, Phone, Save } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'

export default function EditCustomerPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, updateCustomer } = usePacaData()
  const customer = data.customers.find((item) => item.id === customerId)
  const [form, setForm] = useState(null)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (customer && !form) setForm({ name: customer.name, phone: customer.phone, isPriority: customer.priority })
  }, [customer, form])

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); setFormError('') }
  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim()) return setFormError('Escribe el nombre del cliente.')
    setIsSaving(true)
    try {
      await updateCustomer(customerId, form)
      navigate(`/clientes/${encodeURIComponent(customerId)}`, { replace: true })
    } catch (error) { setFormError(error.message || 'No fue posible editar el cliente.') }
    finally { setIsSaving(false) }
  }

  if (!customer && !isLoading) return <div><PageHeader title="Cliente no encontrado" backTo="/clientes" /><div className="page-content py-6"><EmptyState icon={CircleAlert} title="Este cliente no está disponible" description="Puede haberse eliminado o no pertenecer a esta cuenta." /></div></div>
  if (!form) return <div><PageHeader title="Cargando cliente…" backTo="/clientes" /></div>

  return <div><PageHeader eyebrow="Relaciones" title="Editar cliente" description="Actualiza sus datos sin perder compras, pagos ni alertas." backTo={`/clientes/${encodeURIComponent(customerId)}`} /><div className="page-content py-6 md:py-8"><form onSubmit={submit} className="max-w-2xl rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6"><label className="block text-sm font-bold text-slate-700">Nombre completo<input type="text" maxLength="120" required value={form.name} onChange={(event) => update('name', event.target.value)} className="sale-input mt-2" /></label><label className="mt-5 block text-sm font-bold text-slate-700">Teléfono<div className="relative mt-2"><Phone className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input type="tel" maxLength="30" value={form.phone} onChange={(event) => update('phone', event.target.value)} className="sale-input sale-input--icon" /></div></label><label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4"><input type="checkbox" checked={form.isPriority} onChange={(event) => update('isPriority', event.target.checked)} className="mt-1 size-4 accent-amber-600" /><span><span className="flex items-center gap-2 text-sm font-extrabold text-amber-900"><Crown size={17} />Cliente prioritario</span><span className="mt-1 block text-xs text-amber-800">Úsalo para identificar clientes frecuentes o especiales.</span></span></label>{formError && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{formError}</p>}<button type="submit" disabled={isSaving} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-950 px-6 text-sm font-extrabold text-white disabled:opacity-50 sm:w-auto">{isSaving ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}{isSaving ? 'Guardando…' : 'Guardar cambios'}</button></form></div></div>
}

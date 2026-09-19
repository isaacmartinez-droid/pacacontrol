import { useState } from 'react'
import { LoaderCircle, ReceiptText, Save } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { formatCurrency } from '../utils/currency'
import { getBusinessDateKey } from '../utils/dashboardFinancials'
import { expenseCategories, summarizeExpenses } from '../utils/expensePlanning'
import { getBusinessTerms } from '../utils/businessProfile'

const today = () => getBusinessDateKey(new Date())
const initialExpense = () => ({ concept: '', amount: '', expenseDate: today(), category: 'supplies', paymentMethod: 'cash', baleId: '', notes: '' })

export default function ExpensesPage() {
  const { data, createExpense, updateExpense, saveMonthlyExpense, setMonthlyExpenseActive, isLoading } = usePacaData()
  const terms = getBusinessTerms(data.businessProfile)
  const [month, setMonth] = useState(today().slice(0, 7))
  const [form, setForm] = useState(initialExpense)
  const [commitment, setCommitment] = useState({ concept: '', category: 'utilities', monthlyAmount: '' })
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  const summary = summarizeExpenses(data.expenses, data.monthlyExpenses, month)
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const monthlyGross = data.sales.filter((sale) => getBusinessDateKey(sale.soldAt).slice(0, 7) === month)
    .reduce((sum, sale) => sum + sale.estimatedProfit, 0)
  const categoryLabel = (id) => expenseCategories.find((item) => item.id === id)?.label ?? 'Otros'

  async function submitExpense(event) {
    event.preventDefault()
    if (!form.concept.trim() || !(Number(form.amount) > 0) || !form.expenseDate) return setMessage('Escribe un concepto, fecha y monto mayor que cero.')
    setSaving('expense')
    setMessage('')
    try {
      const values = { ...form, amount: Number(form.amount) }
      if (form.id) await updateExpense(form.id, values)
      else await createExpense(values)
      setMonth(form.expenseDate.slice(0, 7))
      setForm(initialExpense())
      setMessage(form.id ? 'Gasto corregido. Los reportes y el historial se actualizaron.' : 'Gasto registrado. Ya se descontó del resultado del mes.')
    } catch (error) { setMessage(error.message || 'No fue posible guardar el gasto.') }
    finally { setSaving('') }
  }

  async function submitCommitment(event) {
    event.preventDefault()
    if (!commitment.concept.trim() || !(Number(commitment.monthlyAmount) > 0)) return setMessage('Escribe el concepto y cuánto necesitas reservar al mes.')
    setSaving('budget')
    setMessage('')
    try {
      await saveMonthlyExpense({ ...commitment, monthlyAmount: Number(commitment.monthlyAmount) })
      setCommitment({ concept: '', category: 'utilities', monthlyAmount: '' })
      setMessage('Meta mensual guardada. No genera un gasto hasta que registres el pago real.')
    } catch (error) { setMessage(error.message || 'No fue posible guardar la meta mensual.') }
    finally { setSaving('') }
  }

  async function toggleCommitment(item) {
    setSaving(item.id)
    setMessage('')
    try { await setMonthlyExpenseActive(item.id, !item.isActive) }
    catch (error) { setMessage(error.message || 'No fue posible cambiar la meta.') }
    finally { setSaving('') }
  }

  return <div>
    <PageHeader eyebrow="Salidas y planificación" title="Gastos del negocio" description="Registra lo que pagas y planea cuánto reservar cada mes para mantener el negocio." backTo="/mas" />
    <div className="page-content space-y-5 py-5 md:py-8">
      <label className="block max-w-xs text-sm font-bold text-slate-700">Mes a consultar<input className="sale-input mt-2" type="month" required value={month} onChange={(event) => { if (event.target.value) setMonth(event.target.value) }} /></label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Gastos pagados de este mes" value={summary.spent} />
        <Metric label="Meta mensual para gastos" value={summary.reserve} />
        <Metric label="Equivalente a reservar por día" value={summary.reserve / days} />
        <Metric label="Resultado del mes después de gastos" value={monthlyGross - summary.spent} />
      </div>
      <p className="rounded-2xl bg-brand-100 p-4 text-sm text-brand-900">Las metas son un presupuesto mensual vigente, no pagos automáticos ni una reserva de caja comprobada. Solo los gastos registrados se descuentan de la ganancia. Si un insumo ya está incluido en el costo de una {terms.purchaseSingularLower}, no lo registres de nuevo.</p>
      {message && <p role="status" className="rounded-xl bg-white p-4 text-sm font-bold text-brand-900">{message}</p>}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <form onSubmit={submitExpense} className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><ReceiptText size={20} />{form.id ? 'Editar gasto pagado' : 'Agregar gasto pagado'}</h2>
          <div className="mt-4 space-y-4">
            <Field label="Concepto"><input className="sale-input" required maxLength="160" placeholder="Ej. bolsas, cinta, marcadores, luz" value={form.concept} onChange={(event) => setForm({ ...form, concept: event.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Money label="Monto en córdobas" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} /><Field label="Fecha del pago"><input className="sale-input" type="date" required value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} /></Field></div>
            <Category value={form.category} onChange={(category) => setForm({ ...form, category })} />
            <Field label="Medio de pago del gasto"><select className="sale-input" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>{Object.entries(expensePaymentLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
            <Field label={`Asignar a una ${terms.purchaseSingularLower} (opcional)`}><select className="sale-input" value={form.baleId ?? ''} onChange={(event) => setForm({ ...form, baleId: event.target.value })}><option value="">Gasto general del negocio</option>{data.bales.filter((bale) => !bale.isArchived || bale.id === form.baleId).map((bale) => <option key={bale.id} value={bale.id}>{bale.code}{bale.isArchived ? ' (en archivo)' : ''}</option>)}</select></Field>
            <Field label="Notas"><textarea className="sale-input" rows="2" maxLength="1000" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
            <Submit disabled={Boolean(saving) || isLoading} saving={saving === 'expense'} text={form.id ? 'Guardar cambios del gasto' : 'Guardar gasto pagado'} />
            {form.id && <button type="button" disabled={Boolean(saving)} onClick={() => setForm(initialExpense())} className="ml-3 min-h-10 text-sm font-bold text-slate-500">Cancelar edición del gasto</button>}
          </div>
        </form>
        <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
          <h2 className="text-lg font-extrabold text-slate-900">Metas mensuales para gastos</h2>
          <p className="mt-1 text-sm text-slate-500">Ej. luz C$500 y bolsas C$300: necesitas reservar C$800 cada mes. Puedes pausar una meta sin borrar su registro.</p>
          <form onSubmit={submitCommitment} className="mt-4 space-y-4">
            <Field label="Concepto habitual"><input className="sale-input" required maxLength="160" placeholder="Ej. electricidad del negocio" value={commitment.concept} onChange={(event) => setCommitment({ ...commitment, concept: event.target.value })} /></Field>
            <Money label="Cuánto reservar cada mes" value={commitment.monthlyAmount} onChange={(monthlyAmount) => setCommitment({ ...commitment, monthlyAmount })} />
            <Category value={commitment.category} onChange={(category) => setCommitment({ ...commitment, category })} />
            <Submit disabled={Boolean(saving) || isLoading} saving={saving === 'budget'} text={commitment.id ? 'Guardar cambios de la meta' : 'Agregar meta mensual'} />
            {commitment.id && <button type="button" onClick={() => setCommitment({ concept: '', category: 'utilities', monthlyAmount: '' })} className="ml-3 min-h-10 text-sm font-bold text-slate-500">Cancelar edición</button>}
          </form>
          <div className="mt-5 space-y-3">{data.monthlyExpenses.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><b className="text-sm text-slate-900">{item.concept}</b><p className="text-xs text-slate-500">{formatCurrency(item.monthlyAmount)} / mes · {item.isActive ? 'Vigente' : 'Pausada'}</p></div><button type="button" disabled={Boolean(saving)} onClick={() => setCommitment({ id: item.id, concept: item.concept, category: item.category, monthlyAmount: item.monthlyAmount })} className="min-h-10 px-3 text-xs font-bold text-brand-900">Editar</button><button type="button" disabled={Boolean(saving)} onClick={() => toggleCommitment(item)} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-bold text-brand-900 disabled:opacity-50">{item.isActive ? 'Pausar' : 'Activar'}</button></div>)}</div>
        </section>
      </div>
      <section className="max-w-5xl">
        <h2 className="text-lg font-extrabold text-slate-900">Movimientos del mes ({summary.movements.length})</h2>
        <div className="mt-3 space-y-3">{summary.movements.map((expense) => <article key={expense.id} className="flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-100"><div className="min-w-0"><h3 className="break-words text-sm font-bold text-slate-900">{expense.concept}</h3><p className="mt-1 text-xs text-slate-500">{expense.dateLabel} · {categoryLabel(expense.category)} · {expensePaymentLabels[expense.paymentMethod] ?? 'Sin especificar'}{expense.baleId ? ' · ' + (data.bales.find((bale) => bale.id === expense.baleId)?.code ?? terms.purchaseSingular) : ''}</p>{expense.notes && <p className="mt-1 text-xs text-slate-500">{expense.notes}</p>}</div><div><b className="block text-sm text-slate-900">{formatCurrency(expense.amount)}</b><button type="button" disabled={Boolean(saving)} onClick={() => { setForm({ ...expense, baleId: expense.baleId ?? '', paymentMethod: expense.paymentMethod ?? 'unknown' }); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="min-h-10 text-sm font-bold text-brand-800">Editar gasto</button></div></article>)}
          {!summary.movements.length && <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">No hay gastos registrados en este mes.</p>}
        </div>
      </section>
    </div>
  </div>
}
const expensePaymentLabels = { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', other: 'Otro (fuera de caja)', unknown: 'Sin especificar' }
function Metric({ label, value }) { return <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-extrabold text-brand-900">{formatCurrency(value)}</p></section> }
function Field({ label, children }) { return <label className="block text-sm font-bold text-slate-700"><span className="mb-2 block">{label}</span>{children}</label> }
function Category({ value, onChange }) { return <Field label="Tipo de gasto"><select className="sale-input" value={value} onChange={(event) => onChange(event.target.value)}>{expenseCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field> }
function Money({ label, value, onChange }) { return <Field label={label}><input className="sale-input" required type="number" min="0.01" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} /></Field> }
function Submit({ disabled, saving, text }) { return <button disabled={disabled} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-900 px-5 text-sm font-extrabold text-white disabled:opacity-50">{saving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}{saving ? 'Guardando…' : text}</button> }

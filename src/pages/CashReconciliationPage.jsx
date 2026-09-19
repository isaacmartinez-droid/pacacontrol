import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { getSupabaseClient } from '../lib/supabaseClient'
import { getBusinessDateKey } from '../utils/dashboardFinancials'
import { calculateCashReconciliation } from '../utils/cashReconciliation'
import { formatCurrency } from '../utils/currency'
import { getBusinessTerms } from '../utils/businessProfile'

export default function CashReconciliationPage() {
  const { data, isLoading, error: dataError } = usePacaData()
  const terms = getBusinessTerms(data.businessProfile)
  const today = getBusinessDateKey(new Date())
  const [form, setForm] = useState({ startDate: today, endDate: today, opening: '', otherIncome: '0', otherOutflows: '0', counted: '', notes: '' })
  const [rows, setRows] = useState([])
  const [message, setMessage] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [saving, setSaving] = useState(false)
  const summary = calculateCashReconciliation(data, form)

  useEffect(() => {
    let cancelled = false
    getSupabaseClient().from('cash_reconciliations').select('*').order('created_at', { ascending: false }).limit(20)
      .then(({ data: result, error }) => {
        if (cancelled) return
        if (error) setHistoryError('No se pudo cargar el historial. Comprueba que la actualización SQL de arqueos esté instalada.')
        else setRows(result ?? [])
      }).catch(() => { if (!cancelled) setHistoryError('No se pudo cargar el historial de arqueos.') })
    return () => { cancelled = true }
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (form.endDate < form.startDate || form.endDate > today) return setMessage('Revisa el período del arqueo.')
    if (['opening', 'otherIncome', 'otherOutflows', 'counted'].some((key) => form[key] === '' || !Number.isFinite(Number(form[key])) || Number(form[key]) < 0)) return setMessage('Completa los montos con cero o más córdobas.')
    setSaving(true)
    setMessage('')
    try {
      const { data: result, error } = await getSupabaseClient().rpc('save_cash_reconciliation', {
        p_start_date: form.startDate, p_end_date: form.endDate, p_opening: Number(form.opening),
        p_other_income: Number(form.otherIncome), p_other_outflows: Number(form.otherOutflows),
        p_counted: Number(form.counted), p_notes: form.notes.trim() || null,
      })
      if (error) throw error
      const row = Array.isArray(result) ? result[0] : result
      setRows((previous) => [row, ...previous].slice(0, 20))
      setHistoryError('')
      setMessage(`Arqueo guardado. Diferencia: ${formatCurrency(row.difference)}. No modifica ventas ni ganancias.`)
    } catch (error) { setMessage(error.message || 'No fue posible guardar el arqueo.') }
    finally { setSaving(false) }
  }

  return <div>
    <PageHeader title="Arqueo de caja" eyebrow="Control de efectivo" description="Compara el dinero contado con lo que debería quedar en caja." backTo="/mas" />
    <div className="page-content max-w-5xl space-y-5 py-5 md:py-8">
      <p className="rounded-2xl bg-brand-100 p-4 text-sm text-brand-900">Efectivo esperado = saldo inicial + cobros en efectivo + otras entradas − gastos pagados en efectivo − otras salidas. No incluye transferencias, tarjetas ni deudas pendientes. No es la ganancia de una {terms.purchaseSingularLower}.</p>
      <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-slate-100">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Desde"><input className="sale-input" required type="date" max={today} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="Hasta"><input className="sale-input" required type="date" min={form.startDate} max={today} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
          <Money label="Efectivo al inicio del período" name="opening" form={form} setForm={setForm} />
          <Money label="Otras entradas de efectivo" name="otherIncome" form={form} setForm={setForm} />
          <Money label="Otras salidas de efectivo" name="otherOutflows" form={form} setForm={setForm} />
          <Money label="Efectivo contado en caja" name="counted" form={form} setForm={setForm} />
        </div>
        <p className="text-sm text-slate-500">En otras salidas incluye pagos de {terms.purchasePluralLower}, delivery y retiros que realmente pagaste de caja y que no estén registrados como gasto en efectivo. No los cuentes dos veces. El saldo inicial corresponde al inicio de la fecha Desde; las fechas usan hora de Nicaragua.</p>
        <Field label="Notas del arqueo"><textarea className="sale-input" maxLength="1000" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Detalla entradas, retiros y pagos adicionales." /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Cobros en efectivo del período" amount={summary.collected} />
          <Metric label="Gastos en efectivo del período" amount={summary.cashExpenses} />
          <Metric label="Efectivo esperado" amount={summary.expected} />
          <Metric label={form.counted === '' ? 'Diferencia (pendiente de contar)' : summary.difference < 0 ? 'Faltante de caja' : summary.difference > 0 ? 'Sobrante de caja' : 'Caja cuadrada'} amount={form.counted === '' ? null : Math.abs(summary.difference)} />
        </div>
        {summary.unknownExpenses.length > 0 && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Hay {summary.unknownExpenses.length} gastos sin medio de pago. El cálculo es provisional. <Link className="font-bold underline" to="/gastos">Edita esos gastos</Link> antes de guardar.</p>}
        {dataError && <p role="alert" className="text-sm text-red-700">No se cargaron todos los datos. Actualiza la página antes de guardar.</p>}
        {message && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm">{message}</p>}
        <button disabled={saving || isLoading || Boolean(dataError) || summary.unknownExpenses.length > 0} className="min-h-12 rounded-xl bg-brand-900 px-5 font-bold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar arqueo'}</button>
      </form>
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Últimos 20 arqueos</h2>
        <p className="text-xs text-slate-500">Cada registro conserva los valores al guardarlo, hasta ese momento si incluye hoy. Los nuevos cobros o correcciones no cambian arqueos anteriores; puedes guardar uno nuevo para comparar.</p>
        {historyError && <p role="alert" className="text-sm text-red-700">{historyError}</p>}
        {rows.map((row) => <article key={row.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
          <h3 className="font-bold">{row.start_date} a {row.end_date}</h3>
          <p className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString('es-NI', { timeZone: 'America/Managua' })}</p>
          <p className="mt-2 text-sm">Esperado: {formatCurrency(row.expected_amount)} · Contado: {formatCurrency(row.counted_amount)} · Diferencia: {formatCurrency(row.difference)}</p>
          {row.notes && <p className="mt-2 break-words text-sm text-slate-500">{row.notes}</p>}
        </article>)}
        {!rows.length && !historyError && <p className="text-sm text-slate-500">Todavía no hay arqueos guardados.</p>}
      </section>
    </div>
  </div>
}
function Field({ label, children }) { return <label className="block text-sm font-bold"><span className="mb-2 block">{label}</span>{children}</label> }
function Money({ label, name, form, setForm }) { return <Field label={label}><input className="sale-input" required type="number" min="0" step="0.01" value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} /></Field> }
function Metric({ label, amount }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-lg font-extrabold">{amount === null ? 'Por contar' : formatCurrency(amount)}</p></div> }

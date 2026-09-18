import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import { getSupabaseClient } from '../lib/supabaseClient'
import { formatCurrency } from '../utils/currency'
import { formatBusinessDateTime } from '../utils/dates'

const PAGE_SIZE = 20
const actionNames = { archived: 'Paca archivada', reactivated: 'Paca reactivada', order_corrected: 'Pedido corregido', expense_corrected: 'Gasto corregido' }

export default function HistoryPage() {
  const [page, setPage] = useState(0)
  const [type, setType] = useState('all')
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setRows([])
    async function fetchHistory() {
      try {
        let query = getSupabaseClient().from('business_history').select('*', { count: 'exact' })
        if (type !== 'all') query = query.eq('entity_type', type)
        const result = await query.order('created_at', { ascending: false }).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        if (result.error) throw result.error
        if (!cancelled) { setRows(result.data); setCount(result.count ?? 0) }
      } catch (failure) { if (!cancelled) setError(failure.message || 'No fue posible cargar el historial.') }
      finally { if (!cancelled) setLoading(false) }
    }
    fetchHistory()
    return () => { cancelled = true }
  }, [page, type])

  return <div>
    <PageHeader eyebrow="Bitácora del negocio" title="Historial de cambios" description="Archivados, reactivaciones y correcciones de pedidos y gastos. Los datos anteriores se conservan." backTo="/mas" />
    <div className="page-content max-w-5xl space-y-4 py-5 md:py-8">
      <label className="block max-w-sm text-sm font-bold text-slate-700">Mostrar<select value={type} onChange={(event) => { setType(event.target.value); setPage(0) }} className="sale-input mt-2"><option value="all">Todos los cambios</option><option value="bale">Pacas</option><option value="sale">Pedidos</option><option value="expense">Gastos</option></select></label>
      <p className="text-xs text-slate-500">El historial comienza al instalar esta actualización. Las ventas y pacas anteriores siguen disponibles en sus pantallas.</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {loading ? <p className="text-sm text-slate-500">Cargando historial…</p> : rows.map((row) => <article key={row.id} className="rounded-3xl bg-white p-5 ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-extrabold text-slate-900"><History size={18} />{actionNames[row.action] ?? row.action}{row.entity_type === 'bale' ? ' · ' + (row.after_state?.code ?? '') : ''}</h2><time className="text-xs text-slate-500">{formatBusinessDateTime(row.created_at)}</time></div>
        <p className="mt-2 text-sm text-slate-600">{row.description}</p>
        {row.entity_type === 'sale' && <div className="mt-3 grid gap-3 sm:grid-cols-2"><Snapshot title="Antes" state={row.before_state} /><Snapshot title="Después" state={row.after_state} /></div>}
        {row.entity_type === 'expense' && <div className="mt-3 text-sm"><p>Antes: {row.before_state?.concept} · {formatCurrency(row.before_state?.amount)} · {row.before_state?.expense_date}</p><p>Después: {row.after_state?.concept} · {formatCurrency(row.after_state?.amount)} · {row.after_state?.expense_date}</p></div>}
        <Link to={row.entity_type === 'expense' ? '/gastos' : row.entity_type === 'bale' ? '/pacas?paca=' + row.entity_id : '/ventas?venta=' + row.entity_id} className="mt-3 inline-block text-sm font-bold text-brand-800 underline">Ver {row.entity_type === 'expense' ? 'gastos' : row.entity_type === 'bale' ? 'paca' : 'pedido'}</Link>
      </article>)}
      {!loading && !rows.length && !error && <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">Todavía no hay cambios en esta sección.</p>}
      <div className="flex items-center justify-between gap-3"><button type="button" disabled={page === 0 || loading} onClick={() => setPage(page - 1)} className="min-h-11 rounded-xl bg-white px-4 text-sm font-bold text-brand-900 disabled:opacity-40">Anterior</button><span className="text-xs text-slate-500">Página {page + 1} · {count} cambios</span><button type="button" disabled={(page + 1) * PAGE_SIZE >= count || loading} onClick={() => setPage(page + 1)} className="min-h-11 rounded-xl bg-white px-4 text-sm font-bold text-brand-900 disabled:opacity-40">Siguiente</button></div>
    </div>
  </div>
}

function Snapshot({ title, state }) {
  const order = state?.order ?? state
  return <section className="rounded-2xl bg-slate-50 p-4"><h3 className="text-xs font-extrabold text-slate-500">{title}</h3><p className="mt-1 font-bold text-slate-900">Total: {formatCurrency(order?.total)}</p><p className="text-xs text-slate-500">{order?.fulfillment_method === 'delivery' ? 'Envío' : 'Retiro en tienda'} · pagado: {formatCurrency(order?.paid_amount)}</p><ul className="mt-3 space-y-2 text-xs text-slate-600">{state?.items?.map((item) => <li key={item.id}>{item.category_name ?? 'Artículo'} · {item.quantity} × {formatCurrency(item.unit_price)} · {item.allocations?.map((allocation) => allocation.bale_code).join(', ')}</li>)}</ul></section>
}

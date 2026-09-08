import { Crown, Phone, Search, ShoppingBag, UserPlus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { formatCurrency } from '../utils/currency'

function CustomersPage() {
  const { data } = usePacaData()
  const customers = data.customers
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const balanceByCustomer = useMemo(() => data.sales.reduce((balances, sale) => {
    if (!sale.customerId || sale.balance <= 0) return balances
    balances.set(sale.customerId, (balances.get(sale.customerId) ?? 0) + sale.balance)
    return balances
  }, new Map()), [data.sales])
  const normalizedSearch = search.trim().toLocaleLowerCase('es')
  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch = !normalizedSearch || customer.name.toLocaleLowerCase('es').includes(normalizedSearch)
    const balance = balanceByCustomer.get(customer.id) ?? 0
    const matchesFilter = filter === 'all' || (filter === 'pending' && balance > 0) || (filter === 'priority' && customer.priority)
    return matchesSearch && matchesFilter
  })
  const filters = [
    { id: 'all', label: 'Todos', count: customers.length },
    { id: 'pending', label: 'Con saldo', count: customers.filter((customer) => (balanceByCustomer.get(customer.id) ?? 0) > 0).length },
    { id: 'priority', label: 'Prioritarios', count: customers.filter((customer) => customer.priority).length },
  ]
  return (
    <div>
      <PageHeader
        eyebrow="Relaciones"
        title="Clientes"
        description="Identifica a quienes compran con frecuencia y dales atención prioritaria."
      />
      <div className="page-content space-y-5 py-5 md:py-8">
        <Link
          to="/clientes/nuevo"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-900 px-5 text-sm font-bold text-white shadow-lg shadow-brand-900/15 transition hover:bg-brand-800 active:scale-[0.98] sm:w-fit"
        >
          <UserPlus aria-hidden="true" size={19} />
          Nuevo cliente
        </Link>

        {customers.length === 0 ? (
          <div className="max-w-3xl">
            <EmptyState
              icon={Users}
              title="Aún no tienes clientes registrados"
              description="Agrega tu primer cliente para asociarlo a una venta y consultar su historial de compras."
              action={{ to: '/clientes/nuevo', label: 'Registrar cliente' }}
            />
          </div>
        ) : (
          <>
            <div className="max-w-5xl space-y-3">
              <label className="relative block">
                <span className="sr-only">Buscar cliente por nombre</span>
                <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre"
                  className="sale-input sale-input--icon"
                />
              </label>
              <div className="flex flex-wrap gap-2" aria-label="Filtros de clientes">
                {filters.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    aria-pressed={filter === item.id}
                    className={`min-h-10 rounded-xl px-4 text-sm font-extrabold transition ${filter === item.id ? 'bg-brand-900 text-white shadow-lg shadow-brand-900/15' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-brand-50'}`}
                  >
                    {item.label} <span className="ml-1 opacity-75">{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
            {filteredCustomers.length === 0 ? (
              <div className="max-w-3xl rounded-3xl bg-white p-6 text-center shadow-soft ring-1 ring-slate-100">
                <p className="font-extrabold text-slate-800">No hay clientes para este filtro.</p>
                <button type="button" onClick={() => { setSearch(''); setFilter('all') }} className="mt-2 text-sm font-bold text-brand-700 hover:underline">Ver todos los clientes</button>
              </div>
            ) : (
          <div className="max-w-5xl space-y-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
            {filteredCustomers.map((customer) => (
              <Link
                to={`/clientes/${customer.id}`}
                key={customer.id}
                className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100"
              >
                <div className="flex items-start gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-base font-extrabold text-brand-700">
                    {customer.name
                      .split(' ')
                      .slice(0, 2)
                      .map((part) => part.charAt(0))
                      .join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-extrabold text-slate-900">{customer.name}</h2>
                      {customer.priority && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[0.65rem] font-bold text-amber-700">
                          <Crown aria-hidden="true" size={11} />
                          Prioritario
                        </span>
                      )}
                    </div>
                    {customer.phone ? (
                      <span className="mt-1 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-brand-700">
                        <Phone aria-hidden="true" size={13} />
                        {customer.phone}
                      </span>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">Sin teléfono</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3">
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <ShoppingBag aria-hidden="true" size={14} />
                    <span><strong className="text-slate-800">{customer.purchases}</strong> compras</span>
                  </p>
                  {(balanceByCustomer.get(customer.id) ?? 0) > 0 ? (
                    <p className="text-right text-xs font-bold text-coral-600">Debe {formatCurrency(balanceByCustomer.get(customer.id))}</p>
                  ) : (
                    <p className="text-right text-xs text-slate-500">Total <strong className="text-slate-800">{formatCurrency(customer.totalSpent)}</strong></p>
                  )}
                </div>
              </Link>
            ))}
          </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default CustomersPage

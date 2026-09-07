import { Crown, Phone, ShoppingBag } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { formatCurrency } from '../utils/currency'

function CustomersPage() {
  const { data } = usePacaData()
  const customers = data.customers
  return (
    <div>
      <PageHeader
        eyebrow="Relaciones"
        title="Clientes"
        description="Identifica a quienes compran con frecuencia y dales atención prioritaria."
      />
      <div className="page-content py-5 md:py-8">
        <div className="max-w-5xl space-y-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
          {customers.map((customer) => (
            <article
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
                  <a
                    href={`tel:${customer.phone.replaceAll(' ', '')}`}
                    className="mt-1 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
                  >
                    <Phone aria-hidden="true" size={13} />
                    {customer.phone}
                  </a>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3">
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <ShoppingBag aria-hidden="true" size={14} />
                  <span><strong className="text-slate-800">{customer.purchases}</strong> compras</span>
                </p>
                <p className="text-right text-xs text-slate-500">
                  Total <strong className="text-slate-800">{formatCurrency(customer.totalSpent)}</strong>
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CustomersPage

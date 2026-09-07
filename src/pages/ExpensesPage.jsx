import { ReceiptText } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { formatCurrency } from '../utils/currency'

function ExpensesPage() {
  const { data } = usePacaData()
  const expenses = data.expenses
  const totalExpenses = expenses.reduce((total, expense) => total + expense.amount, 0)

  return (
    <div>
      <PageHeader
        eyebrow="Salidas de dinero"
        title="Gastos"
        description="Controla transporte, insumos y otros costos cubiertos por la tienda."
        backTo="/mas"
      />
      <div className="page-content grid items-start gap-5 py-5 md:py-8 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)] lg:gap-8">
        <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
          <p className="text-sm font-medium text-slate-500">Gastos registrados</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Total acumulado en tu tienda</p>
        </section>

        <section aria-labelledby="expenses-list-title" className="max-w-3xl">
          <h2 id="expenses-list-title" className="mb-3 text-lg font-extrabold text-slate-900">
            Últimos movimientos
          </h2>
          <div className="space-y-2.5">
            {expenses.map((expense) => (
              <article
                key={expense.id}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-coral-50 text-coral-600">
                  <ReceiptText aria-hidden="true" size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-slate-800">{expense.concept}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{expense.dateLabel}</p>
                </div>
                <p className="shrink-0 text-sm font-extrabold text-slate-900">
                  {formatCurrency(expense.amount)}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default ExpensesPage

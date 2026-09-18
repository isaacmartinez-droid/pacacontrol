export const expenseCategories = [
  { id: 'supplies', label: 'Insumos: bolsas, cinta, marcadores' },
  { id: 'utilities', label: 'Servicios: luz, agua, internet' },
  { id: 'transport', label: 'Transporte' },
  { id: 'rent', label: 'Alquiler' },
  { id: 'marketing', label: 'Publicidad' },
  { id: 'maintenance', label: 'Mantenimiento' },
  { id: 'other', label: 'Otros' },
]

export function summarizeExpenses(expenses = [], commitments = [], month) {
  const movements = expenses.filter((expense) => expense.expenseDate?.slice(0, 7) === month)
  const spent = movements.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0)
  const reserve = commitments.filter((item) => item.isActive)
    .reduce((sum, item) => sum + (Number(item.monthlyAmount) || 0), 0)
  return { movements, spent, reserve, reserveRemaining: Math.max(0, reserve - spent) }
}

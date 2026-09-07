const cordobaFormatter = new Intl.NumberFormat('es-NI', {
  style: 'currency',
  currency: 'NIO',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatCurrency(value) {
  return cordobaFormatter.format(Number(value) || 0)
}

const cordobaFormatter = new Intl.NumberFormat('es-NI', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatCurrency(value) {
  return `C$${cordobaFormatter.format(Number(value) || 0)}`
}

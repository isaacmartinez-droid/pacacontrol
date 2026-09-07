const dateFormatter = new Intl.DateTimeFormat('es-NI', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatShortDate(value) {
  return dateFormatter.format(new Date(value))
}

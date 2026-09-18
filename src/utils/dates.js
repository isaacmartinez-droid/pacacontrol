const dateFormatter = new Intl.DateTimeFormat('es-NI', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const instantFormatter = new Intl.DateTimeFormat('es-NI', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Managua',
})

export function formatBusinessDateTime(value) {
  return value ? new Date(value).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Managua' }) : '—'
}

export function getBusinessHour(value = new Date()) {
  const parts = new Intl.DateTimeFormat('es-NI', { timeZone: 'America/Managua', hour: 'numeric', hourCycle: 'h23' }).formatToParts(value)
  return Number(parts.find((part) => part.type === 'hour').value)
}

export function formatShortDate(value) {
  const formatter = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateFormatter : instantFormatter
  return formatter.format(new Date(value))
}

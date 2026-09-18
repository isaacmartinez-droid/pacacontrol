// Presentar un aviso no equivale a leerlo. Solo una revisión nueva, o una
// reaparición después de resolverse, vuelve a abrirlo automáticamente.
export function planAlertBanners(notifications, presented = {}) {
  const next = {}
  const fresh = []
  for (const notice of notifications) {
    if (!notice.read && presented[notice.id] !== notice.revision) fresh.push(notice)
    next[notice.id] = notice.revision
  }
  return { fresh, presented: next }
}

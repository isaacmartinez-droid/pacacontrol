export function normalizePortalUrl(rawValue) {
  if (!rawValue) return ''
  try {
    const url = new URL(rawValue)
    const isLocal = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
    if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) return ''
    url.pathname = '/'
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

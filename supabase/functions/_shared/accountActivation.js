export const INVITATION_TOKEN_PATTERN = /^[0-9a-f]{64}$/

export function normalizeInvitationToken(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function isValidInvitationToken(value) {
  return INVITATION_TOKEN_PATTERN.test(normalizeInvitationToken(value))
}

export function validateActivationPassword(value) {
  const password = String(value ?? '')
  return password.length >= 10 && password.length <= 128
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function activationCorsHeaders(origin, allowedOriginsValue) {
  const allowed = String(allowedOriginsValue ?? '').split(',').map((value) => value.trim()).filter(Boolean)
  if (origin && !allowed.includes(origin)) return null
  return {
    'access-control-allow-origin': origin || allowed[0] || 'null',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'Origin',
  }
}

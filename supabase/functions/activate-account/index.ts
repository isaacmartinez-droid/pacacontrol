import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  activationCorsHeaders,
  isValidInvitationToken,
  normalizeInvitationToken,
  sha256Hex,
  validateActivationPassword,
} from '../_shared/accountActivation.js'

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }

Deno.serve(async (request) => {
  const cors = corsHeaders(request)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: cors ? 204 : 403, headers: cors || undefined })
  }
  if (request.method !== 'POST' || !cors) return json({ error: 'Solicitud no permitida.' }, 403, cors)

  try {
    const body = await request.json()
    const action = body?.action === 'preview' ? 'preview' : body?.action === 'activate' ? 'activate' : ''
    const token = normalizeInvitationToken(body?.token)
    if (!action || !isValidInvitationToken(token)) return json({ error: 'La invitación no es válida.' }, 400, cors)

    const supabaseUrl = requiredEnv('SUPABASE_URL')
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const digest = await sha256Hex(token)

    if (action === 'preview') {
      const { data, error } = await admin.rpc('preview_account_invitation', { p_code_digest: digest })
      if (error) throw error
      const invitation = data?.[0]
      if (!invitation) return json({ error: 'La invitación venció, fue revocada o ya se utilizó.' }, 404, cors)
      return json({ invitation }, 200, cors)
    }

    const password = String(body?.password ?? '')
    if (body?.acceptedLegal !== true) return json({ error: 'Debes aceptar los términos y la política de privacidad.' }, 400, cors)
    if (!validateActivationPassword(password)) {
      return json({ error: 'La contraseña debe tener entre 10 y 128 caracteres.' }, 400, cors)
    }

    const attemptId = crypto.randomUUID()
    const { data: claimed, error: claimError } = await admin.rpc('claim_account_invitation', {
      p_code_digest: digest,
      p_attempt_id: attemptId,
    })
    if (claimError) throw claimError
    const invitation = claimed?.[0]
    if (!invitation) return json({ error: 'La invitación venció, fue revocada o ya se utilizó.' }, 409, cors)

    let userId = ''
    try {
      const hostname = new URL(supabaseUrl).hostname
      const email = `${invitation.username}@${hostname}`
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: invitation.business_name,
          owner_name: invitation.owner_name,
          legal_terms_version: invitation.legal_terms_version,
          privacy_version: invitation.privacy_version,
        },
      })
      if (createError) throw createError
      userId = created.user.id

      const { data: completed, error: completeError } = await admin.rpc('complete_account_invitation_activation', {
        p_attempt_id: attemptId,
        p_user_id: userId,
      })
      if (completeError || completed !== true) throw completeError || new Error('No se pudo completar la activación.')

      return json({
        activated: true,
        username: invitation.username,
        businessName: invitation.business_name,
      }, 200, cors)
    } catch (error) {
      try {
        if (userId) await admin.auth.admin.deleteUser(userId)
      } catch { /* La compensación continuará liberando la invitación. */ }
      try {
        await admin.rpc('release_account_invitation', { p_attempt_id: attemptId })
      } catch { /* Se podrá liberar manualmente desde el panel. */ }
      throw error
    }
  } catch (error) {
    const message = safeErrorMessage(error)
    return json({ error: message }, 500, cors)
  }
})

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin')
  return activationCorsHeaders(origin, Deno.env.get('ALLOWED_ACTIVATION_ORIGINS'))
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta configurar ${name}.`)
  return value
}

function safeErrorMessage(error: unknown) {
  const raw = String((error as { message?: string })?.message ?? '')
  if (/already|registered|exists|duplicate/i.test(raw)) return 'Ese usuario ya tiene una cuenta o una activación previa.'
  if (/password/i.test(raw)) return 'La contraseña no cumple los requisitos de seguridad.'
  return 'No pudimos activar la cuenta. Intenta de nuevo o solicita otra invitación.'
}

function json(body: unknown, status: number, cors: Record<string, string> | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...(cors || {}) },
  })
}

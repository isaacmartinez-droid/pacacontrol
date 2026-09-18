// Diagnóstico sin escrituras, usuarios ni importes. Nunca imprime claves.
import { loadEnv } from 'vite'

const mode = process.argv.includes('--staging') ? 'staging' : 'production'
const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) {
  console.error(`Falta URL/clave publicable de Supabase para diagnóstico de ${mode}.`)
  process.exitCode = 1
} else {
  const origin = new URL(url).origin
  if (!origin.startsWith('https://')) throw new Error(`El diagnóstico de ${mode} requiere HTTPS.`)
  if (mode === 'staging') {
    const expectedRef = env.VITE_STAGING_PROJECT_REF
    const productionUrl = loadEnv('production', process.cwd(), '').VITE_SUPABASE_URL
    if (!expectedRef || new URL(origin).hostname !== `${expectedRef}.supabase.co`
      || (productionUrl && origin === new URL(productionUrl).origin)) {
      throw new Error('La auditoría de staging debe apuntar al proyecto de pruebas, nunca al de clientes.')
    }
  }
  const report = { checkedAt: new Date().toISOString(), environment: mode, supabaseOrigin: origin, checks: [] }
  async function check(name, path, method = 'HEAD', settings = false) {
    try {
      const response = await fetch(origin + path, { method, headers: { apikey: key }, signal: AbortSignal.timeout(10000) })
      const availability = response.ok ? 'visible'
        : [401, 403].includes(response.status) ? 'protected'
          : response.status === 400 ? 'invalid-query-or-missing-column'
            : response.status === 404 ? 'missing-or-hidden' : 'unexpected'
      const result = { name, status: response.status, availability }
      if (settings && response.ok) {
        const body = await response.json()
        result.publicSignupEnabled = typeof body.disable_signup === 'boolean' ? !body.disable_signup : 'unknown'
      }
      report.checks.push(result)
    } catch { report.checks.push({ name, status: 'unreachable' }) }
  }
  await check('auth-settings', '/auth/v1/settings', 'GET', true)
  for (const [name, columns] of [
    ['bales', 'archived_at,archived_reason'],
    ['bale_inventory', 'is_active'],
    ['business_history', 'id'],
    ['monthly_expense_commitments', 'id'],
    ['sale_additional_payments', 'id'],
    ['expenses', 'payment_method'],
    ['cash_reconciliations', 'id'],
    ['categories', 'is_user_created'],
    ['bale_other_expense_items', 'id,bale_id,concept,amount,sort_order'],
    ['business_templates', 'template_key,version,is_active'],
    ['business_profiles', 'owner_id,onboarding_status,template_key,template_version'],
  ]) await check(name, '/rest/v1/' + name + '?select=' + columns + '&limit=0')
  report.limitations = 'HEAD solo comprueba exposición/autorización del esquema; 401/403 puede ser protección esperada. Un 400/404 requiere confirmar metadatos con audit_hito0.sql. Sin credenciales administrativas no se verifican respaldos, RLS, funciones ni despliegue Vercel.'
  console.log(JSON.stringify(report, null, 2))
}

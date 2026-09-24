import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { LEGAL_TERMS_VERSION, PRIVACY_VERSION } from '../src/legal/legalContent.js'

// El portal administrativo se prueba como una compilación independiente.
const origin = 'http://127.0.0.1:5180'
const owner = '22222222-2222-4222-8222-222222222222'
const customer = '33333333-3333-4333-8333-333333333333'
let accountRole = 'owner'
const requestedResources = []
const errors = []

const server = spawn(process.execPath, [
  fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
  '--config', 'vite.admin.config.js', '--host', '127.0.0.1', '--port', '5180', '--strictPort',
], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  windowsHide: true,
  stdio: 'pipe',
  env: {
    ...process.env,
    VITE_SUPABASE_URL: 'https://admin-ui-test.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'test-public-key',
    VITE_CUSTOMER_APP_URL: 'https://customer-ui-test.example',
  },
})

let serverOutput = ''
server.stdout.on('data', (data) => { serverOutput += data })
server.stderr.on('data', (data) => { serverOutput += data })
let browser

try {
  const deadline = Date.now() + 30000
  while (true) {
    try { if ((await fetch(origin)).ok) break } catch { /* espera Vite */ }
    if (server.exitCode !== null || Date.now() > deadline) throw new Error('Vite admin no inició: ' + serverOutput)
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  const executablePath = process.env.PACA_BROWSER_PATH || [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].find((path) => existsSync(path))
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', (error) => errors.push(error.message))

  const exp = Math.floor(Date.now() / 1000) + 7200
  const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'admin@internal.test', user_metadata: { username: 'Admin' }, app_metadata: { provider: 'email' } }
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const session = { user, token_type: 'bearer', expires_at: exp, expires_in: 7200, refresh_token: 'test-only', access_token: encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({ sub: owner, aud: 'authenticated', role: 'authenticated', exp }) + '.test' }
  await page.addInitScript((value) => { localStorage.setItem('sb-admin-ui-test-auth-token', JSON.stringify(value)) }, session)

  await page.route('https://admin-ui-test.supabase.co/**', async (route) => {
    const url = new URL(route.request().url())
    const resource = url.pathname.split('/').at(-1)
    requestedResources.push(resource)
    let result = []
    if (resource === 'profiles') {
      result = [{
        id: owner,
        display_name: 'Administración interna',
        account_role: accountRole,
        access_status: 'active',
        service_plan: accountRole === 'admin' ? 'internal' : 'pilot_free',
        legal_terms_version: LEGAL_TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        terms_accepted_at: new Date().toISOString(),
        privacy_accepted_at: new Date().toISOString(),
      }]
    } else if (resource === 'admin_list_accounts') {
      const now = Date.now()
      result = [
        {
          user_id: owner,
          email: 'admin.sistema@admin-ui-test.supabase.co',
          display_name: 'Administración interna',
          account_role: 'admin',
          access_status: 'active',
          service_plan: 'internal',
          created_at: new Date(now - 30 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
          terms_accepted_at: new Date().toISOString(),
          privacy_accepted_at: new Date().toISOString(),
        },
        {
          user_id: customer,
          email: 'cliente.prueba@admin-ui-test.supabase.co',
          display_name: 'Variedades Luna',
          account_role: 'owner',
          access_status: 'active',
          service_plan: 'paid_monthly',
          next_payment_due_at: new Date(now - 86400000).toISOString(),
          created_at: new Date(now - 60 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
          legal_terms_version: LEGAL_TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          terms_accepted_at: new Date().toISOString(),
          privacy_accepted_at: new Date().toISOString(),
          bales_count: 3,
          sales_count: 8,
          customers_count: 4,
          sales_total: 1200,
          last_sale_at: new Date(now - 86400000).toISOString(),
        },
      ]
    } else if (resource === 'admin_list_account_invitations') {
      result = []
    } else if (resource === 'admin_create_account_invitation') {
      result = [{
        invitation_id: '44444444-4444-4444-8444-444444444444',
        invitation_token: 'AbCdEfGhIjKlMnOpQrSt-_',
        username: 'ana.perez',
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      }]
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: Array.isArray(result) ? { 'content-range': `0-${Math.max(0, result.length - 1)}/${result.length}` } : {},
      body: JSON.stringify(result),
    })
  })

  await page.goto(origin)
  await page.getByRole('heading', { name: 'Acceso administrativo requerido', exact: true }).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'Panel admin', exact: true }).count(), 0)

  accountRole = 'admin'
  await page.reload()
  await page.getByRole('heading', { name: 'Panel admin', exact: true }).waitFor()
  assert.equal(await page.title(), 'ControlShop | Centro de control')
  await page.getByText('Variedades Luna', { exact: true }).first().waitFor()
  await page.getByText('El pago registrado está vencido.', { exact: true }).waitFor()

  await page.goto(origin + '/cuentas')
  await page.getByRole('heading', { name: 'Cuentas', exact: true }).waitFor()
  await page.getByText('Variedades Luna', { exact: true }).last().waitFor()

  await page.goto(origin + '/cuentas/nueva')
  await page.getByRole('heading', { name: 'Crear cuenta', exact: true }).waitFor()
  await page.getByLabel('Persona responsable').waitFor()
  await page.getByText('El enlace aparecerá aquí', { exact: true }).waitFor()
  await page.getByLabel('Persona responsable').fill('Ana Pérez')
  await page.getByLabel('Usuario de acceso').fill('ana.perez')
  await page.getByRole('button', { name: 'Crear invitación', exact: true }).click()
  await page.getByText('Invitación creada', { exact: true }).waitFor()
  await page.getByText(/¡Tu espacio en ControlShop está listo para comenzar!/).waitFor()
  await page.getByText(/Hemos preparado tu acceso para que configures el sistema según tu negocio/).waitFor()
  await page.getByText(/te guiaremos paso a paso para definir tu negocio/).waitFor()
  await page.getByText(/https:\/\/customer-ui-test\.example\/bienvenida\/AbCdEfGhIjKlMnOpQrSt-_/).waitFor()
  await page.getByRole('button', { name: 'Copiar mensaje para el cliente', exact: true }).waitFor()

  await page.goto(origin + '/cuentas/' + customer)
  await page.getByRole('heading', { name: 'Variedades Luna', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Cumplimiento', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Control de la cuenta', exact: true }).waitFor()

  await page.goto(origin + '/sistema')
  await page.getByRole('heading', { name: 'Sistema', exact: true }).waitFor()
  await page.getByText('Telemetría técnica', { exact: true }).waitFor()

  const forbiddenBusinessResources = ['bales', 'sales', 'customers', 'expenses', 'business_profiles']
  assert.deepEqual(requestedResources.filter((resource) => forbiddenBusinessResources.includes(resource)), [])
  assert.deepEqual(errors, [])
  console.log('OK: el portal rechaza clientes, separa resumen, cuentas y expediente, y no consulta recursos operativos directamente.')
} finally {
  await browser?.close()
  server.kill()
}

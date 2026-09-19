import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { LEGAL_TERMS_VERSION, PRIVACY_VERSION } from '../src/legal/legalContent.js'

// El portal administrativo se prueba como una compilación independiente.
const origin = 'http://127.0.0.1:5180'
const owner = '22222222-2222-4222-8222-222222222222'
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
      result = []
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
  await page.getByText('Consola separada para monitorear clientes, planes, pagos y accesos.', { exact: true }).waitFor()

  const forbiddenBusinessResources = ['bales', 'sales', 'customers', 'expenses', 'business_profiles']
  assert.deepEqual(requestedResources.filter((resource) => forbiddenBusinessResources.includes(resource)), [])
  assert.deepEqual(errors, [])
  console.log('OK: el portal separado rechaza clientes, acepta admins y no carga datos operativos del negocio.')
} finally {
  await browser?.close()
  server.kill()
}

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { getBusinessDateKey } from '../src/utils/dashboardFinancials.js'
import { LEGAL_TERMS_VERSION, PRIVACY_VERSION } from '../src/legal/legalContent.js'

// Todo Supabase se simula: esta prueba nunca usa cuentas ni datos reales.
const origin = 'http://127.0.0.1:5179'
const owner = '11111111-1111-4111-8111-111111111111'
const today = getBusinessDateKey(new Date())
const soldAt = today + 'T18:00:00Z'
const bales = [
  { id: 'new-bale', code: 'PAC-0003', purchase_date: today, purchase_cost: 8550, received_pieces: 150, sold_pieces: 8, available_pieces: 142 },
  { id: 'old-bale', code: 'PAC-0002', purchase_date: '2026-08-01', purchase_cost: 7000, received_pieces: 100, sold_pieces: 3, available_pieces: 97 },
  { id: 'archived-bale', code: 'PAC-0001', purchase_date: '2026-07-01', purchase_cost: 4000, received_pieces: 100, sold_pieces: 100, available_pieces: 0, archived_at: '2026-08-01T12:00:00Z' },
].map((bale) => ({ owner_id: owner, damaged_pieces: 0, transport_cost: 0, other_expenses: 0, target_profit_amount: 4000, created_at: soldAt, ...bale }))
const customers = [{ id: 'customer-1', name: 'Clienta de prueba' }, { id: 'customer-2', name: 'Otro cliente' }]
const orders = [
  { id: 'sale-1', customer_id: 'customer-1', baleId: 'new-bale', quantity: 8, total: 800 },
  { id: 'sale-2', customer_id: 'customer-2', baleId: 'old-bale', quantity: 3, total: 300 },
].map((order) => ({ owner_id: owner, sold_at: soldAt, fulfillment_method: 'pickup', delivery_status: 'delivered', payment_status: 'paid', payment_method: 'cash', paid_amount: order.total, first_payment_amount: order.total, first_payment_method: 'cash', first_payment_at: new Date().toISOString(), second_payment_amount: 0, delivery_cost: 0, delivery_charge: 0, ...order }))
const expenses = []
const commitments = []
const history = []
const cashCounts = []
const baleOtherExpenseItems = []
const extraCategories = [{ category_id: 'unused-blouses', name: 'Blusas' }, { category_id: 'unused-other', name: 'Otros' }]
const categoryPrices = {}
let businessSettings = null
const businessProfile = {
  owner_id: owner,
  business_name: 'Tienda de prueba',
  activity_description: 'Venta por lotes',
  template_key: 'legacy_bales',
  template_version: 1,
  inventory_mode: 'batches',
  tracks_variants: false,
  sales_mode: 'both',
  fulfillment_methods: ['pickup', 'delivery'],
  vocabulary: { purchaseSingular: 'Paca', purchasePlural: 'Pacas', inventoryUnitSingular: 'Pieza', inventoryUnitPlural: 'Piezas' },
  onboarding_status: 'completed',
  onboarding_step: 7,
  onboarding_draft: {},
  completed_at: soldAt,
}
const businessTemplates = [
  { template_key: 'legacy_bales', version: 1, name: 'Venta por pacas o lotes', description: 'Compatible', is_active: true, config: { suggested_categories: [], vocabulary: businessProfile.vocabulary } },
  { template_key: 'general_store', version: 1, name: 'Tienda general', description: 'Para diferentes tipos de productos.', is_active: true, config: { suggested_categories: ['Abarrotes', 'Hogar', 'Cuidado personal'], vocabulary: { purchaseSingular: 'Compra', purchasePlural: 'Compras', inventoryUnitSingular: 'Producto', inventoryUnitPlural: 'Productos' } } },
  { template_key: 'manual', version: 1, name: 'Configuración manual', description: 'Sin sugerencias iniciales.', is_active: true, config: { suggested_categories: [], vocabulary: { purchaseSingular: 'Compra', purchasePlural: 'Compras', inventoryUnitSingular: 'Producto', inventoryUnitPlural: 'Productos' } } },
]
const errors = []
let baleRegistrationCalls = 0
let baleRegistrationBody
let saleRegistrationBody
let onboardingDraftCalls = 0
let onboardingCompletionBody
let accountRole = 'owner'

const server = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', '5179', '--strictPort'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), windowsHide: true, stdio: 'pipe',
  env: { ...process.env, VITE_SUPABASE_URL: 'https://paca-ui-test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-public-key', VITE_ADMIN_APP_URL: 'https://admin-ui-test.example', VITE_ALLOW_PUBLIC_SIGNUP: 'true', VITE_SIGNUP_ACCESS_CODE: 'obsolete-test-value' },
})
let serverOutput = ''
server.stdout.on('data', (data) => { serverOutput += data })
server.stderr.on('data', (data) => { serverOutput += data })
let browser
try {
  const deadline = Date.now() + 30000
  while (true) {
    try { if ((await fetch(origin)).ok) break } catch { /* espera el servidor local */ }
    if (server.exitCode !== null || Date.now() > deadline) throw new Error('Vite no inicio: ' + serverOutput)
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
  const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', user_metadata: { username: 'Isaac' }, app_metadata: { provider: 'email' } }
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const session = { user, token_type: 'bearer', expires_at: exp, expires_in: 7200, refresh_token: 'test-only', access_token: encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({ sub: owner, aud: 'authenticated', role: 'authenticated', exp }) + '.test' }
  await page.addInitScript((value) => { localStorage.setItem('sb-paca-ui-test-auth-token', JSON.stringify(value)) }, session)
  await page.route('https://paca-ui-test.supabase.co/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const table = url.pathname.split('/').at(-1)
    const method = request.method()
    const body = method === 'GET' ? null : request.postDataJSON()
    let result = []
    if (table === 'activate-account') result = body?.action === 'preview' ? { invitation: { business_name: null, owner_name: 'Ana Pérez', username: 'ana.perez', legal_terms_version: LEGAL_TERMS_VERSION, privacy_version: PRIVACY_VERSION } } : { activated: true, username: 'ana.perez', ownerName: 'Ana Pérez' }
    else if (table === 'profiles') result = [{ id: owner, display_name: 'Isaac', account_role: accountRole, access_status: 'active', service_plan: accountRole === 'admin' ? 'internal' : 'trial', legal_terms_version: LEGAL_TERMS_VERSION, privacy_version: PRIVACY_VERSION, terms_accepted_at: soldAt, privacy_accepted_at: soldAt }]
    else if (table === 'business_profiles') result = [businessProfile]
    else if (table === 'business_templates') result = businessTemplates
    else if (table === 'update_business_profile') {
      Object.assign(businessProfile, {
        business_name: body.p_business_name,
        activity_description: body.p_activity_description,
        vocabulary: body.p_vocabulary,
      })
      result = businessProfile
    }
    else if (table === 'save_business_onboarding_draft') {
      onboardingDraftCalls += 1
      Object.assign(businessProfile, {
        onboarding_status: 'in_progress',
        onboarding_step: body.p_step,
        onboarding_draft: body.p_draft,
      })
      result = businessProfile
    }
    else if (table === 'complete_business_onboarding') {
      onboardingCompletionBody = body
      const template = businessTemplates.find((item) => item.template_key === body.p_template_key)
      Object.assign(businessProfile, {
        business_name: body.p_business_name,
        activity_description: body.p_activity_description,
        template_key: template.template_key,
        template_version: template.version,
        inventory_mode: body.p_inventory_mode,
        tracks_variants: body.p_tracks_variants,
        sales_mode: body.p_sales_mode,
        fulfillment_methods: body.p_fulfillment_methods,
        vocabulary: template.config.vocabulary,
        onboarding_status: 'completed',
        onboarding_step: 7,
        onboarding_draft: {},
        completed_at: new Date().toISOString(),
      })
      result = businessProfile
    }
    else if (table === 'bale_summary') result = bales
    else if (table === 'inventory_summary') result = [{ category_id: 'category-1', name: 'Pantalones', ...categoryPrices, received_pieces: bales.filter((bale) => !bale.archived_at).reduce((sum, bale) => sum + bale.received_pieces, 0), available_pieces: bales.filter((bale) => !bale.archived_at).reduce((sum, bale) => sum + bale.available_pieces, 0) }, ...extraCategories]
    else if (table === 'business_settings') {
      if (method === 'POST') businessSettings = body
      result = businessSettings ? [businessSettings] : []
    }
    else if (table === 'save_category_price_rules') {
      for (const rule of body.p_rules) Object.assign(rule.category_id === 'category-1' ? categoryPrices : extraCategories.find((category) => category.category_id === rule.category_id), rule)
    }
    else if (table === 'categories') {
      if (method === 'POST') extraCategories.push({ category_id: 'added-category', ...body })
      if (method === 'PATCH') Object.assign(extraCategories.find((item) => 'eq.' + item.category_id === url.searchParams.get('id')), body)
      result = extraCategories
    }
    else if (table === 'bale_inventory_pricing') result = bales.map((bale) => ({ id: bale.id + '-inventory', bale_id: bale.id, bale_code: bale.code, category_id: 'category-1', category_name: 'Pantalones', received_quantity: bale.received_pieces, sold_quantity: bale.sold_pieces, damaged_quantity: 0, available_quantity: bale.available_pieces, is_active: !bale.archived_at, bale_archived_at: bale.archived_at, price_level: 'economic', estimated_unit_cost: 57, recommended_unit_price: 100, target_profit_amount: 4000 }))
    else if (table === 'bale_other_expense_items') result = baleOtherExpenseItems
    else if (table === 'customer_summary') result = customers.map((customer) => ({ ...customer, purchases: 1, total_spent: orders.filter((order) => order.customer_id === customer.id).reduce((sum, order) => sum + order.total, 0) }))
    else if (table === 'sales') result = orders.map((order) => ({ ...order, merchandise_total: order.total, estimated_merchandise_cost: order.quantity * 57, additional_payments: [], customer: customers.find((customer) => customer.id === order.customer_id), sale_items: [{ id: order.id + '-item', category_id: 'category-1', quantity: order.quantity, unit_price: 100, reference_unit_cost: 57, recommended_unit_price: 100, category: { id: 'category-1', name: 'Pantalones' }, sale_item_allocations: [{ quantity: order.quantity, inventory: { id: order.baleId + '-inventory', bale: bales.find((bale) => bale.id === order.baleId) } }] }] }))
    else if (table === 'sale_item_allocations') result = orders.map((order) => ({ quantity: order.quantity, sale_item: { unit_price: 100 }, inventory: { bale_id: order.baleId } }))
    else if (table === 'expenses') {
      if (method === 'POST') expenses.push({ id: 'expense-' + expenses.length, ...body })
      result = expenses
    } else if (table === 'update_business_expense') {
      const expense = expenses.find((item) => item.id === body.p_expense_id)
      Object.assign(expense, { concept: body.p_concept, amount: body.p_amount, expense_date: body.p_expense_date, category: body.p_category, payment_method: body.p_payment_method, bale_id: body.p_bale_id, notes: body.p_notes })
      result = expense
    } else if (table === 'cash_reconciliations') result = cashCounts
    else if (table === 'save_cash_reconciliation') {
      const collected = orders.reduce((sum, order) => sum + order.first_payment_amount, 0)
      const cashExpenses = expenses.filter((expense) => expense.payment_method === 'cash').reduce((sum, expense) => sum + expense.amount, 0)
      const expected = body.p_opening + collected + body.p_other_income - cashExpenses - body.p_other_outflows
      result = { id: 'cash-' + cashCounts.length, start_date: body.p_start_date, end_date: body.p_end_date, expected_amount: expected, counted_amount: body.p_counted, difference: body.p_counted - expected, created_at: new Date().toISOString() }
      cashCounts.push(result)
    } else if (table === 'monthly_expense_commitments') {
      if (method === 'POST') commitments.push({ id: 'commitment-' + commitments.length, is_active: true, ...body })
      if (method === 'PATCH') Object.assign(commitments.find((item) => 'eq.' + item.id === url.searchParams.get('id')), body)
      result = commitments
    } else if (table === 'business_history') result = history
    else if (table === 'set_bale_archived') {
      const bale = bales.find((item) => item.id === body.p_bale_id)
      bale.archived_at = body.p_archived ? new Date().toISOString() : null
      history.push({ id: 'event-1', entity_id: bale.id, entity_type: 'bale', action: 'archived', description: 'Paca archivada sin borrar sus datos.', after_state: bale, created_at: new Date().toISOString() })
    } else if (table === 'create_bale_with_expense_details') {
      baleRegistrationCalls += 1
      baleRegistrationBody = body
      const quantity = body.p_category_entries.reduce((sum, entry) => sum + entry.quantity, 0)
      const otherExpenses = body.p_other_expense_items.reduce((sum, item) => sum + item.amount, 0)
      const bale = { id: 'atomic-bale', code: 'PAC-0004', owner_id: owner, created_at: soldAt,
        purchase_date: body.p_purchase_date, purchase_cost: body.p_purchase_cost,
        transport_cost: body.p_transport_cost, other_expenses: otherExpenses,
        target_profit_amount: body.p_target_profit_amount, received_pieces: quantity,
        sold_pieces: 0, damaged_pieces: 0, available_pieces: quantity }
      bales.push(bale)
      body.p_other_expense_items.forEach((item, sortOrder) => baleOtherExpenseItems.push({ id: 'other-' + sortOrder, bale_id: bale.id, concept: item.concept, amount: item.amount, sort_order: sortOrder }))
      result = bale
    } else if (table === 'update_bale_with_expense_details') {
      const bale = bales.find((item) => item.id === body.p_bale_id)
      Object.assign(bale, {
        purchase_date: body.p_purchase_date,
        purchase_cost: body.p_purchase_cost,
        transport_cost: body.p_transport_cost,
        target_profit_amount: body.p_target_profit_amount,
        other_expenses: body.p_other_expense_items === null ? bale.other_expenses : body.p_other_expense_items.reduce((sum, item) => sum + item.amount, 0),
      })
      if (body.p_other_expense_items !== null) {
        baleOtherExpenseItems.splice(0, baleOtherExpenseItems.length, ...baleOtherExpenseItems.filter((item) => item.bale_id !== bale.id))
        body.p_other_expense_items.forEach((item, sortOrder) => baleOtherExpenseItems.push({ id: 'edited-other-' + sortOrder, bale_id: bale.id, concept: item.concept, amount: item.amount, sort_order: sortOrder }))
      }
      result = bale
    } else if (table === 'register_sale_with_items') {
      saleRegistrationBody = body
      result = { id: 'numeric-input-test-sale' }
    } else if (table === 'update_sale_order') {
      const order = orders.find((item) => item.id === body.p_sale_id)
      const quantity = body.p_items.reduce((sum, item) => sum + item.price_lines.reduce((n, line) => n + line.quantity, 0), 0)
      const bale = bales.find((item) => item.id === order.baleId)
      bale.sold_pieces += quantity - order.quantity
      bale.available_pieces -= quantity - order.quantity
      order.quantity = quantity
      order.total = quantity * 100
      order.payment_status = order.paid_amount < order.total ? 'partial' : 'paid'
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: Array.isArray(result) ? { 'content-range': '0-' + Math.max(0, result.length - 1) + '/' + result.length } : {}, body: JSON.stringify(result) })
  })
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('https://admin-ui-test.example/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Portal administrativo separado</h1>' }))

  await page.goto(origin)
  await page.getByRole('heading', { name: 'Tu resumen' }).waitFor()
  await page.getByRole('link', { name: /Inversión de esta paca: C\$7,000/ }).waitFor()
  assert.equal(await page.locator('#summary-title').locator('..').locator('..').evaluate((element) => element.scrollWidth <= element.clientWidth), true)
  assert.equal(await page.getByText('Clienta de prueba', { exact: true }).count(), 0)
  await page.getByText('Otro cliente', { exact: true }).waitFor()
  const baleSelector = page.getByLabel('Paca para inversión y recuperación')
  await baleSelector.selectOption('new-bale')
  await page.getByRole('link', { name: /Inversión de esta paca: C\$8,550/ }).waitFor()
  assert.equal(await page.getByText('Otro cliente', { exact: true }).count(), 0)
  await page.getByText('Clienta de prueba', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Hoy', exact: true }).click()
  await page.getByText('Clienta de prueba', { exact: true }).waitFor()
  await page.getByRole('link', { name: 'Ver todos', exact: true }).click()
  await page.waitForURL('**/ventas?paca=new-bale')
  assert.equal(await page.getByText('Otro cliente', { exact: true }).count(), 0)
  await page.getByLabel('Paca de los pedidos').selectOption('old-bale')
  await page.getByText('Otro cliente', { exact: true }).waitFor()
  assert.equal(await page.getByText('Clienta de prueba', { exact: true }).count(), 0)
  console.log('OK: paca mas antigua por defecto; cambiar paca filtra pedidos y Ver todos conserva el filtro.')

  orders.push({ ...orders[1], id: 'extra-old-1' }, { ...orders[1], id: 'extra-old-2' })
  await page.goto(origin)
  await page.getByRole('heading', { name: 'Pedidos de PAC-0002', exact: true }).waitFor()
  await page.waitForFunction(() => document.querySelectorAll('h3').length >= 3)
  assert.equal(await page.getByText('Otro cliente', { exact: true }).count(), 3)
  orders.splice(2)
  bales[1].available_pieces = 0
  await page.goto(origin)
  const banners = page.getByRole('complementary', { name: 'Avisos en pantalla' })
  await banners.getByText('Sin existencias en paca: PAC-0002', { exact: true }).waitFor()
  await banners.getByRole('button', { name: 'Cerrar aviso: Sin existencias en paca: PAC-0002', exact: true }).click()
  await page.reload()
  await page.getByRole('link', { name: /Inversión de esta paca: C\$8,550/ }).waitFor()
  assert.equal(await page.getByRole('complementary', { name: 'Avisos en pantalla' }).count(), 0)
  await page.getByLabel('Paca para inversión y recuperación').selectOption('old-bale')
  await page.getByRole('link', { name: /Inversión de esta paca: C\$7,000/ }).waitFor()
  bales[1].available_pieces = 97
  console.log('OK: muestra mas de dos pedidos; al agotarse avanza y permite consultar la paca agotada manualmente.')

  await page.goto(origin + '/ventas/nueva')
  await page.getByLabel('Paca de origen').selectOption('old-bale-inventory')
  const newPrice = page.getByLabel(/Precio por pieza/)
  await newPrice.fill('')
  assert.equal(await newPrice.inputValue(), '')
  await newPrice.pressSequentially('250')
  assert.equal(await newPrice.inputValue(), '250')
  const newQuantity = page.getByLabel('Cantidad 1', { exact: true })
  await newQuantity.fill('')
  assert.equal(await newQuantity.inputValue(), '')
  await newQuantity.pressSequentially('3')
  assert.equal(await newQuantity.inputValue(), '3')
  await page.getByRole('button', { name: 'Registrar pedido', exact: true }).click()
  await page.getByRole('heading', { name: 'Pedido registrado', exact: true }).waitFor()
  assert.deepEqual(saleRegistrationBody.p_items[0].price_lines, [{ quantity: 3, unit_price: 250 }])
  console.log('OK: precio y cantidad se vacian sin cero pegado y se envian como numeros al registrar.')

  await page.goto(origin + '/clientes/customer-1')
  await page.getByRole('link', { name: 'Editar artículos y total' }).click()
  const editPrice = page.getByLabel(/Precio por pieza/)
  await editPrice.fill('')
  assert.equal(await editPrice.inputValue(), '')
  await editPrice.pressSequentially('100')
  assert.equal(await editPrice.inputValue(), '100')
  await page.getByLabel('Cantidad', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Guardar pedido' }).click()
  await page.waitForURL('**/ventas')
  await page.getByText('Otro cliente', { exact: true }).waitFor()
  assert.equal(orders[0].total, 1000)
  assert.equal(orders[0].paid_amount, 800)
  assert.equal(await page.getByText('Clienta de prueba', { exact: true }).count(), 1)
  console.log('OK: editar pedido entregado conserva pago y vuelve a mostrar los otros pedidos.')

  await page.goto(origin + '/gastos')
  await page.getByLabel('Concepto', { exact: true }).fill('Bolsas de prueba')
  await page.getByLabel('Monto en córdobas').fill('200')
  await page.getByRole('button', { name: 'Guardar gasto pagado' }).click()
  await page.getByText('Bolsas de prueba', { exact: true }).waitFor()
  await page.getByLabel('Concepto habitual').fill('Luz')
  await page.getByLabel('Cuánto reservar cada mes').fill('500')
  await page.getByRole('button', { name: 'Agregar meta mensual' }).click()
  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  await page.getByLabel('Cuánto reservar cada mes').fill('700')
  await page.getByRole('button', { name: 'Guardar cambios de la meta' }).click()
  await page.getByText('C$700 / mes · Vigente', { exact: true }).waitFor()
  assert.equal(expenses[0].amount, 200)
  assert.equal(commitments[0].monthly_amount, 700)
  console.log('OK: registra gasto real y crea/corrige presupuesto mensual por separado.')

  await page.getByRole('button', { name: 'Editar gasto', exact: true }).click()
  await page.getByLabel('Monto en córdobas').fill('150')
  await page.getByRole('button', { name: 'Cancelar edición del gasto' }).click()
  assert.equal(expenses[0].amount, 200)
  await page.getByRole('button', { name: 'Editar gasto', exact: true }).click()
  await page.getByLabel('Monto en córdobas').fill('150')
  await page.getByRole('button', { name: 'Guardar cambios del gasto' }).click()
  await page.getByText('Gasto corregido. Los reportes y el historial se actualizaron.').waitFor()
  assert.equal(expenses.length, 1)
  assert.equal(expenses[0].amount, 150)
  assert.equal(expenses[0].payment_method, 'cash')
  await page.goto(origin + '/caja')
  await page.getByLabel('Efectivo al inicio del período').fill('300')
  await page.getByLabel('Otras entradas de efectivo').fill('50')
  await page.getByLabel('Otras salidas de efectivo').fill('100')
  await page.getByLabel('Efectivo contado en caja').fill('1200')
  await page.getByLabel('Efectivo contado en caja').fill('1199.6')
  await page.getByText('Faltante de caja', { exact: true }).waitFor()
  await page.getByText('C$0.4', { exact: true }).waitFor()
  await page.getByLabel('Efectivo contado en caja').fill('1200')
  await page.getByText('Caja cuadrada', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Guardar arqueo' }).click()
  await page.getByText(/Arqueo guardado/).waitFor()
  await page.reload()
  await page.getByText('Esperado: C$1,200 · Contado: C$1,200 · Diferencia: C$0', { exact: true }).waitFor()
  assert.equal(cashCounts.length, 1)
  expenses[0].payment_method = 'unknown'
  await page.reload()
  await page.getByText(/Hay 1 gastos sin medio de pago/).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Guardar arqueo' }).isDisabled(), true)
  expenses[0].payment_method = 'cash'
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  console.log('OK: corrige gasto sin duplicar, cancela edición y guarda arqueo; gastos desconocidos bloquean cierre.')

  await page.goto(origin + '/pacas?paca=new-bale')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Archivar paca y conservar historial' }).click()
  await page.getByRole('heading', { name: 'PAC-0002', exact: true }).waitFor()
  await page.goto(origin + '/ventas?archivo=1')
  await page.getByText('Clienta de prueba', { exact: true }).waitFor()
  await page.goto(origin + '/historial')
  await page.getByRole('heading', { name: 'En archivo: Paca · PAC-0003', exact: true }).waitFor()
  assert.equal(orders.length, 2)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  assert.deepEqual(errors, [])
  console.log('OK: archiva, muestra la siguiente paca y conserva pedidos/historial sin errores de interfaz.')

  await page.goto(origin + '/pacas/nueva')
  await page.getByLabel(/Costo de compra/).fill('7000')
  await page.getByRole('button', { name: 'Agregar otro gasto', exact: true }).click()
  await page.getByLabel('Concepto de otro gasto 1').fill('Empaque')
  await page.getByLabel('Monto de otro gasto 1').fill('125.50')
  await page.getByLabel('Nombre', { exact: true }).fill('Pantalones')
  await page.getByLabel('Piezas', { exact: true }).fill('10')
  const levelOptions = page.getByRole('combobox', { name: /Nivel de precio/ }).locator('option')
  await levelOptions.first().waitFor({ state: 'attached' })
  const levels = await levelOptions.evaluateAll((items) => items.map((item) => item.value))
  assert.deepEqual(levels, ['economic', 'standard', 'premium', 'custom'])
  await page.getByRole('button', { name: 'Registrar paca', exact: true }).click()
  await page.getByText('Registro completado', { exact: true }).waitFor()
  await page.getByRole('heading', { name: 'PAC-0004', exact: true }).waitFor()
  assert.equal(baleRegistrationCalls, 1)
  assert.deepEqual(baleRegistrationBody.p_other_expense_items, [{ concept: 'Empaque', amount: 125.5 }])
  await page.goto(origin + '/pacas?paca=atomic-bale')
  await page.getByText('Otros gastos de compra', { exact: false }).click()
  const expenseDetail = page.getByRole('listitem').filter({ hasText: 'Empaque' })
  await expenseDetail.getByText('Empaque', { exact: true }).waitFor()
  await expenseDetail.getByText('C$125.5', { exact: true }).waitFor()
  await page.getByRole('link', { name: 'Editar paca', exact: true }).click()
  await page.getByLabel('Monto de otro gasto 1').fill('150.25')
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await page.waitForURL('**/pacas?paca=atomic-bale')
  await page.getByText('Otros gastos de compra', { exact: false }).click()
  await page.getByRole('listitem').filter({ hasText: 'Empaque' }).getByText('C$150.25', { exact: true }).waitFor()
  bales.find((item) => item.id === 'old-bale').other_expenses = 80
  await page.goto(origin + '/pacas?paca=old-bale')
  await page.getByText('Otros gastos de compra', { exact: false }).click()
  await page.getByText('Detalle anterior no desglosado.', { exact: false }).waitFor()
  await page.getByRole('link', { name: 'Editar paca', exact: true }).click()
  await page.getByRole('button', { name: 'Desglosar este total', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await page.waitForURL('**/pacas?paca=old-bale')
  assert.equal(bales.find((item) => item.id === 'old-bale').other_expenses, 80)
  assert.equal(baleOtherExpenseItems.filter((item) => item.bale_id === 'old-bale').length, 0)
  assert.deepEqual(errors, [])
  console.log('OK: registra y corrige el desglose; los totales históricos se conservan sin inventar conceptos.')

  await page.goto(origin + '/preferencias')
  await page.getByRole('heading', { name: 'Pantalones', exact: true }).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'Blusas', exact: true }).count(), 0)
  assert.equal(await page.getByRole('heading', { name: 'Otros', exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Copiar C$100 a Económico de Pantalones', exact: true }).click()
  assert.equal(await page.getByLabel(/^Económico/).inputValue(), '100')
  await page.getByLabel(/^Económico/).fill('125')
  await page.getByLabel('Nombre de la nueva categoría').fill('Zapatos')
  await page.getByRole('button', { name: 'Agregar más', exact: true }).click()
  await page.getByRole('heading', { name: 'Zapatos', exact: true }).waitFor()
  assert.equal(await page.getByLabel(/^Económico/).first().inputValue(), '125')
  assert.equal(extraCategories.at(-1).is_user_created, true)
  await page.getByRole('button', { name: 'Guardar preferencias', exact: true }).click()
  await page.getByText('Preferencias guardadas correctamente.', { exact: true }).waitFor()
  assert.equal(categoryPrices.economic_price, 125)
  await page.reload()
  await page.getByRole('heading', { name: 'Zapatos', exact: true }).waitFor()
  assert.equal(await page.getByLabel(/^Económico/).first().inputValue(), '125')
  await page.getByRole('button', { name: 'Ventas y pacas', exact: true }).click()
  await page.getByRole('button', { name: 'Usar objetivo de última compra', exact: true }).click()
  assert.equal(await page.getByLabel('Ganancia deseada para nuevas pacas').inputValue(), '4000')
  await page.getByText('Valores copiados de tus registros. Pulsa Guardar preferencias para conservarlos.').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Usar valores del último envío', exact: true }).count(), 0)
  await page.getByLabel('Costo habitual de delivery').fill('333')
  await page.getByRole('button', { name: 'Precios', exact: true }).click()
  await page.getByLabel('Nombre de la nueva categoría').fill('Blusas')
  await page.getByRole('button', { name: 'Agregar más', exact: true }).click()
  await page.getByText('Categoría agregada. No se creó inventario ni una compra.').waitFor()
  await page.getByRole('button', { name: 'Ventas y pacas', exact: true }).click()
  assert.equal(await page.getByLabel('Costo habitual de delivery').inputValue(), '333')
  await page.getByRole('button', { name: 'Guardar preferencias', exact: true }).click()
  await page.getByText('Preferencias guardadas correctamente.', { exact: true }).waitFor()
  assert.equal(businessSettings.default_delivery_cost, 333)
  await page.reload()
  await page.getByRole('button', { name: 'Ventas y pacas', exact: true }).click()
  assert.equal(await page.getByLabel('Costo habitual de delivery').inputValue(), '333')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  assert.deepEqual(errors, [])
  console.log('OK: categorías reales sin supuestos, última venta copiable, agregar categoría conserva borradores y persiste; objetivo viene de última compra.')

  await page.goto(origin + '/ajustes')
  await page.getByRole('heading', { name: 'Ajustes', exact: true }).waitFor()
  assert.equal(await page.getByText('Venta por pacas o lotes', { exact: true }).count(), 1)
  await page.getByLabel('Nombre visible del negocio').fill('Comercio de prueba')
  await page.getByLabel('Una compra o lote').fill('Lote')
  await page.getByLabel('Varias compras o lotes').fill('Lotes')
  await page.getByRole('button', { name: 'Guardar ajustes', exact: true }).click()
  await page.getByText('Información del negocio actualizada.', { exact: true }).waitFor()
  assert.equal(businessProfile.business_name, 'Comercio de prueba')
  assert.equal(businessProfile.vocabulary.purchasePlural, 'Lotes')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  console.log('OK: Ajustes carga el perfil migrado y guarda identidad y vocabulario del negocio.')

  Object.assign(businessProfile, {
    business_name: '', activity_description: null, template_key: null, template_version: null,
    inventory_mode: null, tracks_variants: false, sales_mode: null,
    fulfillment_methods: ['pickup'], onboarding_status: 'pending', onboarding_step: 0,
    onboarding_draft: {}, completed_at: null,
  })
  await page.goto(origin)
  await page.waitForURL('**/configurar-negocio')
  await page.getByRole('heading', { name: 'Cuéntanos sobre tu negocio', exact: true }).waitFor()
  await page.getByLabel('Nombre del negocio').fill('Variedades Luna')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('heading', { name: '¿Qué tipo de negocio tienes?', exact: true }).waitFor()
  assert.equal(await page.getByText('Venta por pacas o lotes', { exact: true }).count(), 0)
  await page.getByRole('button', { name: /Tienda general/ }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: /Por unidades/ }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: /Ambas formas/ }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: /Envío o delivery/ }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByText('Abarrotes', { exact: true }).waitFor()
  assert.equal(onboardingCompletionBody, undefined)
  await page.getByLabel('Nueva categoría').fill('Zapatos')
  await page.getByRole('button', { name: 'Agregar', exact: true }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: 'Preparar mi sistema', exact: true }).click()
  await page.getByRole('heading', { name: 'Estamos adaptando tu sistema', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Tu resumen', exact: true }).waitFor()
  assert.ok(onboardingDraftCalls >= 6)
  assert.equal(onboardingCompletionBody.p_business_name, 'Variedades Luna')
  assert.equal(onboardingCompletionBody.p_template_key, 'general_store')
  assert.deepEqual(onboardingCompletionBody.p_fulfillment_methods, ['pickup', 'delivery'])
  assert.deepEqual(onboardingCompletionBody.p_categories, ['Abarrotes', 'Hogar', 'Cuidado personal', 'Zapatos'])
  assert.equal(businessProfile.onboarding_status, 'completed')
  await page.getByRole('link', { name: 'Compras', exact: true }).waitFor()
  assert.equal(await page.getByText(/\bPacas?\b/i).count(), 0)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  assert.deepEqual(errors, [])
  console.log('OK: cuenta nueva reanuda el asistente y crea categorías solo al confirmar la configuración.')

  const guest = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await guest.route('https://paca-ui-test.supabase.co/**', async (route) => {
    const resource = new URL(route.request().url()).pathname.split('/').at(-1)
    const result = resource === 'activate-account'
      ? { invitation: { business_name: null, owner_name: 'Ana Pérez', username: 'ana.perez', legal_terms_version: LEGAL_TERMS_VERSION, privacy_version: PRIVACY_VERSION } }
      : []
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) })
  })
  await guest.goto(origin + '/bienvenida/' + 'AbCdEfGhIjKlMnOpQrSt-_')
  await guest.getByRole('heading', { name: 'Activa tu cuenta', exact: true }).waitFor()
  await guest.getByText('Ana Pérez', { exact: true }).waitFor()
  await guest.getByLabel('Crea tu contraseña').waitFor()
  await guest.goto(origin + '/acceder')
  await guest.getByRole('heading', { name: 'ControlShop', exact: true }).waitFor()
  await guest.getByRole('heading', { name: 'Bienvenido de nuevo', exact: true }).waitFor()
  assert.equal(await guest.getByRole('button', { name: /Crear.*cuenta/ }).count(), 0)
  await guest.close()
  console.log('OK: registro publico permanece cerrado aunque existan variables VITE antiguas.')

  await page.goto(origin + '/admin')
  await page.getByRole('heading', { name: 'Esta pantalla no existe', exact: true }).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'Panel admin', exact: true }).count(), 0)

  accountRole = 'admin'
  await page.reload()
  await page.waitForURL('https://admin-ui-test.example/')
  await page.getByRole('heading', { name: 'Portal administrativo separado', exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log('OK: la app comercial no contiene /admin y deriva cuentas internas al portal independiente.')
} finally {
  await browser?.close()
  server.kill()
}

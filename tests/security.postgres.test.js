import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('fase 1: aislamiento, registro y RPC no dependen de controles del navegador', async (t) => {
  const db = new PGlite()
  const owner = '11111111-1111-4111-8111-111111111111'
  const other = '22222222-2222-4222-8222-222222222222'
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]
  const login = async (id, role = 'authenticated') => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ''])
    await db.exec('set role ' + role)
  }
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`)
    const dir = new URL('../supabase/migrations/', import.meta.url)
    for (const name of (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort()) {
      await db.exec((await readFile(new URL(name, dir), 'utf8')).replace('create extension if not exists pgcrypto;', ''))
    }
    await db.query('insert into auth.users(id, raw_user_meta_data) values ($1, $3), ($2, $3)',
      [owner, other, JSON.stringify({ account_role: 'admin', service_plan: 'internal', access_status: 'active' })])

    await t.test('registro directo queda suspendido y no confía en rol/plan de metadata', async () => {
      const row = await scalar('select access_status, account_role, service_plan from public.profiles where id = $1', [owner])
      assert.deepEqual(row, { access_status: 'suspended', account_role: 'owner', service_plan: 'pilot_free' })
      assert.equal(Number((await scalar('select count(*) as count from public.categories where owner_id = $1', [owner])).count), 0)
      assert.equal((await scalar('select onboarding_status from public.business_profiles where owner_id = $1', [owner])).onboarding_status, 'pending')
      await login(owner)
      await assert.rejects(db.exec("insert into public.customers(name) values ('No autorizado')"), /row-level security|acceso activo/)
      await assert.rejects(db.exec('select public.admin_list_accounts()'), /administrador/)
      await db.exec('reset role')
      await db.exec("update public.profiles set access_status = 'active'")
    })

    await t.test('onboarding guarda borrador sin inventar categorias y confirma una sola vez', async () => {
      await login(owner)
      const draft = await scalar("select onboarding_status, onboarding_step from public.save_business_onboarding_draft(2, '{\"businessName\":\"Mi tienda\"}'::jsonb)")
      assert.deepEqual(draft, { onboarding_status: 'in_progress', onboarding_step: 2 })
      assert.equal(Number((await scalar('select count(*) as count from public.categories')).count), 0)
      await db.query(`select public.complete_business_onboarding(
        'Negocio de prueba', 'manual', 'batches', false, 'both',
        array['pickup','delivery'], array['Pantalones','pantalones'], 'Pruebas de seguridad'
      )`)
      assert.equal(Number((await scalar("select count(*) as count from public.categories where lower(name) = 'pantalones'")).count), 1)
      await db.query(`select public.complete_business_onboarding(
        'Intento posterior', 'general_store', 'units', true, 'immediate',
        array['pickup'], array['Zapatos'], 'No debe reemplazar la configuración'
      )`)
      assert.equal(Number((await scalar("select count(*) as count from public.categories where lower(name) = 'pantalones'")).count), 1)
      assert.equal(Number((await scalar("select count(*) as count from public.categories where lower(name) = 'zapatos'")).count), 0)
      await assert.rejects(db.exec("select public.save_business_onboarding_draft(3, '{}'::jsonb)"), /ya fue completada/)
      const profile = await scalar('select onboarding_status, template_key, onboarding_step from public.business_profiles')
      assert.deepEqual(profile, { onboarding_status: 'completed', template_key: 'manual', onboarding_step: 7 })
    })

    await login(other)
    await db.query(`select public.complete_business_onboarding(
      'Otro negocio', 'manual', 'batches', false, 'both',
      array['pickup','delivery'], array['Pantalones'], 'Pruebas de seguridad'
    )`)

    await login(other)
    const foreignCategory = await scalar("select id from public.categories where name = 'Pantalones'")
    const foreignCustomer = await scalar("insert into public.customers(name) values ('Otro negocio') returning id")
    await login(owner)
    const bale = await scalar('insert into public.bales(purchase_cost, received_pieces, target_profit_amount) values (8550, 100, 4000) returning id')
    const category = await scalar("select id from public.categories where name = 'Pantalones'")
    const inventory = await scalar('insert into public.bale_inventory(bale_id, category_id, received_quantity) values ($1, $2, 100) returning id', [bale.id, category.id])
    const customer = await scalar("insert into public.customers(name) values ('Mi cliente') returning id")
    const items = JSON.stringify([{ category_id: category.id, bale_inventory_id: inventory.id, price_lines: [{ quantity: 2, unit_price: 100 }] }])

    await t.test('categoría explícita persiste sin inventario y conserva aislamiento por negocio', async () => {
      await login(owner)
      const added = await scalar("insert into public.categories(name, slug, is_user_created) values ('Zapatos', 'explicit-shoes', true) returning id")
      const visible = await scalar('select is_user_created, received_pieces, available_pieces from public.inventory_summary where category_id = $1', [added.id])
      assert.deepEqual(visible, { is_user_created: true, received_pieces: 0, available_pieces: 0 })
      await login(other)
      assert.equal(Number((await scalar('select count(*) as count from public.inventory_summary where category_id = $1', [added.id])).count), 0)
      assert.equal((await db.query('update public.categories set is_user_created = false where id = $1 returning id', [added.id])).rows.length, 0)
      await login(owner)
    })
    const sale = await scalar("select * from public.register_sale_with_items($1::jsonb, 'cash', $2)", [items, customer.id])

    await t.test('inventario propio no puede relacionarse con categorías ajenas', async () => {
      await assert.rejects(db.query('insert into public.bale_inventory(bale_id, category_id, received_quantity) values ($1, $2, 10)', [bale.id, foreignCategory.id]), /mismo negocio/)
      await assert.rejects(db.query("select public.register_sale_with_items($1::jsonb, 'cash', $2)", [items, foreignCustomer.id]), /no existe o no te pertenece/)
    })

    await t.test('REST no puede editar pagos ni elevar rol, plan o estado', async () => {
      await assert.rejects(db.query("update public.sales set delivery_status = 'delivered' where id = $1", [sale.id]), /permission denied/)
      for (const field of ['account_role', 'service_plan', 'access_status']) {
        const value = field === 'account_role' ? 'admin' : field === 'service_plan' ? 'internal' : 'active'
        await assert.rejects(db.query('update public.profiles set ' + field + ' = $1 where id = $2', [value, owner]), /permission denied/)
      }
    })

    await t.test('registro de paca es atómico y conserva categorías y daños correctos', async () => {
      const entry = { name: 'Categoría nueva', quantity: 10, damagedPieces: 2, damageReason: 'Manchas', priceLevel: 'custom', customRecommendedPrice: 150 }
      const create = (entries) => db.query('select * from public.create_bale_with_inventory(current_date, 7000, 100, 0, 4000, $1::jsonb)', [JSON.stringify(entries)])
      const before = await scalar('select count(*) as count from public.bales')
      await assert.rejects(create([entry, { ...entry, name: 'Otra categoría', customRecommendedPrice: -1 }]), /precio personalizado/)
      assert.deepEqual(await scalar('select count(*) as count from public.bales'), before)
      assert.equal(Number((await scalar("select count(*) as count from public.categories where name = 'Categoría nueva'")).count), 0)
      // Error DESPUÉS de crear la paca e inventario: el motivo supera límite DB.
      await assert.rejects(create([{ ...entry, damageReason: 'x'.repeat(1100) }]), /check constraint/)
      assert.deepEqual(await scalar('select count(*) as count from public.bales'), before)
      assert.equal(Number((await scalar("select count(*) as count from public.categories where name = 'Categoría nueva'")).count), 0)
      const created = (await create([entry])).rows[0]
      assert.equal(created.received_pieces, 10)
      const inv = await scalar('select * from public.bale_inventory where bale_id = $1', [created.id])
      assert.equal(inv.damaged_quantity, 2)
      assert.equal(inv.available_quantity, 8)
      assert.equal(Number(inv.custom_recommended_price), 150)
      const again = (await create([{ ...entry, name: ' categoría NUEVA ', damagedPieces: 0 }])).rows[0]
      assert.equal((await scalar('select category_id from public.bale_inventory where bale_id = $1', [again.id])).category_id, inv.category_id)
      await assert.rejects(create([entry, { ...entry, name: ' categoría NUEVA ' }]), /no pueden repetirse/)
    })

    await t.test('otros gastos se crean y corrigen de forma atómica sin inventar históricos', async () => {
      const categories = JSON.stringify([{ name: 'Gorras', quantity: 20, damagedPieces: 0, damageReason: '', priceLevel: 'economic', customRecommendedPrice: 0 }])
      const details = JSON.stringify([{ concept: 'Carga', amount: 100.25 }, { concept: 'Empaque', amount: 49.75 }])
      const before = Number((await scalar('select count(*) as count from public.bales')).count)
      await assert.rejects(db.query(
        'select * from public.create_bale_with_expense_details(current_date, 5000, 50, 1000, $1::jsonb, $2::jsonb)',
        [categories, JSON.stringify([{ concept: '', amount: 100 }])],
      ), /concepto/)
      assert.equal(Number((await scalar('select count(*) as count from public.bales')).count), before)

      const created = await scalar(
        'select * from public.create_bale_with_expense_details(current_date, 5000, 50, 1000, $1::jsonb, $2::jsonb)',
        [categories, details],
      )
      assert.equal(Number(created.other_expenses), 150)
      assert.deepEqual(
        (await db.query('select concept, amount from public.bale_other_expense_items where bale_id = $1 order by sort_order', [created.id])).rows
          .map((row) => ({ concept: row.concept, amount: Number(row.amount) })),
        [{ concept: 'Carga', amount: 100.25 }, { concept: 'Empaque', amount: 49.75 }],
      )
      await assert.rejects(db.query("insert into public.bale_other_expense_items(owner_id, bale_id, concept, amount, sort_order) values ($1, $2, 'Directo', 1, 3)", [owner, created.id]), /permission denied/)

      const createdInventory = await scalar('select * from public.bale_inventory where bale_id = $1', [created.id])
      const inventoryLines = JSON.stringify([{ bale_inventory_id: createdInventory.id, received_quantity: 20, price_level: 'economic', custom_recommended_price: null }])
      await db.query(
        'select * from public.update_bale_with_expense_details($1, current_date, 5100, 50, 1000, $2::jsonb, $3::jsonb, null)',
        [created.id, inventoryLines, JSON.stringify([{ concept: 'Carga corregida', amount: 125.5 }])],
      )
      assert.equal(Number((await scalar('select other_expenses from public.bales where id = $1', [created.id])).other_expenses), 125.5)
      const corrected = await scalar('select concept, amount from public.bale_other_expense_items where bale_id = $1', [created.id])
      assert.deepEqual({ concept: corrected.concept, amount: Number(corrected.amount) }, { concept: 'Carga corregida', amount: 125.5 })
      const event = await scalar("select before_state, after_state from public.business_history where entity_id = $1 and action = 'purchase_corrected'", [created.id])
      assert.equal(event.before_state.other_expense_items.length, 2)
      assert.equal(event.after_state.other_expense_items[0].concept, 'Carga corregida')
      await assert.rejects(db.query(
        'select * from public.update_bale_details_with_profit($1, current_date, 5100, 50, 999, 1000, $2::jsonb, null)',
        [created.id, inventoryLines],
      ), /desglose/)
      assert.equal(Number((await scalar('select other_expenses from public.bales where id = $1', [created.id])).other_expenses), 125.5)

      const legacy = await scalar('select * from public.create_bale_with_inventory(current_date, 1000, 0, 80, 200, $1::jsonb)', [JSON.stringify([{ name: 'Histórico', quantity: 5, damagedPieces: 0, damageReason: '', priceLevel: 'economic', customRecommendedPrice: 0 }])])
      const legacyInventory = await scalar('select * from public.bale_inventory where bale_id = $1', [legacy.id])
      const legacyLines = JSON.stringify([{ bale_inventory_id: legacyInventory.id, received_quantity: 5, price_level: 'economic', custom_recommended_price: null }])
      await db.query('select * from public.update_bale_with_expense_details($1, current_date, 1100, 0, 200, $2::jsonb, null, null)', [legacy.id, legacyLines])
      assert.equal(Number((await scalar('select other_expenses from public.bales where id = $1', [legacy.id])).other_expenses), 80)
      assert.equal(Number((await scalar('select count(*) as count from public.bale_other_expense_items where bale_id = $1', [legacy.id])).count), 0)
    })

    await t.test('otro negocio no ve ventas, clientes ni vistas, ni modifica pedidos ajenos', async () => {
      await login(other)
      for (const table of ['sales', 'sale_items', 'sale_item_allocations', 'bales', 'bale_inventory', 'bale_other_expense_items', 'bale_summary', 'bale_inventory_pricing']) {
        assert.equal(Number((await scalar('select count(*) as count from public.' + table)).count), 0, table)
      }
      assert.equal(Number((await scalar('select count(*) as count from public.customers where id = $1', [customer.id])).count), 0)
      await assert.rejects(db.query('select public.update_sale_order($1, $2::jsonb, $3)', [sale.id, items, customer.id]), /No se encontró/)
      await assert.rejects(db.query("select public.admin_update_account($1, 'active', 'internal', 'admin', null, null, null, null)", [other]), /administrador/)
    })

    await t.test('suspensión bloquea también RPC antiguas que eluden RLS', async () => {
      await db.exec('reset role')
      await db.query("update public.profiles set access_status = 'suspended' where id = $1", [owner])
      await login(owner)
      await assert.rejects(db.query("select public.register_damaged_product($1, 1, 'Daño')", [inventory.id]), /acceso activo/)
      await assert.rejects(db.query("select public.save_category_price_rules($1::jsonb)", [JSON.stringify([{ category_id: category.id, economic_price: 100, standard_price: 150, premium_price: 200 }])]), /acceso activo/)
      await assert.rejects(db.query("select public.update_bale_details_with_profit($1, current_date, 9000, 0, 0, 4000, $2::jsonb, null)",
        [bale.id, JSON.stringify([{ bale_inventory_id: inventory.id, received_quantity: 100, price_level: 'economic', custom_recommended_price: null }])]), /acceso activo/)
      assert.equal(Number((await scalar('select count(*) as count from public.bale_summary')).count), 0)
      await db.exec('reset role')
      assert.equal((await scalar('select damaged_quantity from public.bale_inventory where id = $1', [inventory.id])).damaged_quantity, 0)
      assert.equal(Number((await scalar('select purchase_cost from public.bales where id = $1', [bale.id])).purchase_cost), 8550)
    })

    await t.test('anon no ejecuta funciones privilegiadas; autenticado sin JWT no refresca todos los negocios', async () => {
      await login(null, 'anon')
      await assert.rejects(db.exec('select public.refresh_daily_summaries(current_date)'), /permission denied/)
      await assert.rejects(db.query("select public.register_damaged_product($1, 1, 'Daño')", [inventory.id]), /permission denied/)
      await login(null)
      await assert.rejects(db.exec('select public.refresh_daily_summaries(current_date)'), /iniciar sesión/)
      await db.exec('reset role')
      const exposed = await scalar(`select count(*) as count from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')`)
      assert.equal(Number(exposed.count), 0)
    })
  } finally { await db.close() }
})

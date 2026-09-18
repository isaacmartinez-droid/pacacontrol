import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// PostgreSQL real en memoria: no conecta ni modifica Supabase de produccion.
for (const sessionTimezone of ['UTC', 'America/Guatemala']) {
test(`archivos, correcciones y gastos mantienen pagos, inventario y aislamiento (${sessionTimezone})`, async (t) => {
  const db = new PGlite()
  const owner = '11111111-1111-4111-8111-111111111111'
  const otherOwner = '22222222-2222-4222-8222-222222222222'
  const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0]
  let bale, inventory, category, customer, sale
  const items = (quantity) => JSON.stringify([{ category_id: category.id, bale_inventory_id: inventory.id, price_lines: [{ quantity, unit_price: 100 }] }])

  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `)
    const directory = new URL('../supabase/migrations/', import.meta.url)
    const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()
    for (const name of files) {
      const sql = (await readFile(new URL(name, directory), 'utf8')).replace('create extension if not exists pgcrypto;', '')
      // gen_random_uuid es nativo de PostgreSQL; no hace falta la extension.
      const permissions = async () => (await db.query(`select p.oid, p.proowner, p.proacl::text as acl, p.prosecdef
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prokind = 'f' order by p.oid`)).rows
      const before = name === '20260916020000_timezone_safe_business_timestamps.sql' ? await permissions() : null
      try {
        await db.exec(sql)
        if (before) assert.deepEqual(await permissions(), before)
      }
      catch (error) { throw new Error('Fallo en migracion ' + name + ': ' + error.message, { cause: error }) }
    }
    await db.query("select set_config('TimeZone', $1, false)", [sessionTimezone])
    await db.query('insert into auth.users (id) values ($1), ($2)', [owner, otherOwner])
    // Las cuentas nuevas requieren aprobación; fixtures habilitados por SQL de servicio.
    await db.exec("update public.profiles set access_status = 'active'")
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner])
    category = await scalar("select id from public.categories where owner_id = $1 and slug = 'pants'", [owner])
    customer = await scalar("insert into public.customers (name) values ('Clienta de prueba') returning id")
    bale = await scalar('insert into public.bales (purchase_cost, received_pieces, target_profit_amount) values (8550, 150, 4000) returning id')
    inventory = await scalar('insert into public.bale_inventory (bale_id, category_id, received_quantity) values ($1, $2, 150) returning id', [bale.id, category.id])
    sale = await scalar("select * from public.register_sale_with_items($1::jsonb, 'cash', $2::uuid)", [items(8), customer.id])
    await db.query("select public.update_sale_delivery_status($1, 'delivered')", [sale.id])

    await t.test('edición de gastos auditada y arqueo seguro con fotografía inmutable', async () => {
      await db.exec('begin')
      const rejects = async (sql, params, pattern) => {
        await db.exec('savepoint rejected_operation')
        await assert.rejects(db.query(sql, params), pattern)
        await db.exec('rollback to savepoint rejected_operation; release savepoint rejected_operation')
      }
      try {
        const date = (await scalar("select ((now() at time zone 'America/Guatemala')::date)::text as date")).date
        const unknown = await scalar("insert into public.expenses(concept, amount, expense_date) values ('Bolsas',200,$1::date) returning *", [date])
        const args = [date, date, 300, 50, 100, 900, 'Retiros revisados']
        await rejects('select * from public.save_cash_reconciliation($1::date,$2::date,$3,$4,$5,$6,$7)', [date, date, -1, 0, 0, 0, null], /montos/)
        await rejects('select * from public.save_cash_reconciliation($1::date,$2::date,$3,$4,$5,$6,$7)', [date, date, 'NaN', 0, 0, 0, null], /montos/)
        await rejects('select * from public.save_cash_reconciliation($1::date,$2::date,$3,$4,$5,$6,$7)', [date, '2099-01-01', 0, 0, 0, 0, null], /período válido/)
        await rejects('select * from public.save_cash_reconciliation($1::date,$2::date,$3,$4,$5,$6,$7)', args, /medio de pago/)
        const expense = await scalar("select * from public.update_business_expense($1,'Bolsas corregidas',150,$2::date,'supplies',null,'Corrección','cash')", [unknown.id, date])
        assert.equal(Number(expense.amount), 150)
        assert.equal(expense.id, unknown.id)
        const audit = await scalar("select * from public.business_history where entity_id=$1 and action='expense_corrected'", [expense.id])
        assert.equal(audit.before_state.amount, 200)
        assert.equal(audit.after_state.amount, 150)
        assert.equal(Number((await scalar('select expenses_total from public.daily_summaries where owner_id=$1 and summary_date=$2::date', [owner,date])).expenses_total), 150)
        const saved = await scalar('select * from public.save_cash_reconciliation($1::date,$2::date,$3,$4,$5,$6,$7)', args)
        assert.equal(Number(saved.cash_collected), 800)
        assert.equal(Number(saved.expected_amount), 900)
        assert.equal(Number(saved.difference), 0)
        await db.query("select public.update_business_expense($1,'Bolsas',180,$2::date,'supplies',null,null,'transfer')", [expense.id,date])
        assert.equal(Number((await scalar('select cash_expenses from public.cash_reconciliations where id=$1',[saved.id])).cash_expenses),150)
        const another = await scalar("select * from public.register_sale_with_items($1::jsonb,'transfer',$2)",[items(1),customer.id])
        await db.query('select public.update_sale_order($1,$2::jsonb,$3)',[another.id,items(2),customer.id])
        await db.query("select public.complete_sale_payment($1,'cash')",[another.id])
        await db.query('select public.update_sale_order($1,$2::jsonb,$3)',[another.id,items(3),customer.id])
        await db.query("select public.complete_sale_payment($1,'cash')",[another.id])
        assert.equal(Number((await scalar('select * from public.save_cash_reconciliation($1::date,$2::date,$3,$4,$5,$6,$7)',args)).cash_collected),1000)
        await db.exec('set local role authenticated')
        await rejects("insert into public.cash_reconciliations(owner_id,start_date,end_date,opening_amount,cash_collected,cash_expenses,other_income,other_outflows,counted_amount) values ($1,$2::date,$2::date,0,0,0,0,0,0)",[owner,date], /permission denied/)
        await rejects('update public.cash_reconciliations set counted_amount=0', [], /permission denied/)
        await db.query("select set_config('request.jwt.claim.sub',$1,true)",[otherOwner])
        assert.equal((await db.query('select * from public.cash_reconciliations')).rows.length,0)
        await rejects("select public.update_business_expense($1,'Ajeno',100,$2::date,'other')",[expense.id,date], /no te pertenece/)
        await db.exec('reset role')
        await db.query('update public.profiles set access_status=\'suspended\' where id=$1',[otherOwner])
        await rejects('select public.save_cash_reconciliation($1::date,$2::date,$3,$4,$5,$6,$7)',args, /acceso activo/)
      } finally { await db.exec('rollback') }
    })

    await t.test('defaults y RPC guardan el instante real y la fecha comercial', async () => {
      await db.exec('begin')
      try {
        const order = await scalar("select * from public.register_sale_with_items($1::jsonb, 'cash', $2::uuid)", [items(1), customer.id])
        const timestamps = await scalar(`select
          extract(epoch from sold_at - now())::float8 as sold_shift,
          extract(epoch from first_payment_at - now())::float8 as paid_shift,
          extract(epoch from created_at - now())::float8 as created_shift,
          extract(epoch from updated_at - now())::float8 as updated_shift
          from public.sales where id = $1`, [order.id])
        assert.deepEqual(timestamps, { sold_shift: 0, paid_shift: 0, created_shift: 0, updated_shift: 0 })
        await db.query('select public.update_sale_order($1, $2::jsonb, $3)', [order.id, items(2), customer.id])
        await db.query("select public.complete_sale_payment($1, 'transfer')", [order.id])
        await db.query('select public.update_sale_order($1, $2::jsonb, $3)', [order.id, items(3), customer.id])
        await db.query("select public.complete_sale_payment($1, 'card')", [order.id])
        const payments = await scalar(`select
          extract(epoch from second_payment_at - now())::float8 as second_shift,
          extract(epoch from last_additional_payment_at - now())::float8 as extra_shift,
          (select extract(epoch from paid_at - now())::float8
            from public.sale_additional_payments where sale_id = s.id) as record_shift
          from public.sales s where id = $1`, [order.id])
        assert.deepEqual(payments, { second_shift: 0, extra_shift: 0, record_shift: 0 })
        const expense = await scalar("insert into public.expenses(concept, amount) values ('Prueba horaria', 1) returning id")
        const dates = await scalar(`select expense_date = (now() at time zone 'America/Guatemala')::date as correct_date,
          extract(epoch from created_at - now())::float8 as created_shift
          from public.expenses where id = $1`, [expense.id])
        assert.deepEqual(dates, { correct_date: true, created_shift: 0 })
        const defaultBale = await scalar('insert into public.bales(purchase_cost, received_pieces) values (100, 1) returning purchase_date')
        assert.deepEqual(defaultBale.purchase_date, (await scalar("select (now() at time zone 'America/Guatemala')::date as date")).date)
        // UTC ya es el día siguiente, pero el cierre pertenece al día local.
        const boundary = await scalar(`select
          (('2026-09-17T04:00:00Z'::timestamptz at time zone 'America/Guatemala')::date)::text as night,
          (('2026-09-17T06:00:00Z'::timestamptz at time zone 'America/Guatemala')::date)::text as midnight`)
        assert.deepEqual(boundary, { night: '2026-09-16', midnight: '2026-09-17' })
        const damage = await scalar("select * from public.register_damaged_product($1, 1, 'Prueba horaria')", [inventory.id])
        assert.equal((await scalar('select extract(epoch from reported_at - now())::float8 as shift from public.damaged_products where id = $1', [damage.id])).shift, 0)
        await db.query('select public.set_bale_archived($1, true)', [bale.id])
        assert.equal((await scalar('select extract(epoch from archived_at - now())::float8 as shift from public.bales where id = $1', [bale.id])).shift, 0)
        const report = await scalar("select extract(epoch from generated_at - now())::float8 as shift from public.daily_summaries where owner_id = $1 and summary_date = (now() at time zone 'America/Guatemala')::date", [owner])
        assert.equal(report.shift, 0)
      } finally { await db.exec('rollback') }
    })

    await t.test('corrección horaria es repetible y preserva permisos, funciones e historial', async () => {
      const snapshot = async () => (await db.query(`select p.oid, p.proname, p.proowner,
        p.proacl::text as acl, p.prosecdef, pg_get_functiondef(p.oid) as definition
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prokind = 'f' order by p.oid`)).rows
      const before = await snapshot()
      const historyBefore = (await db.query('select * from public.sales order by id')).rows
      await db.exec(await readFile(new URL('20260916020000_timezone_safe_business_timestamps.sql', directory), 'utf8'))
      assert.deepEqual(await snapshot(), before)
      assert.deepEqual((await db.query('select * from public.sales order by id')).rows, historyBefore)
      assert.equal(before.filter((f) => /timezone\(\s*'utc'(?:::text)?\s*,\s*now\(\)/i.test(f.definition)).length, 0)
    })

    await t.test('Nicaragua cambia defaults y funciones sin mover datos ni permisos', async () => {
      const permissions = async () => (await db.query(`select p.oid, p.proowner, p.proacl::text as acl, p.prosecdef
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' order by p.oid`)).rows
      const before = await permissions()
      const rows = (await db.query('select * from public.sales order by id')).rows
      const sql = await readFile(new URL('20260917020000_nicaragua_business_timezone.sql', directory), 'utf8')
      await db.exec(sql)
      await db.exec(sql)
      assert.deepEqual(await permissions(), before)
      assert.deepEqual((await db.query('select * from public.sales order by id')).rows, rows)
      assert.equal(Number((await scalar(`select count(*) as count from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.prokind='f' and strpos(pg_get_functiondef(p.oid),'America/Guatemala')>0`)).count), 0)
      const defaults = (await db.query(`select column_default from information_schema.columns where table_schema='public'
        and (table_name='bales' and column_name='purchase_date' or table_name='expenses' and column_name='expense_date')`)).rows
      assert.equal(defaults.length, 2)
      for (const row of defaults) assert.match(row.column_default, /America\/Managua/)
    })

    await t.test('cierres separan cobros y gastos al pasar medianoche de Nicaragua', async () => {
      await db.exec('begin')
      try {
        // Fechas fijas y distintas de las fixtures actuales: no depende de la hora del test.
        for (const [instant, quantity, date, expense] of [
          ['2031-04-13T04:00:00Z', 1, '2031-04-12', 10],
          ['2031-04-13T06:00:00Z', 2, '2031-04-13', 20],
        ]) {
          const order = await scalar("select * from public.register_sale_with_items($1::jsonb, 'cash', $2::uuid, 'pickup', $3::timestamptz)", [items(quantity), customer.id, instant])
          // Simula un cobro histórico con un instante explícito, no la hora de ejecución.
          await db.query('update public.sales set first_payment_at = $2::timestamptz where id = $1', [order.id, instant])
          await db.query("insert into public.expenses(concept, amount, expense_date) values ('Cierre fijo', $1, $2::date)", [expense, date])
          await db.query('select public.refresh_daily_summaries($1::date)', [date])
          const report = await scalar('select sales_total, orders_total, expenses_total from public.daily_summaries where owner_id = $1 and summary_date = $2::date', [owner, date])
          assert.deepEqual(Object.fromEntries(Object.entries(report).map(([k, v]) => [k, Number(v)])), {
            sales_total: quantity * 100, orders_total: quantity * 100, expenses_total: expense,
          })
        }
        await db.exec("update public.expenses set expense_date = '2031-04-13' where expense_date = '2031-04-12'")
        const reports = (await db.query("select expenses_total from public.daily_summaries where owner_id = $1 and summary_date in ('2031-04-12', '2031-04-13') order by summary_date", [owner])).rows
        assert.deepEqual(reports.map((r) => Number(r.expenses_total)), [0, 30])
      } finally { await db.exec('rollback') }
    })

    await t.test('corrige pedido entregado de 800 a 1000 conservando pagos y bitacora completa', async () => {
      await db.query('select public.update_sale_order($1, $2::jsonb, $3)', [sale.id, items(10), customer.id])
      const order = await scalar('select total, paid_amount, payment_status, delivery_status from public.sales where id = $1', [sale.id])
      assert.equal(Number(order.total), 1000)
      assert.equal(Number(order.paid_amount), 800)
      assert.equal(order.payment_status, 'partial')
      assert.equal(order.delivery_status, 'delivered')
      assert.equal((await scalar('select sold_quantity from public.bale_inventory where id = $1', [inventory.id])).sold_quantity, 10)
      const history = await scalar("select before_state, after_state from public.business_history where entity_id = $1 and action = 'order_corrected'", [sale.id])
      assert.equal(Number(history.before_state.order.total), 800)
      assert.equal(history.before_state.items[0].quantity, 8)
      assert.equal(history.after_state.items[0].quantity, 10)
      assert.equal(history.after_state.items[0].category_name, 'Pantalones')
      assert.equal(Number((await scalar('select total_spent from public.customer_summary where id = $1', [customer.id])).total_spent), 1000)
    })

    await t.test('permite nuevo saldo despues del segundo pago sin sobrescribirlo', async () => {
      await db.query("select public.complete_sale_payment($1, 'transfer')", [sale.id])
      await db.query('select public.update_sale_order($1, $2::jsonb, $3)', [sale.id, items(12), customer.id])
      await db.query("select public.complete_sale_payment($1, 'card')", [sale.id])
      const order = await scalar('select * from public.sales where id = $1', [sale.id])
      assert.equal(Number(order.first_payment_amount), 800)
      assert.equal(Number(order.second_payment_amount), 200)
      assert.equal(Number(order.additional_paid_amount), 200)
      assert.equal(Number(order.paid_amount), 1200)
      assert.equal(order.payment_status, 'paid')
      const extra = await scalar('select * from public.sale_additional_payments where sale_id = $1', [sale.id])
      assert.equal(Number(extra.amount), 200)
      assert.equal(extra.method, 'card')
      const report = await scalar('select * from public.daily_summaries where owner_id = $1 order by summary_date desc limit 1', [owner])
      assert.equal(Number(report.sales_total), 1200)
      assert.equal(Number(report.cash_total), 800)
      assert.equal(Number(report.transfer_total), 200)
      assert.equal(Number(report.card_total), 200)
    })

    await t.test('rechaza bajar total bajo lo pagado y revierte piezas, articulos e historial', async () => {
      const before = (await db.query('select * from public.sale_items where sale_id = $1', [sale.id])).rows
      const historyCount = await scalar('select count(*) as count from public.business_history')
      await assert.rejects(db.query('select public.update_sale_order($1, $2::jsonb, $3)', [sale.id, items(5), customer.id]), /menor que lo ya pagado/)
      assert.deepEqual((await db.query('select * from public.sale_items where sale_id = $1', [sale.id])).rows, before)
      assert.equal((await scalar('select sold_quantity from public.bale_inventory where id = $1', [inventory.id])).sold_quantity, 12)
      assert.deepEqual(await scalar('select count(*) as count from public.business_history'), historyCount)
    })

    await t.test('gastos pagados actualizan cierre, metas mensuales no son gastos', async () => {
      await db.query("insert into public.expenses (concept, category, amount, bale_id) values ('Bolsas', 'supplies', 200, $1)", [bale.id])
      await db.exec("insert into public.monthly_expense_commitments (concept, category, monthly_amount) values ('Luz', 'utilities', 500)")
      const report = await scalar("select expenses_total, net_result, estimated_profit from public.daily_summaries where owner_id = $1 and summary_date = (now() at time zone 'America/Guatemala')::date", [owner])
      assert.equal(Number(report.expenses_total), 200)
      assert.equal(Number(report.net_result), Number(report.estimated_profit) - 200)
    })

    await t.test('archiva sin borrar ventas, pagos, gastos o inventario y bloquea operaciones nuevas', async () => {
      await db.query('select public.set_bale_archived($1, true)', [bale.id])
      assert.equal((await scalar('select is_active from public.bale_inventory where id = $1', [inventory.id])).is_active, false)
      assert.ok((await scalar('select archived_at from public.bale_summary where id = $1', [bale.id])).archived_at)
      assert.equal((await scalar('select available_pieces from public.inventory_summary where category_id = $1', [category.id])).available_pieces, 0)
      assert.equal(Number((await scalar('select total from public.sales where id = $1', [sale.id])).total), 1200)
      assert.equal(Number((await scalar('select count(*) as count from public.expenses')).count), 1)
      await assert.rejects(db.query("select public.register_sale_with_items($1::jsonb, 'cash', $2)", [items(1), customer.id]), /archivada/)
      await assert.rejects(db.query("select public.register_damaged_product($1, 1, 'Prueba')", [inventory.id]), /archivada|Reactiva/)
      assert.equal(Number((await scalar('select count(*) as count from public.sales')).count), 1)
      assert.equal((await scalar('select sold_quantity from public.bale_inventory where id = $1', [inventory.id])).sold_quantity, 12)
      await assert.rejects(db.query('select public.update_bale_details_with_profit($1, current_date, 9000, 0, 0, 4000, $2::jsonb)', [bale.id, JSON.stringify([{ bale_inventory_id: inventory.id, received_quantity: 150, price_level: 'economic', custom_recommended_price: null }])]), /Reactiva/)
      assert.equal(Number((await scalar('select purchase_cost from public.bales where id = $1', [bale.id])).purchase_cost), 8550)
    })

    await t.test('reactiva y la funcion anterior archiva en vez de borrar', async () => {
      await db.query('select public.set_bale_archived($1, false)', [bale.id])
      assert.equal((await scalar('select available_pieces from public.inventory_summary where category_id = $1', [category.id])).available_pieces, 138)
      await db.query('select public.delete_empty_bale($1)', [bale.id])
      assert.ok((await scalar('select archived_at from public.bales where id = $1', [bale.id])).archived_at)
    })

    await t.test('otro usuario no puede archivar ni leer historial o presupuestos ajenos', async () => {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [otherOwner])
      await db.exec('set role authenticated')
      await assert.rejects(db.query('select public.set_bale_archived($1, false)', [bale.id]), /No se encontro/)
      assert.equal(Number((await scalar('select count(*) as count from public.business_history')).count), 0)
      assert.equal(Number((await scalar('select count(*) as count from public.monthly_expense_commitments')).count), 0)
      await assert.rejects(db.query('delete from public.bales where id = $1', [bale.id]), /permission denied/)
      await db.exec('reset role')
    })

    await t.test('gasto no puede enlazar una paca ajena y una cuenta suspendida no puede operar', async () => {
      await assert.rejects(db.query("insert into public.expenses (concept, amount, bale_id) values ('Gasto ajeno', 10, $1)", [bale.id]), /no pertenece/)
      await db.query("update public.profiles set access_status = 'suspended' where id = $1", [otherOwner])
      await db.exec('set role authenticated')
      await assert.rejects(db.query('select public.set_bale_archived($1, false)', [bale.id]), /acceso activo/)
      await assert.rejects(db.query("select public.complete_sale_payment($1, 'cash')", [sale.id]), /acceso activo/)
      await db.exec('reset role')
    })
  } finally { await db.close() }
})
}

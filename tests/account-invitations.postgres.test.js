import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('invitaciones crean propietarios activos sin exponer privilegios administrativos', async (t) => {
  const db = new PGlite()
  const admin = '11111111-1111-4111-8111-111111111111'
  const customer = '22222222-2222-4222-8222-222222222222'
  const activated = '33333333-3333-4333-8333-333333333333'
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
    await db.query(`insert into auth.users(id, email) values
      ($1, 'admin.sistema@staging.supabase.co'), ($2, 'cliente.normal@staging.supabase.co')`, [admin, customer])
    await db.query("update public.profiles set access_status='active', service_plan='internal', account_role='admin' where id=$1", [admin])
    await db.query("update public.profiles set access_status='active' where id=$1", [customer])

    await t.test('un propietario normal no puede crear ni listar invitaciones', async () => {
      await login(customer)
      await assert.rejects(db.query(`select * from public.admin_create_account_invitation(
        'Tienda', 'Cliente', 'cliente.nuevo', null, null, 'pilot_free', 30, 7, '2026-09-11', '2026-09-11')`), /administrador/)
      await assert.rejects(db.exec('select * from public.admin_list_account_invitations()'), /administrador/)
      await assert.rejects(db.exec("select * from public.claim_account_invitation('digest', gen_random_uuid())"), /permission denied/)
    })

    let token
    let digest
    let attempt
    await t.test('el administrador recibe el secreto una vez y la base conserva solo su huella', async () => {
      await login(admin)
      const invitation = await scalar(`select * from public.admin_create_account_invitation(
        'Variedades Sol', 'Ana Pérez', 'ana.perez', 'ana@example.com', '8888-8888',
        'paid_monthly', 14, 7, '2026-09-11', '2026-09-11')`)
      token = invitation.invitation_token
      assert.match(token, /^[0-9a-f]{64}$/)
      await db.exec('reset role')
      const stored = await scalar('select code_digest, code_hint, status from public.account_invitations')
      digest = stored.code_digest
      assert.match(digest, /^[0-9a-f]{64}$/)
      assert.notEqual(stored.code_digest, token)
      assert.equal(stored.code_hint, token.slice(-8))
      assert.equal(stored.status, 'pending')
      await login(admin)
      const listed = await scalar('select username, status from public.admin_list_account_invitations()')
      assert.deepEqual(listed, { username: 'ana.perez', status: 'pending' })
    })

    await t.test('service_role reclama una vez y completa una cuenta de negocio pendiente', async () => {
      await login(null, 'service_role')
      assert.equal((await scalar('select username from public.preview_account_invitation($1)', [digest])).username, 'ana.perez')
      const abandonedAttempt = '55555555-5555-4555-8555-555555555555'
      assert.equal((await scalar('select username from public.claim_account_invitation($1, $2)', [digest, abandonedAttempt])).username, 'ana.perez')
      await db.exec('reset role')
      await db.exec("update public.account_invitations set processing_started_at = now() - interval '16 minutes'")
      await login(null, 'service_role')
      assert.equal((await scalar('select username from public.preview_account_invitation($1)', [digest])).username, 'ana.perez')
      attempt = '44444444-4444-4444-8444-444444444444'
      const claimed = await scalar('select username, service_plan from public.claim_account_invitation($1, $2)', [digest, attempt])
      assert.deepEqual(claimed, { username: 'ana.perez', service_plan: 'paid_monthly' })
      assert.equal((await db.query('select * from public.claim_account_invitation($1, gen_random_uuid())', [digest])).rows.length, 0)

      await db.exec('reset role')
      await db.query("insert into auth.users(id, email, raw_user_meta_data) values ($1, 'ana.perez@staging.supabase.co', $2::jsonb)", [activated, JSON.stringify({ display_name: 'Variedades Sol' })])
      await login(null, 'service_role')
      assert.equal((await scalar('select public.complete_account_invitation_activation($1, $2) as completed', [attempt, activated])).completed, true)
      await db.exec('reset role')
      const profile = await scalar('select display_name, access_status, service_plan, account_role from public.profiles where id=$1', [activated])
      assert.deepEqual(profile, { display_name: 'Variedades Sol', access_status: 'active', service_plan: 'paid_monthly', account_role: 'owner' })
      const business = await scalar('select business_name, onboarding_status, onboarding_step from public.business_profiles where owner_id=$1', [activated])
      assert.deepEqual(business, { business_name: 'Variedades Sol', onboarding_status: 'pending', onboarding_step: 0 })
      assert.equal((await scalar('select status from public.account_invitations')).status, 'redeemed')
      assert.equal((await db.query('select * from public.preview_account_invitation($1)', [digest])).rows.length, 0)
    })

    await t.test('una segunda activación no puede reclamar el mismo token', async () => {
      await login(null, 'service_role')
      assert.equal((await db.query('select * from public.claim_account_invitation($1, gen_random_uuid())', [digest])).rows.length, 0)
    })
  } finally {
    await db.close()
  }
})

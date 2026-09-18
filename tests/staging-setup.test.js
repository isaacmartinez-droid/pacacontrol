import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { validateStagingEnvironment } from '../vite.config.js'

const installerUrl = new URL('../supabase/setup/install_staging.sql', import.meta.url)
const installer = async () => (await readFile(installerUrl, 'utf8')).replace('create extension if not exists pgcrypto;', '')
const auditUrl = new URL('../supabase/setup/audit_hito0.sql', import.meta.url)
const audit = async () => readFile(auditUrl, 'utf8')
async function database() {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`)
  return db
}

test('staging exige URL separada y rechaza sustitución por la URL de clientes', () => {
  // No depende de archivos .env privados: también funciona en CI/checkout limpio.
  const env = { VITE_STAGING_PROJECT_REF: 'staging-fixture',
    VITE_SUPABASE_URL: 'https://staging-fixture.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture_not_real' }
  const production = 'https://production-fixture.supabase.co'
  assert.doesNotThrow(() => validateStagingEnvironment(env, production))
  assert.throws(() => validateStagingEnvironment({ ...env, VITE_SUPABASE_URL: production }, production), /proyecto de pruebas/)
  assert.throws(() => validateStagingEnvironment(env, env.VITE_SUPABASE_URL), /proyecto de pruebas/)
  assert.throws(() => validateStagingEnvironment({}, production), /Configura/)
  assert.throws(() => validateStagingEnvironment({ ...env, VITE_SUPABASE_URL: 'http://staging-fixture.supabase.co' }, production), /proyecto de pruebas/)
})

test('instalador crea base completa y rechaza ejecutarse de nuevo sin tocar datos', async () => {
  const db = await database()
  try {
    const sql = await installer()
    await db.exec(sql)
    await db.exec(await audit())
    const { rows } = await db.query("select to_regprocedure('public.create_bale_with_inventory(date,numeric,numeric,numeric,numeric,jsonb)')::text as rpc, to_regprocedure('public.create_bale_with_expense_details(date,numeric,numeric,numeric,jsonb,jsonb)')::text as detailed_rpc, to_regclass('public.bale_other_expense_items')::text as detail_table, to_regclass('public.business_profiles')::text as profile_table, to_regprocedure('public.complete_business_onboarding(text,text,text,boolean,text,text[],text[],text)')::text as onboarding_rpc")
    assert.ok(rows[0].rpc)
    assert.ok(rows[0].detailed_rpc)
    assert.equal(rows[0].detail_table, 'bale_other_expense_items')
    assert.equal(rows[0].profile_table, 'business_profiles')
    assert.ok(rows[0].onboarding_rpc)
    const defaults = (await db.query("select column_default from information_schema.columns where table_schema='public' and table_name='sales' and column_name='sold_at'")).rows
    assert.equal(defaults[0].column_default, 'now()')
    await assert.rejects(db.exec(sql), /base ya tiene objetos/)
    await db.exec('rollback')
    assert.equal(Number((await db.query('select count(*) as count from public.profiles')).rows[0].count), 0)
  } finally { await db.close() }
})

test('fallo al final de la instalación revierte todas las tablas de la app', async () => {
  const db = await database()
  try {
    const sql = (await installer()).replace(/\ncommit;\s*$/, '\nselect * from public.staging_failure_sentinel;\ncommit;')
    await assert.rejects(db.exec(sql), /staging_failure_sentinel/)
    await db.exec('rollback')
    assert.equal((await db.query("select to_regclass('public.profiles')::text as table_name")).rows[0].table_name, null)
    assert.equal((await db.query("select to_regclass('public.sales')::text as table_name")).rows[0].table_name, null)
    assert.equal((await db.query("select to_regclass('auth.users')::text as table_name")).rows[0].table_name, 'auth.users')
  } finally { await db.close() }
})

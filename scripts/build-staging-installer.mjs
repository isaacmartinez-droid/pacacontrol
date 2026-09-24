import { readFile, readdir, writeFile } from 'node:fs/promises'

const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url)
const outputUrl = new URL('../supabase/setup/install_staging.sql', import.meta.url)
const names = (await readdir(migrationsDirectory)).filter((name) => name.endsWith('.sql')).sort()

const header = `-- SOLO PARA Sistema-Pacas-Pruebas (zijfywqastacydmuqswv).
-- Instalación inicial generada desde ${names.length} migraciones. NO ejecutar en clientes.
-- Una sola transacción: cualquier fallo revierte toda la instalación.
begin;
do $staging_guard$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('profiles', 'categories', 'bales', 'bale_inventory',
        'customers', 'sales', 'sale_items', 'sale_item_allocations',
        'expenses', 'damaged_products', 'daily_summaries', 'business_settings',
        'business_history', 'sale_additional_payments', 'push_subscriptions',
        'push_dispatch_state', 'monthly_expense_commitments', 'admin_account_events',
        'cash_reconciliations', 'bale_other_expense_items',
        'business_templates', 'business_profiles', 'account_invitations')
  ) then
    raise exception 'Instalación cancelada: la base ya tiene objetos de la app. Usa solo el proyecto de pruebas vacío.';
  end if;
end;
$staging_guard$;
`

const sections = []
for (const name of names) {
  let sql = await readFile(new URL(name, migrationsDirectory), 'utf8')
  sql = sql.replace(/^\uFEFF/, '').replace(/^begin;\s*/im, '').replace(/\s*commit;\s*$/i, '').trim()
  sections.push(`-- Migración: ${name}\n${sql}`)
}

await writeFile(outputUrl, `${header}\n${sections.join('\n\n')}\ncommit;\n`, 'utf8')
console.log(`Generado install_staging.sql con ${names.length} migraciones.`)

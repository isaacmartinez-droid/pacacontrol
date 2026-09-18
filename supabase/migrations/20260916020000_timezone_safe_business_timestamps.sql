-- Guarda instantes reales, sin depender del TimeZone de la sesión.
-- No desplaza fechas históricas ni recalcula cierres existentes.
begin;

do $$
declare
  v_column record;
  v_function record;
  v_definition text;
  v_pattern constant text := $pattern$timezone\(\s*'utc'(::text)?\s*,\s*now\(\)\s*\)$pattern$;
begin
  -- Solo defaults de timestamptz cuyo valor completo es la conversión UTC.
  for v_column in
    select c.relname, a.attname
    from pg_attrdef d
    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    join pg_class c on c.oid = d.adrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and a.atttypid = 'timestamptz'::regtype
      and pg_get_expr(d.adbin, d.adrelid) ~* ('^' || v_pattern || '$')
  loop
    execute format('alter table public.%I alter column %I set default now()',
      v_column.relname, v_column.attname);
  end loop;

  -- Se conserva la versión instalada (archivo, pagos e historial incluidos).
  -- CREATE OR REPLACE preserva identidad, propietario y permisos de ejecución.
  -- Lista cerrada: no modifica funciones de extensiones ni funciones ajenas.
  for v_function in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public' and p.prokind = 'f'
      and l.lanname in ('sql', 'plpgsql')
      and p.proname in (
        'set_updated_at', 'create_profile_and_categories', 'accept_legal_terms',
        'admin_update_account', 'register_sale', 'register_damaged_product',
        'register_sale_with_prices', 'register_sale_with_items',
        'complete_sale_payment', 'set_bale_archived', 'refresh_daily_summaries'
      )
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    if v_definition ~* v_pattern then
      execute regexp_replace(v_definition, v_pattern, 'now()', 'gi');
    end if;
  end loop;
end;
$$;

-- Las fechas comerciales no dependen de si la conexión trabaja en UTC.
alter table public.bales alter column purchase_date
  set default ((now() at time zone 'America/Guatemala')::date);
alter table public.expenses alter column expense_date
  set default ((now() at time zone 'America/Guatemala')::date);

notify pgrst, 'reload schema';
commit;

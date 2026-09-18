-- Fase 1: defensa en profundidad también para RPC antiguas SECURITY DEFINER.
-- No suspende usuarios existentes ni borra datos.
begin;

-- Una llamada directa a Auth no debe habilitar una nueva cuenta de negocio.
-- El administrador debe aprobarla; la fase de códigos sustituirá este flujo.
alter table public.profiles alter column access_status set default 'suspended';

create or replace function public.enforce_business_write_access()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_row jsonb;
begin
  if v_user is null then
    -- SQL Editor, migraciones y cron de servicio no llevan identidad de usuario.
    -- Un cliente REST autenticado/anónimo sin identidad NO es un servicio.
    if current_setting('role', true) in ('anon', 'authenticated') then
      raise exception 'Debes iniciar sesión.' using errcode = '42501';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if not public.current_account_is_active() then
    raise exception 'Esta cuenta no tiene acceso activo.' using errcode = '42501';
  end if;
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if v_row ? 'owner_id' and (v_row ->> 'owner_id')::uuid is distinct from v_user then
    raise exception 'El registro no pertenece a esta cuenta.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and to_jsonb(old) ? 'owner_id'
    and (to_jsonb(old) ->> 'owner_id') is distinct from (to_jsonb(new) ->> 'owner_id') then
    raise exception 'No se puede cambiar el propietario de un registro.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke execute on function public.enforce_business_write_access() from public, anon, authenticated;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'categories', 'bales', 'bale_inventory', 'customers', 'sales', 'sale_items',
    'sale_item_allocations', 'expenses', 'damaged_products', 'daily_summaries',
    'business_settings', 'monthly_expense_commitments', 'sale_additional_payments',
    'business_history', 'push_subscriptions'
  ] loop
    execute format('drop trigger if exists business_write_access on public.%I', v_table);
    execute format('create trigger business_write_access before insert or update or delete on public.%I for each row execute function public.enforce_business_write_access()', v_table);
  end loop;
end $$;

-- La política original de inventario valida la paca, pero no su categoría.
-- Comprueba también vínculos entre pedidos, prendas y sus asignaciones.
create or replace function public.enforce_business_record_links()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_link_owner uuid;
begin
  if tg_table_name = 'bale_inventory' then
    select owner_id into v_owner from public.bales where id = new.bale_id;
    select owner_id into v_link_owner from public.categories where id = new.category_id;
  elsif tg_table_name = 'sales' then
    if new.customer_id is null then return new; end if;
    v_owner := new.owner_id;
    select owner_id into v_link_owner from public.customers where id = new.customer_id;
  elsif tg_table_name = 'sale_items' then
    select owner_id into v_owner from public.sales where id = new.sale_id;
    select owner_id into v_link_owner from public.categories where id = new.category_id;
  elsif tg_table_name = 'sale_item_allocations' then
    select s.owner_id into v_owner from public.sale_items si
      join public.sales s on s.id = si.sale_id where si.id = new.sale_item_id;
    select b.owner_id into v_link_owner from public.bale_inventory bi
      join public.bales b on b.id = bi.bale_id where bi.id = new.bale_inventory_id;
    if not exists (select 1 from public.sale_items si join public.bale_inventory bi
      on bi.category_id = si.category_id where si.id = new.sale_item_id and bi.id = new.bale_inventory_id) then
      raise exception 'La categoría no corresponde al inventario.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'damaged_products' then
    v_owner := new.owner_id;
    select b.owner_id into v_link_owner from public.bale_inventory bi
      join public.bales b on b.id = bi.bale_id where bi.id = new.bale_inventory_id;
  elsif tg_table_name = 'sale_additional_payments' then
    v_owner := new.owner_id;
    select owner_id into v_link_owner from public.sales where id = new.sale_id;
  end if;
  if v_owner is null or v_link_owner is distinct from v_owner then
    raise exception 'Los registros relacionados deben pertenecer al mismo negocio.' using errcode = '23514';
  end if;
  if auth.uid() is not null and v_owner is distinct from auth.uid() then
    raise exception 'El registro no pertenece a esta cuenta.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_business_record_links() from public, anon, authenticated;

do $$
declare v_table text; v_function record;
begin
  foreach v_table in array array['bale_inventory', 'sales', 'sale_items', 'sale_item_allocations', 'damaged_products', 'sale_additional_payments'] loop
    execute format('drop trigger if exists business_record_links on public.%I', v_table);
    execute format('create trigger business_record_links before insert or update on public.%I for each row execute function public.enforce_business_record_links()', v_table);
  end loop;
  -- Se preservan concesiones explícitas a authenticated/service_role.
  -- PUBLIC también concede acceso indirectamente a anon si no se revoca.
  for v_function in select p.oid::regprocedure as signature from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', v_function.signature);
  end loop;
end $$;

-- Los cambios de pago/entrega deben usar RPC, no escrituras REST que eludan
-- sus validaciones y el refresco de cierres.
revoke update on public.sales from authenticated;
revoke update (payment_status, paid_amount, payment_method, delivery_status) on public.sales from authenticated;

notify pgrst, 'reload schema';
commit;

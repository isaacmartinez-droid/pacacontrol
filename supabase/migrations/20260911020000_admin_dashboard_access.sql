-- Panel administrativo y bloqueo fuerte para cuentas suspendidas.
begin;

create or replace function public.current_account_is_active()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and access_status = 'active'
  );
$$;

create or replace function public.current_account_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and access_status = 'active'
      and service_plan = 'internal'
  );
$$;

revoke execute on function public.current_account_is_active() from public, anon;
revoke execute on function public.current_account_is_admin() from public, anon;
grant execute on function public.current_account_is_active() to authenticated;
grant execute on function public.current_account_is_admin() to authenticated;

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles
for update to authenticated
using ((select auth.uid()) = id and public.current_account_is_active())
with check ((select auth.uid()) = id and public.current_account_is_active());

drop policy if exists "Users manage their categories" on public.categories;
create policy "Users manage their categories" on public.categories
for all to authenticated
using ((select auth.uid()) = owner_id and public.current_account_is_active())
with check ((select auth.uid()) = owner_id and public.current_account_is_active());

drop policy if exists "Users manage their bales" on public.bales;
create policy "Users manage their bales" on public.bales
for all to authenticated
using ((select auth.uid()) = owner_id and public.current_account_is_active())
with check ((select auth.uid()) = owner_id and public.current_account_is_active());

drop policy if exists "Users manage their inventory" on public.bale_inventory;
create policy "Users manage their inventory" on public.bale_inventory
for all to authenticated
using (
  public.current_account_is_active()
  and exists (select 1 from public.bales b where b.id = bale_id and b.owner_id = (select auth.uid()))
)
with check (
  public.current_account_is_active()
  and exists (select 1 from public.bales b where b.id = bale_id and b.owner_id = (select auth.uid()))
);

drop policy if exists "Users manage their customers" on public.customers;
create policy "Users manage their customers" on public.customers
for all to authenticated
using ((select auth.uid()) = owner_id and public.current_account_is_active())
with check ((select auth.uid()) = owner_id and public.current_account_is_active());

drop policy if exists "Users read their sales" on public.sales;
create policy "Users read their sales" on public.sales
for select to authenticated
using ((select auth.uid()) = owner_id and public.current_account_is_active());

drop policy if exists "Users update their sale delivery status" on public.sales;
create policy "Users update their sale delivery status" on public.sales
for update to authenticated
using ((select auth.uid()) = owner_id and public.current_account_is_active())
with check ((select auth.uid()) = owner_id and public.current_account_is_active());

drop policy if exists "Users read their sale items" on public.sale_items;
create policy "Users read their sale items" on public.sale_items
for select to authenticated
using (
  public.current_account_is_active()
  and exists (select 1 from public.sales s where s.id = sale_id and s.owner_id = (select auth.uid()))
);

drop policy if exists "Users read their sale allocations" on public.sale_item_allocations;
create policy "Users read their sale allocations" on public.sale_item_allocations
for select to authenticated
using (
  public.current_account_is_active()
  and exists (
    select 1
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
    where si.id = sale_item_id and s.owner_id = (select auth.uid())
  )
);

drop policy if exists "Users manage their expenses" on public.expenses;
create policy "Users manage their expenses" on public.expenses
for all to authenticated
using ((select auth.uid()) = owner_id and public.current_account_is_active())
with check ((select auth.uid()) = owner_id and public.current_account_is_active());

drop policy if exists "Users read their damaged products" on public.damaged_products;
create policy "Users read their damaged products" on public.damaged_products
for select to authenticated
using ((select auth.uid()) = owner_id and public.current_account_is_active());

drop policy if exists "Users read their daily summaries" on public.daily_summaries;
create policy "Users read their daily summaries" on public.daily_summaries
for select to authenticated
using (owner_id = (select auth.uid()) and public.current_account_is_active());

drop policy if exists "Users manage their business settings" on public.business_settings;
create policy "Users manage their business settings" on public.business_settings
for all to authenticated
using ((select auth.uid()) = owner_id and public.current_account_is_active())
with check ((select auth.uid()) = owner_id and public.current_account_is_active());

drop policy if exists "Owners manage push subscriptions" on public.push_subscriptions;
create policy "Owners manage push subscriptions" on public.push_subscriptions
for all to authenticated
using (owner_id = (select auth.uid()) and public.current_account_is_active())
with check (owner_id = (select auth.uid()) and public.current_account_is_active());

create or replace function public.admin_list_accounts()
returns table (
  user_id uuid,
  email text,
  display_name text,
  access_status text,
  service_plan text,
  created_at timestamptz,
  updated_at timestamptz,
  legal_terms_version text,
  terms_accepted_at timestamptz,
  privacy_version text,
  privacy_accepted_at timestamptz,
  bales_count bigint,
  sales_count bigint,
  customers_count bigint,
  sales_total numeric,
  last_sale_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_account_is_admin() then
    raise exception 'No tienes permisos de administrador.';
  end if;

  return query
  select
    p.id as user_id,
    u.email::text,
    p.display_name,
    p.access_status,
    p.service_plan,
    p.created_at,
    p.updated_at,
    p.legal_terms_version,
    p.terms_accepted_at,
    p.privacy_version,
    p.privacy_accepted_at,
    coalesce(bales.total, 0) as bales_count,
    coalesce(sales.total, 0) as sales_count,
    coalesce(customers.total, 0) as customers_count,
    coalesce(sales.amount, 0)::numeric as sales_total,
    sales.last_sale_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join lateral (
    select count(*)::bigint as total
    from public.bales b
    where b.owner_id = p.id
  ) bales on true
  left join lateral (
    select count(*)::bigint as total
    from public.customers c
    where c.owner_id = p.id
  ) customers on true
  left join lateral (
    select count(*)::bigint as total, coalesce(sum(s.total), 0)::numeric as amount, max(s.sold_at) as last_sale_at
    from public.sales s
    where s.owner_id = p.id
  ) sales on true
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_update_account(
  p_user_id uuid,
  p_access_status text,
  p_service_plan text
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  access_status text,
  service_plan text,
  created_at timestamptz,
  updated_at timestamptz,
  legal_terms_version text,
  terms_accepted_at timestamptz,
  privacy_version text,
  privacy_accepted_at timestamptz,
  bales_count bigint,
  sales_count bigint,
  customers_count bigint,
  sales_total numeric,
  last_sale_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_account_is_admin() then
    raise exception 'No tienes permisos de administrador.';
  end if;
  if p_user_id is null then
    raise exception 'Selecciona una cuenta.';
  end if;
  if p_access_status not in ('active', 'suspended', 'closed') then
    raise exception 'Estado de acceso invalido.';
  end if;
  if p_service_plan not in ('pilot_free', 'paid_monthly', 'demo', 'internal') then
    raise exception 'Plan invalido.';
  end if;
  if p_user_id = (select auth.uid())
    and (p_access_status <> 'active' or p_service_plan <> 'internal') then
    raise exception 'No puedes quitarte tu propio acceso administrador.';
  end if;

  update public.profiles
  set
    access_status = p_access_status,
    service_plan = p_service_plan
  where id = p_user_id;

  if not found then
    raise exception 'No encontramos esa cuenta.';
  end if;

  return query
  select *
  from public.admin_list_accounts() a
  where a.user_id = p_user_id;
end;
$$;

revoke execute on function public.admin_list_accounts() from public, anon;
revoke execute on function public.admin_update_account(uuid, text, text) from public, anon;
grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_update_account(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;

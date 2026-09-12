-- Mejora el control administrativo: rol separado, motivos, notas, fechas y auditoria.
begin;

alter table public.profiles add column if not exists account_role text;
alter table public.profiles add column if not exists suspension_reason text;
alter table public.profiles add column if not exists admin_notes text;
alter table public.profiles add column if not exists trial_ends_at timestamptz;
alter table public.profiles add column if not exists next_payment_due_at timestamptz;
alter table public.profiles add column if not exists last_admin_action_at timestamptz;
alter table public.profiles add column if not exists last_admin_action_by uuid references public.profiles(id) on delete set null;

update public.profiles
set account_role = case when service_plan = 'internal' then 'admin' else 'owner' end
where account_role is null;

alter table public.profiles alter column account_role set default 'owner';
alter table public.profiles alter column account_role set not null;

alter table public.profiles
  drop constraint if exists profiles_account_role_check;

alter table public.profiles
  add constraint profiles_account_role_check
  check (account_role in ('owner', 'admin'));

create table if not exists public.admin_account_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  previous_access_status text,
  new_access_status text,
  previous_service_plan text,
  new_service_plan text,
  previous_account_role text,
  new_account_role text,
  suspension_reason text,
  admin_notes text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_account_events enable row level security;

drop policy if exists "Admins read account events" on public.admin_account_events;
create policy "Admins read account events" on public.admin_account_events
for select to authenticated
using (public.current_account_is_admin());

grant select on public.admin_account_events to authenticated;

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
      and (account_role = 'admin' or service_plan = 'internal')
  );
$$;

drop function if exists public.admin_update_account(uuid, text, text);
drop function if exists public.admin_list_accounts();

create function public.admin_list_accounts()
returns table (
  user_id uuid,
  email text,
  display_name text,
  account_role text,
  access_status text,
  service_plan text,
  suspension_reason text,
  admin_notes text,
  trial_ends_at timestamptz,
  next_payment_due_at timestamptz,
  last_admin_action_at timestamptz,
  last_admin_action_by uuid,
  latest_admin_event text,
  latest_admin_event_at timestamptz,
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
    coalesce(p.account_role, case when p.service_plan = 'internal' then 'admin' else 'owner' end) as account_role,
    p.access_status,
    p.service_plan,
    p.suspension_reason,
    p.admin_notes,
    p.trial_ends_at,
    p.next_payment_due_at,
    p.last_admin_action_at,
    p.last_admin_action_by,
    latest.action as latest_admin_event,
    latest.created_at as latest_admin_event_at,
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
  left join lateral (
    select e.action, e.created_at
    from public.admin_account_events e
    where e.target_user_id = p.id
    order by e.created_at desc
    limit 1
  ) latest on true
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_update_account(
  p_user_id uuid,
  p_access_status text,
  p_service_plan text,
  p_account_role text default null,
  p_suspension_reason text default null,
  p_admin_notes text default null,
  p_trial_ends_at timestamptz default null,
  p_next_payment_due_at timestamptz default null
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  account_role text,
  access_status text,
  service_plan text,
  suspension_reason text,
  admin_notes text,
  trial_ends_at timestamptz,
  next_payment_due_at timestamptz,
  last_admin_action_at timestamptz,
  last_admin_action_by uuid,
  latest_admin_event text,
  latest_admin_event_at timestamptz,
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
declare
  v_previous public.profiles;
  v_next_role text;
  v_action text := 'updated';
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

  select * into v_previous
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'No encontramos esa cuenta.';
  end if;

  v_next_role := coalesce(nullif(trim(p_account_role), ''), v_previous.account_role, case when v_previous.service_plan = 'internal' then 'admin' else 'owner' end);
  if v_next_role not in ('owner', 'admin') then
    raise exception 'Rol invalido.';
  end if;

  if p_user_id = (select auth.uid())
    and (p_access_status <> 'active' or v_next_role <> 'admin') then
    raise exception 'No puedes quitarte tu propio acceso administrador.';
  end if;

  if p_access_status = 'suspended' then
    v_action := 'suspended';
  elsif p_access_status = 'closed' then
    v_action := 'closed';
  elsif v_previous.access_status <> 'active' and p_access_status = 'active' then
    v_action := 'reactivated';
  elsif v_previous.service_plan is distinct from p_service_plan then
    v_action := 'plan_changed';
  elsif coalesce(v_previous.account_role, 'owner') is distinct from v_next_role then
    v_action := 'role_changed';
  end if;

  update public.profiles
  set
    access_status = p_access_status,
    service_plan = p_service_plan,
    account_role = v_next_role,
    suspension_reason = nullif(trim(coalesce(p_suspension_reason, '')), ''),
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    trial_ends_at = p_trial_ends_at,
    next_payment_due_at = p_next_payment_due_at,
    last_admin_action_at = timezone('utc', now()),
    last_admin_action_by = (select auth.uid())
  where id = p_user_id;

  if v_previous.access_status is distinct from p_access_status
    or v_previous.service_plan is distinct from p_service_plan
    or coalesce(v_previous.account_role, 'owner') is distinct from v_next_role
    or coalesce(v_previous.suspension_reason, '') is distinct from coalesce(nullif(trim(coalesce(p_suspension_reason, '')), ''), '')
    or coalesce(v_previous.admin_notes, '') is distinct from coalesce(nullif(trim(coalesce(p_admin_notes, '')), ''), '')
    or v_previous.trial_ends_at is distinct from p_trial_ends_at
    or v_previous.next_payment_due_at is distinct from p_next_payment_due_at
  then
    insert into public.admin_account_events (
      target_user_id,
      actor_user_id,
      action,
      previous_access_status,
      new_access_status,
      previous_service_plan,
      new_service_plan,
      previous_account_role,
      new_account_role,
      suspension_reason,
      admin_notes
    ) values (
      p_user_id,
      (select auth.uid()),
      v_action,
      v_previous.access_status,
      p_access_status,
      v_previous.service_plan,
      p_service_plan,
      coalesce(v_previous.account_role, case when v_previous.service_plan = 'internal' then 'admin' else 'owner' end),
      v_next_role,
      nullif(trim(coalesce(p_suspension_reason, '')), ''),
      nullif(trim(coalesce(p_admin_notes, '')), '')
    );
  end if;

  return query
  select *
  from public.admin_list_accounts() a
  where a.user_id = p_user_id;
end;
$$;

revoke execute on function public.current_account_is_admin() from public, anon;
grant execute on function public.current_account_is_admin() to authenticated;

revoke execute on function public.admin_list_accounts() from public, anon;
revoke execute on function public.admin_update_account(uuid, text, text, text, text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_update_account(uuid, text, text, text, text, text, timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
commit;

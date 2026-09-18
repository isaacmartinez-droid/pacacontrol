-- Conserva el historial al retirar una paca y separa gastos reales de metas mensuales.
begin;

alter table public.bales
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

alter table public.bales drop constraint if exists bales_archived_reason_check;
alter table public.bales add constraint bales_archived_reason_check
  check (archived_reason is null or char_length(trim(archived_reason)) between 1 and 500);

alter table public.bale_inventory
  add column if not exists is_active boolean not null default true;

alter table public.expenses
  add column if not exists category text not null default 'other';

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check check (
  category in ('supplies', 'utilities', 'transport', 'rent', 'marketing', 'maintenance', 'other')
);

create table if not exists public.monthly_expense_commitments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  concept text not null check (char_length(trim(concept)) between 1 and 160),
  category text not null default 'other' check (
    category in ('supplies', 'utilities', 'transport', 'rent', 'marketing', 'maintenance', 'other')
  ),
  monthly_amount numeric(12, 2) not null check (monthly_amount > 0),
  is_active boolean not null default true,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists monthly_expense_commitments_owner_idx
  on public.monthly_expense_commitments (owner_id, is_active, created_at desc);

drop trigger if exists monthly_expense_commitments_set_updated_at on public.monthly_expense_commitments;
create trigger monthly_expense_commitments_set_updated_at
before update on public.monthly_expense_commitments
for each row execute procedure public.set_updated_at();

alter table public.monthly_expense_commitments enable row level security;
drop policy if exists "Users manage their monthly expense commitments" on public.monthly_expense_commitments;
create policy "Users manage their monthly expense commitments"
on public.monthly_expense_commitments for all to authenticated
using ((select auth.uid()) = owner_id and public.current_account_is_active())
with check ((select auth.uid()) = owner_id and public.current_account_is_active());

grant select, insert, update, delete on public.monthly_expense_commitments to authenticated;

create table if not exists public.business_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  entity_type text not null check (entity_type in ('bale', 'sale', 'expense', 'customer')),
  entity_id uuid not null,
  action text not null check (char_length(trim(action)) between 1 and 80),
  description text not null check (char_length(trim(description)) between 1 and 500),
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists business_history_owner_created_idx
  on public.business_history (owner_id, created_at desc);
create index if not exists business_history_entity_idx
  on public.business_history (entity_type, entity_id, created_at desc);

alter table public.business_history enable row level security;
drop policy if exists "Users read their business history" on public.business_history;
create policy "Users read their business history"
on public.business_history for select to authenticated
using ((select auth.uid()) = owner_id and public.current_account_is_active());

revoke all on public.business_history from public, anon;
grant select on public.business_history to authenticated;

create or replace function public.set_bale_archived(
  p_bale_id uuid,
  p_archived boolean default true,
  p_reason text default null
)
returns public.bales
language plpgsql security definer set search_path = public
as $$
declare
  v_bale public.bales;
  v_before jsonb;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesion.'; end if;
  if not public.current_account_is_active() then raise exception 'Esta cuenta no tiene acceso activo.'; end if;
  if p_archived is null then raise exception 'El estado de archivo es obligatorio.'; end if;

  select * into v_bale
  from public.bales
  where id = p_bale_id and owner_id = auth.uid()
  for update;
  if not found then raise exception 'No se encontro la paca.'; end if;

  v_before := to_jsonb(v_bale);

  update public.bales set
    archived_at = case when p_archived then timezone('utc', now()) else null end,
    archived_reason = case when p_archived then nullif(trim(p_reason), '') else null end
  where id = p_bale_id
  returning * into v_bale;

  update public.bale_inventory
  set is_active = not p_archived
  where bale_id = p_bale_id;

  insert into public.business_history (
    owner_id, entity_type, entity_id, action, description, before_state, after_state
  ) values (
    auth.uid(), 'bale', p_bale_id,
    case when p_archived then 'archived' else 'reactivated' end,
    case when p_archived then 'Paca archivada; su inventario dejo de estar disponible.'
         else 'Paca reactivada; su inventario volvio a estar disponible.' end,
    v_before,
    to_jsonb(v_bale)
  );

  return v_bale;
end;
$$;

revoke execute on function public.set_bale_archived(uuid, boolean, text) from public, anon;
grant execute on function public.set_bale_archived(uuid, boolean, text) to authenticated;

-- Las versiones anteriores de la app tambien archivan, nunca borran.
create or replace function public.delete_empty_bale(p_bale_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.set_bale_archived(p_bale_id, true, 'Archivada desde una version anterior de la app.');
end;
$$;
revoke execute on function public.delete_empty_bale(uuid) from public, anon;
grant execute on function public.delete_empty_bale(uuid) to authenticated;
revoke update, delete on public.bales, public.bale_inventory from authenticated;

-- Impide que una paca archivada reciba nuevas ventas o registros de dano.
create or replace function public.ensure_active_bale_inventory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1
    from public.bale_inventory bi
    join public.bales b on b.id = bi.bale_id
    where bi.id = new.bale_inventory_id
      and bi.is_active
      and b.archived_at is null
  ) then
    raise exception 'La paca esta archivada. Reactivala antes de modificar su inventario.';
  end if;
  return new;
end;
$$;

drop trigger if exists sale_allocations_require_active_bale on public.sale_item_allocations;
create trigger sale_allocations_require_active_bale
before insert on public.sale_item_allocations
for each row execute procedure public.ensure_active_bale_inventory();

drop trigger if exists damaged_products_require_active_bale on public.damaged_products;
create trigger damaged_products_require_active_bale
before insert on public.damaged_products
for each row execute procedure public.ensure_active_bale_inventory();

revoke execute on function public.ensure_active_bale_inventory() from public, anon, authenticated;

create or replace function public.protect_archived_bale_inventory()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_archived boolean;
begin
  select b.archived_at is not null into v_archived from public.bales b where b.id = new.bale_id;
  if v_archived then
    if tg_op = 'INSERT' then
      raise exception 'Reactiva la paca antes de agregar inventario.';
    elsif new.is_active
      or new.received_quantity is distinct from old.received_quantity
      or new.sold_quantity is distinct from old.sold_quantity
      or new.damaged_quantity is distinct from old.damaged_quantity
      or new.category_id is distinct from old.category_id
      or new.price_level is distinct from old.price_level
      or new.custom_recommended_price is distinct from old.custom_recommended_price then
      raise exception 'Reactiva la paca antes de corregir su inventario.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists bale_inventory_protect_archived on public.bale_inventory;
create trigger bale_inventory_protect_archived before insert or update on public.bale_inventory
for each row execute procedure public.protect_archived_bale_inventory();
revoke execute on function public.protect_archived_bale_inventory() from public, anon, authenticated;

create or replace function public.protect_archived_bale_details()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.archived_at is not null and (
    new.purchase_date is distinct from old.purchase_date
    or new.purchase_cost is distinct from old.purchase_cost
    or new.transport_cost is distinct from old.transport_cost
    or new.other_expenses is distinct from old.other_expenses
    or new.received_pieces is distinct from old.received_pieces
    or new.target_profit_amount is distinct from old.target_profit_amount
    or new.notes is distinct from old.notes
  ) then raise exception 'Reactiva la paca antes de corregir sus datos.'; end if;
  return new;
end;
$$;
drop trigger if exists bales_protect_archived_details on public.bales;
create trigger bales_protect_archived_details before update on public.bales
for each row execute procedure public.protect_archived_bale_details();
revoke execute on function public.protect_archived_bale_details() from public, anon, authenticated;

-- Una asignacion de gasto nunca puede enlazarse a la paca de otra cuenta.
create or replace function public.validate_expense_bale_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.bale_id is not null and not exists (
    select 1 from public.bales b where b.id = new.bale_id and b.owner_id = new.owner_id
  ) then raise exception 'La paca del gasto no pertenece a esta cuenta.'; end if;
  return new;
end;
$$;
drop trigger if exists expenses_validate_bale_owner on public.expenses;
create trigger expenses_validate_bale_owner before insert or update on public.expenses
for each row execute procedure public.validate_expense_bale_owner();
revoke execute on function public.validate_expense_bale_owner() from public, anon, authenticated;

-- El inventario general solo incluye pacas operativas. El detalle historico
-- conserva todas las filas y expone si se encuentran activas o archivadas.
create or replace view public.inventory_summary
with (security_invoker = true)
as
select
  c.id as category_id,
  c.owner_id,
  c.slug,
  c.name,
  coalesce(sum(bi.received_quantity), 0)::integer as received_pieces,
  coalesce(sum(bi.sold_quantity), 0)::integer as sold_pieces,
  coalesce(sum(bi.damaged_quantity), 0)::integer as damaged_pieces,
  coalesce(sum(bi.available_quantity), 0)::integer as available_pieces,
  c.economic_price,
  c.standard_price,
  c.premium_price
from public.categories c
left join public.bale_inventory bi
  on bi.category_id = c.id and bi.is_active
left join public.bales b
  on b.id = bi.bale_id and b.archived_at is null
where bi.id is null or b.id is not null
group by c.id;

create or replace view public.bale_summary
with (security_invoker = true)
as
select
  b.id, b.owner_id, b.bale_number, b.code, b.purchase_date,
  b.purchase_cost, b.transport_cost, b.other_expenses, b.received_pieces,
  b.notes, b.created_at, b.updated_at,
  coalesce(sum(bi.sold_quantity), 0)::integer as sold_pieces,
  coalesce(sum(bi.damaged_quantity), 0)::integer as damaged_pieces,
  coalesce(sum(bi.available_quantity), 0)::integer as available_pieces,
  b.purchase_cost + b.transport_cost + b.other_expenses as total_investment,
  b.target_margin_percent,
  b.target_profit_amount,
  b.archived_at,
  b.archived_reason
from public.bales b
left join public.bale_inventory bi on bi.bale_id = b.id
group by b.id;

create or replace view public.bale_inventory_pricing
with (security_invoker = true)
as
with inventory_totals as (
  select
    b.id as bale_id,
    b.code as bale_code,
    b.owner_id,
    b.target_margin_percent,
    b.target_profit_amount,
    b.archived_at,
    b.purchase_cost + b.transport_cost + b.other_expenses as investment,
    greatest(b.received_pieces - coalesce(sum(bi.damaged_quantity), 0), 0) as sellable_pieces
  from public.bales b
  left join public.bale_inventory bi on bi.bale_id = b.id
  group by b.id
), unit_costs as (
  select it.*, it.investment / nullif(it.sellable_pieces, 0) as estimated_unit_cost
  from inventory_totals it
), base_prices as (
  select uc.*,
    ceil((((uc.investment + uc.target_profit_amount) / nullif(uc.sellable_pieces, 0)) / 5)) * 5
      as base_recommended_price
  from unit_costs uc
)
select
  bi.id,
  bi.bale_id,
  bi.category_id,
  c.name as category_name,
  bp.bale_code,
  bi.received_quantity,
  bi.sold_quantity,
  bi.damaged_quantity,
  bi.available_quantity,
  bi.price_level,
  bi.custom_recommended_price,
  bp.target_margin_percent,
  coalesce(bp.estimated_unit_cost, 0)::numeric(12, 2) as estimated_unit_cost,
  coalesce(bp.base_recommended_price, 0)::numeric(12, 2) as base_recommended_price,
  case
    when bi.price_level = 'custom' then bi.custom_recommended_price
    when bi.price_level = 'economic' and c.economic_price is not null then c.economic_price
    when bi.price_level = 'standard' and c.standard_price is not null then c.standard_price
    when bi.price_level = 'premium' and c.premium_price is not null then c.premium_price
    when bi.price_level = 'standard' then ceil((bp.base_recommended_price * 1.20) / 5) * 5
    when bi.price_level = 'premium' then ceil((bp.base_recommended_price * 1.50) / 5) * 5
    else bp.base_recommended_price
  end::numeric(12, 2) as recommended_unit_price,
  bp.target_profit_amount,
  bi.is_active,
  bp.archived_at as bale_archived_at
from public.bale_inventory bi
join base_prices bp on bp.bale_id = bi.bale_id
join public.categories c on c.id = bi.category_id;

grant select on public.inventory_summary, public.bale_summary, public.bale_inventory_pricing to authenticated;

-- La opcion del KPI mensual puede seleccionarse desde Preferencias.
alter table public.business_settings drop constraint if exists business_settings_kpis_check;
alter table public.business_settings add constraint business_settings_kpis_check check (
  cardinality(dashboard_kpis) between 1 and 4
  and dashboard_kpis <@ array[
    'netResult', 'collected', 'receivables', 'baleInvestment', 'baleInvestmentRemaining', 'baleCollected',
    'inventoryValue', 'operatingExpenses', 'monthlyExpenseReserve',
    'ordersTotal', 'cashCollected', 'transferCollected', 'pendingDeliveries',
    'availablePieces', 'damagedPieces'
  ]::text[]
);

notify pgrst, 'reload schema';
commit;

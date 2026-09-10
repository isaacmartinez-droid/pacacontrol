-- Preferencias configurables por usuario y reglas de precio por categoría.
-- Las reglas fijas tienen prioridad; si están vacías se conserva el cálculo
-- automático basado en costo, margen y nivel de la prenda.
begin;

alter table public.categories
  add column if not exists economic_price numeric(12, 2),
  add column if not exists standard_price numeric(12, 2),
  add column if not exists premium_price numeric(12, 2);

alter table public.categories drop constraint if exists categories_price_rules_check;
alter table public.categories add constraint categories_price_rules_check check (
  (economic_price is null or economic_price > 0)
  and (standard_price is null or standard_price > 0)
  and (premium_price is null or premium_price > 0)
  and (economic_price is null or standard_price is null or economic_price <= standard_price)
  and (economic_price is null or premium_price is null or economic_price <= premium_price)
  and (standard_price is null or premium_price is null or standard_price <= premium_price)
);

create table if not exists public.business_settings (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  dashboard_kpis text[] not null default array['netResult', 'collected', 'baleInvestment', 'availablePieces'],
  dashboard_period text not null default 'month',
  default_payment_method text not null default 'cash',
  default_payment_status text not null default 'paid',
  default_target_margin numeric(5, 2) not null default 40,
  default_delivery_cost numeric(12, 2) not null default 0,
  default_delivery_charge numeric(12, 2) not null default 0,
  warn_below_recommended boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint business_settings_kpis_check check (
    cardinality(dashboard_kpis) between 1 and 4
    and dashboard_kpis <@ array[
      'netResult', 'collected', 'receivables', 'baleInvestment',
      'inventoryValue', 'operatingExpenses', 'ordersTotal',
      'cashCollected', 'transferCollected', 'pendingDeliveries',
      'availablePieces', 'damagedPieces'
    ]::text[]
  ),
  constraint business_settings_period_check check (dashboard_period in ('today', 'week', 'month')),
  constraint business_settings_payment_method_check check (default_payment_method in ('cash', 'transfer', 'card', 'other')),
  constraint business_settings_payment_status_check check (default_payment_status in ('pending', 'partial', 'paid')),
  constraint business_settings_margin_check check (default_target_margin between 1 and 90),
  constraint business_settings_delivery_check check (default_delivery_cost >= 0 and default_delivery_charge >= 0)
);

insert into public.business_settings (owner_id)
select id from public.profiles
on conflict (owner_id) do nothing;

drop trigger if exists business_settings_set_updated_at on public.business_settings;
create trigger business_settings_set_updated_at before update on public.business_settings
for each row execute procedure public.set_updated_at();

create or replace function public.create_default_business_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.business_settings (owner_id) values (new.id)
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_create_business_settings on public.profiles;
create trigger profiles_create_business_settings after insert on public.profiles
for each row execute procedure public.create_default_business_settings();

revoke execute on function public.create_default_business_settings() from public, anon, authenticated;

alter table public.business_settings enable row level security;
drop policy if exists "Users manage their business settings" on public.business_settings;
create policy "Users manage their business settings" on public.business_settings
for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.business_settings to authenticated;

create or replace function public.save_category_price_rules(p_rules jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rule jsonb;
  v_category_id uuid;
  v_economic numeric(12, 2);
  v_standard numeric(12, 2);
  v_premium numeric(12, 2);
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_rules is null or jsonb_typeof(p_rules) <> 'array' then raise exception 'Las reglas de precio no son válidas.'; end if;

  for v_rule in select value from jsonb_array_elements(p_rules) loop
    begin
      v_category_id := (v_rule ->> 'category_id')::uuid;
      v_economic := nullif((v_rule ->> 'economic_price')::numeric, 0);
      v_standard := nullif((v_rule ->> 'standard_price')::numeric, 0);
      v_premium := nullif((v_rule ->> 'premium_price')::numeric, 0);
    exception when others then
      raise exception 'Revisa los precios configurados.';
    end;

    if coalesce(v_economic, 1) <= 0 or coalesce(v_standard, 1) <= 0 or coalesce(v_premium, 1) <= 0 then
      raise exception 'Los precios deben ser mayores que cero.';
    end if;
    if v_economic is not null and v_standard is not null and v_economic > v_standard then
      raise exception 'El precio económico no puede superar al precio normal.';
    end if;
    if v_standard is not null and v_premium is not null and v_standard > v_premium then
      raise exception 'El precio normal no puede superar al precio premium.';
    end if;
    if v_economic is not null and v_premium is not null and v_economic > v_premium then
      raise exception 'El precio económico no puede superar al precio premium.';
    end if;

    update public.categories set
      economic_price = v_economic,
      standard_price = v_standard,
      premium_price = v_premium
    where id = v_category_id and owner_id = auth.uid();
    if not found then raise exception 'Una categoría no existe o no te pertenece.'; end if;
  end loop;
end;
$$;

revoke execute on function public.save_category_price_rules(jsonb) from public, anon;
grant execute on function public.save_category_price_rules(jsonb) to authenticated;

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
left join public.bale_inventory bi on bi.category_id = c.id
group by c.id;

create or replace view public.bale_inventory_pricing
with (security_invoker = true)
as
with inventory_totals as (
  select
    b.id as bale_id,
    b.code as bale_code,
    b.owner_id,
    b.target_margin_percent,
    b.purchase_cost + b.transport_cost + b.other_expenses as investment,
    greatest(b.received_pieces - coalesce(sum(bi.damaged_quantity), 0), 0) as sellable_pieces
  from public.bales b
  left join public.bale_inventory bi on bi.bale_id = b.id
  group by b.id
), unit_costs as (
  select it.*, it.investment / nullif(it.sellable_pieces, 0) as estimated_unit_cost
  from inventory_totals it
), base_prices as (
  select uc.*, ceil((uc.estimated_unit_cost / (1 - uc.target_margin_percent / 100)) / 5) * 5 as base_recommended_price
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
  end::numeric(12, 2) as recommended_unit_price
from public.bale_inventory bi
join base_prices bp on bp.bale_id = bi.bale_id
join public.categories c on c.id = bi.category_id;

-- Al crear la asignación ya conocemos la paca, la categoría y el nivel. En
-- ese momento se reemplaza la referencia calculada por la regla fija, si existe.
create or replace function public.apply_category_price_rule_to_sale_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.sale_items si
  set recommended_unit_price = coalesce(
    case bi.price_level
      when 'economic' then c.economic_price
      when 'standard' then c.standard_price
      when 'premium' then c.premium_price
      else null
    end,
    si.recommended_unit_price
  )
  from public.bale_inventory bi
  join public.categories c on c.id = bi.category_id
  where si.id = new.sale_item_id
    and bi.id = new.bale_inventory_id
    and si.category_id = bi.category_id;
  return new;
end;
$$;

drop trigger if exists sale_allocations_apply_category_price_rule on public.sale_item_allocations;
create trigger sale_allocations_apply_category_price_rule
after insert on public.sale_item_allocations
for each row execute procedure public.apply_category_price_rule_to_sale_item();

revoke execute on function public.apply_category_price_rule_to_sale_item() from public, anon, authenticated;

grant select on public.inventory_summary, public.bale_inventory_pricing to authenticated;
notify pgrst, 'reload schema';
commit;

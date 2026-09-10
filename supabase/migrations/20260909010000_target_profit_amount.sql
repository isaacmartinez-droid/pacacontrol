-- La rentabilidad objetivo de una paca se expresa como un monto en córdobas.
-- Precio base = (inversión total + ganancia deseada) / piezas vendibles.
begin;

alter table public.bales
  add column if not exists target_profit_amount numeric(12, 2);

-- Conserva el precio recomendado de las pacas existentes convirtiendo el
-- margen porcentual anterior a su ganancia monetaria equivalente.
update public.bales
set target_profit_amount = round(
  (purchase_cost + transport_cost + other_expenses)
    * target_margin_percent / nullif(100 - target_margin_percent, 0),
  2
)
where target_profit_amount is null;

alter table public.bales alter column target_profit_amount set default 0;
alter table public.bales alter column target_profit_amount set not null;
alter table public.bales drop constraint if exists bales_target_profit_amount_check;
alter table public.bales add constraint bales_target_profit_amount_check
  check (target_profit_amount >= 0);

alter table public.business_settings
  add column if not exists default_target_profit_amount numeric(12, 2) not null default 0;
alter table public.business_settings drop constraint if exists business_settings_target_profit_check;
alter table public.business_settings add constraint business_settings_target_profit_check
  check (default_target_profit_amount >= 0);

-- La columna porcentual se conserva al final únicamente para clientes antiguos.
-- Todo cálculo actual usa target_profit_amount.
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
  b.target_profit_amount
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
  bp.target_profit_amount
from public.bale_inventory bi
join base_prices bp on bp.bale_id = bi.bale_id
join public.categories c on c.id = bi.category_id;

-- Todas las funciones de venta insertan primero la asignación. Este trigger
-- unifica el costo y el recomendado guardados usando la regla monetaria actual,
-- incluso para un cliente que todavía tenga abierta una versión anterior.
create or replace function public.apply_category_price_rule_to_sale_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.sale_items si
  set reference_unit_cost = pricing.estimated_unit_cost,
      recommended_unit_price = pricing.recommended_unit_price
  from public.bale_inventory_pricing pricing
  where si.id = new.sale_item_id
    and pricing.id = new.bale_inventory_id
    and si.category_id = pricing.category_id;
  return new;
end;
$$;

create or replace function public.update_bale_details_with_profit(
  p_bale_id uuid,
  p_purchase_date date,
  p_purchase_cost numeric,
  p_transport_cost numeric,
  p_other_expenses numeric,
  p_target_profit_amount numeric,
  p_inventory_lines jsonb,
  p_notes text default null
)
returns public.bales language plpgsql security definer set search_path = public as $$
declare
  v_bale public.bales;
  v_line jsonb;
  v_inventory_id uuid;
  v_received integer;
  v_committed integer;
  v_price_level text;
  v_custom_price numeric(12, 2);
  v_line_count integer;
  v_inventory_count integer;
  v_total_received integer;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_purchase_date is null or p_purchase_cost is null or p_purchase_cost <= 0 then raise exception 'Revisa la fecha y el costo de compra.'; end if;
  if coalesce(p_transport_cost, 0) < 0 or coalesce(p_other_expenses, 0) < 0 then raise exception 'Los costos no pueden ser negativos.'; end if;
  if p_target_profit_amount is null or p_target_profit_amount < 0 then raise exception 'La ganancia deseada no puede ser negativa.'; end if;
  if p_inventory_lines is null or jsonb_typeof(p_inventory_lines) <> 'array' or jsonb_array_length(p_inventory_lines) = 0 then raise exception 'La paca necesita al menos una categoría.'; end if;
  select * into v_bale from public.bales where id = p_bale_id and owner_id = auth.uid() for update;
  if not found then raise exception 'No se encontró la paca.'; end if;

  select count(*) into v_inventory_count from public.bale_inventory where bale_id = p_bale_id;
  select count(distinct value ->> 'bale_inventory_id') into v_line_count from jsonb_array_elements(p_inventory_lines);
  if v_line_count <> v_inventory_count or jsonb_array_length(p_inventory_lines) <> v_inventory_count then
    raise exception 'Deben conservarse todas las categorías de la paca.';
  end if;

  for v_line in select value from jsonb_array_elements(p_inventory_lines) loop
    begin
      v_inventory_id := (v_line ->> 'bale_inventory_id')::uuid;
      v_received := (v_line ->> 'received_quantity')::integer;
      v_price_level := v_line ->> 'price_level';
      v_custom_price := nullif((v_line ->> 'custom_recommended_price')::numeric, 0);
    exception when others then
      raise exception 'Revisa las cantidades de la paca.';
    end;
    select sold_quantity + damaged_quantity into v_committed
    from public.bale_inventory
    where id = v_inventory_id and bale_id = p_bale_id
    for update;
    if not found then raise exception 'Una categoría no pertenece a esta paca.'; end if;
    if v_received < v_committed then
      raise exception 'Una categoría ya tiene % piezas vendidas o dañadas y no puede quedar por debajo.', v_committed;
    end if;
    if v_price_level not in ('economic', 'standard', 'premium', 'custom') then raise exception 'Nivel de precio inválido.'; end if;
    if (v_price_level = 'custom' and coalesce(v_custom_price, 0) <= 0)
      or (v_price_level <> 'custom' and v_custom_price is not null) then
      raise exception 'Revisa el precio personalizado de la categoría.';
    end if;
    update public.bale_inventory set
      received_quantity = v_received,
      price_level = v_price_level,
      custom_recommended_price = v_custom_price
    where id = v_inventory_id;
  end loop;

  select sum(received_quantity) into v_total_received from public.bale_inventory where bale_id = p_bale_id;
  update public.bales set
    purchase_date = p_purchase_date,
    purchase_cost = p_purchase_cost,
    transport_cost = coalesce(p_transport_cost, 0),
    other_expenses = coalesce(p_other_expenses, 0),
    target_profit_amount = p_target_profit_amount,
    received_pieces = v_total_received,
    notes = nullif(trim(p_notes), '')
  where id = p_bale_id returning * into v_bale;
  return v_bale;
end;
$$;

revoke execute on function public.update_bale_details_with_profit(uuid, date, numeric, numeric, numeric, numeric, jsonb, text) from public, anon;
grant execute on function public.update_bale_details_with_profit(uuid, date, numeric, numeric, numeric, numeric, jsonb, text) to authenticated;
grant select on public.bale_summary, public.bale_inventory_pricing to authenticated;

notify pgrst, 'reload schema';
commit;

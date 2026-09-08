-- Precio recomendado por paca y categoría.
-- Usa margen real: precio = costo / (1 - margen), redondeado a C$5.
begin;

alter table public.bales
  add column if not exists target_margin_percent numeric(5, 2) not null default 40;

alter table public.bales drop constraint if exists bales_target_margin_check;
alter table public.bales add constraint bales_target_margin_check
  check (target_margin_percent between 1 and 90);

alter table public.bale_inventory
  add column if not exists price_level text not null default 'economic',
  add column if not exists custom_recommended_price numeric(12, 2);

alter table public.bale_inventory drop constraint if exists bale_inventory_price_level_check;
alter table public.bale_inventory drop constraint if exists bale_inventory_custom_price_check;
alter table public.bale_inventory add constraint bale_inventory_price_level_check
  check (price_level in ('economic', 'standard', 'premium', 'custom'));
alter table public.bale_inventory add constraint bale_inventory_custom_price_check check (
  (price_level = 'custom' and custom_recommended_price > 0)
  or (price_level <> 'custom' and custom_recommended_price is null)
);

-- Conserva en cada renglón nuevo de venta la referencia usada en ese momento.
alter table public.sale_items
  add column if not exists reference_unit_cost numeric(12, 2),
  add column if not exists recommended_unit_price numeric(12, 2);

alter table public.sale_items drop constraint if exists sale_items_reference_cost_check;
alter table public.sale_items drop constraint if exists sale_items_recommended_price_check;
alter table public.sale_items add constraint sale_items_reference_cost_check
  check (reference_unit_cost is null or reference_unit_cost >= 0);
alter table public.sale_items add constraint sale_items_recommended_price_check
  check (recommended_unit_price is null or recommended_unit_price > 0);

-- Mantiene las columnas anteriores de bale_summary en el mismo orden y agrega
-- el margen al final para no romper los clientes existentes.
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
  b.target_margin_percent
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
    b.purchase_cost + b.transport_cost + b.other_expenses as investment,
    greatest(b.received_pieces - coalesce(sum(bi.damaged_quantity), 0), 0) as sellable_pieces
  from public.bales b
  left join public.bale_inventory bi on bi.bale_id = b.id
  group by b.id
), unit_costs as (
  select
    it.*,
    it.investment / nullif(it.sellable_pieces, 0) as estimated_unit_cost
  from inventory_totals it
), base_prices as (
  select
    uc.*,
    ceil((uc.estimated_unit_cost / (1 - uc.target_margin_percent / 100)) / 5) * 5 as base_recommended_price
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
    when bi.price_level = 'standard' then ceil((bp.base_recommended_price * 1.20) / 5) * 5
    when bi.price_level = 'premium' then ceil((bp.base_recommended_price * 1.50) / 5) * 5
    else bp.base_recommended_price
  end::numeric(12, 2) as recommended_unit_price
from public.bale_inventory bi
join base_prices bp on bp.bale_id = bi.bale_id
join public.categories c on c.id = bi.category_id;

create or replace function public.register_sale(
  p_category_id uuid,
  p_quantity integer,
  p_unit_price numeric,
  p_payment_method text,
  p_customer_id uuid default null,
  p_sold_at timestamptz default timezone('utc', now()),
  p_notes text default null,
  p_bale_inventory_id uuid default null,
  p_payment_status text default 'paid',
  p_paid_amount numeric default null,
  p_delivery_cost numeric default 0,
  p_delivery_charge numeric default 0
)
returns public.sales
language plpgsql security definer set search_path = public
as $$
declare
  v_sale public.sales;
  v_sale_item_id uuid;
  v_inventory record;
  v_total_merchandise numeric(12, 2) := p_quantity * p_unit_price;
  v_total_due numeric(12, 2);
  v_first_payment numeric(12, 2);
  v_unit_cost numeric(12, 2);
  v_base_recommended numeric(12, 2);
  v_recommended numeric(12, 2);
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión para registrar una venta.'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'La cantidad debe ser mayor que cero.'; end if;
  if p_unit_price is null or p_unit_price <= 0 then raise exception 'El precio por pieza debe ser mayor que cero.'; end if;
  if p_payment_status not in ('pending', 'partial', 'paid') then raise exception 'Estado de pago inválido.'; end if;
  if p_payment_method not in ('cash', 'transfer', 'card', 'other') then raise exception 'Método de pago inválido.'; end if;
  if p_bale_inventory_id is null then raise exception 'Elige la paca exacta de donde salieron las prendas.'; end if;
  if p_delivery_cost is null or p_delivery_cost < 0 or coalesce(p_delivery_charge, 0) < 0 then raise exception 'Los valores de delivery no pueden ser negativos.'; end if;
  if p_customer_id is null and (p_delivery_cost <> 0 or coalesce(p_delivery_charge, 0) <> 0) then raise exception 'Una venta de mostrador no lleva delivery.'; end if;
  if p_customer_id is not null and p_delivery_cost <= 0 then raise exception 'Ingresa el costo real del delivery para este cliente.'; end if;
  if p_payment_status <> 'paid' and p_customer_id is null then raise exception 'Elige un cliente para registrar un pago pendiente o parcial.'; end if;
  if not exists (select 1 from public.categories where id = p_category_id and owner_id = auth.uid()) then raise exception 'La categoría no existe o no te pertenece.'; end if;
  if p_customer_id is not null and not exists (select 1 from public.customers where id = p_customer_id and owner_id = auth.uid()) then raise exception 'El cliente no existe o no te pertenece.'; end if;

  select
    bi.id,
    bi.available_quantity,
    bi.price_level,
    bi.custom_recommended_price,
    b.target_margin_percent,
    (b.purchase_cost + b.transport_cost + b.other_expenses)
      / nullif(greatest(b.received_pieces - coalesce(d.damaged_quantity, 0), 0), 0) as unit_cost
  into v_inventory
  from public.bale_inventory bi
  join public.bales b on b.id = bi.bale_id
  left join lateral (
    select sum(all_bi.damaged_quantity) as damaged_quantity
    from public.bale_inventory all_bi where all_bi.bale_id = b.id
  ) d on true
  where bi.id = p_bale_inventory_id and bi.category_id = p_category_id and b.owner_id = auth.uid()
  for update of bi;
  if not found then raise exception 'La paca elegida no corresponde a esta categoría o no te pertenece.'; end if;
  if v_inventory.available_quantity < p_quantity then raise exception 'La paca elegida solo tiene % piezas disponibles.', v_inventory.available_quantity; end if;

  v_unit_cost := coalesce(v_inventory.unit_cost, 0);
  v_base_recommended := ceil((v_unit_cost / (1 - v_inventory.target_margin_percent / 100)) / 5) * 5;
  v_recommended := case v_inventory.price_level
    when 'custom' then v_inventory.custom_recommended_price
    when 'standard' then ceil((v_base_recommended * 1.20) / 5) * 5
    when 'premium' then ceil((v_base_recommended * 1.50) / 5) * 5
    else v_base_recommended
  end;

  v_total_due := v_total_merchandise + coalesce(p_delivery_charge, 0);
  v_first_payment := case p_payment_status
    when 'paid' then v_total_due
    when 'pending' then 0
    else coalesce(p_paid_amount, 0)
  end;
  if p_payment_status = 'partial' and (v_first_payment <= 0 or v_first_payment >= v_total_due) then
    raise exception 'El primer pago debe ser mayor que cero y menor que el total.';
  end if;

  insert into public.sales (
    owner_id, customer_id, payment_method, payment_status, paid_amount, delivery_status,
    sold_at, total, merchandise_total, delivery_cost, delivery_charge,
    estimated_merchandise_cost, first_payment_amount, first_payment_method,
    first_payment_at, notes
  ) values (
    auth.uid(), p_customer_id, p_payment_method,
    case when v_first_payment = 0 then 'pending' when v_first_payment = v_total_due then 'paid' else 'partial' end,
    v_first_payment, 'to_prepare', coalesce(p_sold_at, timezone('utc', now())),
    v_total_due, v_total_merchandise, p_delivery_cost, coalesce(p_delivery_charge, 0),
    v_unit_cost * p_quantity, v_first_payment,
    case when v_first_payment > 0 then p_payment_method else null end,
    case when v_first_payment > 0 then timezone('utc', now()) else null end,
    p_notes
  ) returning * into v_sale;

  insert into public.sale_items (
    sale_id, category_id, quantity, unit_price, reference_unit_cost, recommended_unit_price
  ) values (
    v_sale.id, p_category_id, p_quantity, p_unit_price, v_unit_cost, v_recommended
  ) returning id into v_sale_item_id;

  update public.bale_inventory set sold_quantity = sold_quantity + p_quantity where id = v_inventory.id;
  insert into public.sale_item_allocations (sale_item_id, bale_inventory_id, quantity)
  values (v_sale_item_id, v_inventory.id, p_quantity);
  return v_sale;
end;
$$;

grant select on public.bale_inventory_pricing to authenticated;
grant execute on function public.register_sale(uuid, integer, numeric, text, uuid, timestamptz, text, uuid, text, numeric, numeric, numeric) to authenticated;
notify pgrst, 'reload schema';
commit;

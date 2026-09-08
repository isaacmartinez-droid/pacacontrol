-- Una venta puede contener varias cantidades y precios de la misma categoría
-- y paca. Cada grupo queda guardado como un renglón independiente.
begin;

create or replace function public.register_sale_with_prices(
  p_category_id uuid,
  p_bale_inventory_id uuid,
  p_price_lines jsonb,
  p_payment_method text,
  p_customer_id uuid default null,
  p_sold_at timestamptz default timezone('utc', now()),
  p_notes text default null,
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
  v_line jsonb;
  v_line_quantity integer;
  v_line_price numeric(12, 2);
  v_total_quantity integer := 0;
  v_total_merchandise numeric(12, 2) := 0;
  v_total_due numeric(12, 2);
  v_first_payment numeric(12, 2);
  v_unit_cost numeric(12, 2);
  v_base_recommended numeric(12, 2);
  v_recommended numeric(12, 2);
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión para registrar una venta.'; end if;
  if p_price_lines is null or jsonb_typeof(p_price_lines) <> 'array' or jsonb_array_length(p_price_lines) = 0 then
    raise exception 'Agrega al menos un precio a la venta.';
  end if;
  if p_payment_status not in ('pending', 'partial', 'paid') then raise exception 'Estado de pago inválido.'; end if;
  if p_payment_method not in ('cash', 'transfer', 'card', 'other') then raise exception 'Método de pago inválido.'; end if;
  if p_bale_inventory_id is null then raise exception 'Elige la paca exacta de donde salieron las prendas.'; end if;
  if p_delivery_cost is null or p_delivery_cost < 0 or coalesce(p_delivery_charge, 0) < 0 then raise exception 'Los valores de delivery no pueden ser negativos.'; end if;
  if p_customer_id is null and (p_delivery_cost <> 0 or coalesce(p_delivery_charge, 0) <> 0) then raise exception 'Una venta de mostrador no lleva delivery.'; end if;
  if p_customer_id is not null and p_delivery_cost <= 0 then raise exception 'Ingresa el costo real del delivery para este cliente.'; end if;
  if p_payment_status <> 'paid' and p_customer_id is null then raise exception 'Elige un cliente para registrar un pago pendiente o parcial.'; end if;
  if not exists (select 1 from public.categories where id = p_category_id and owner_id = auth.uid()) then raise exception 'La categoría no existe o no te pertenece.'; end if;
  if p_customer_id is not null and not exists (select 1 from public.customers where id = p_customer_id and owner_id = auth.uid()) then raise exception 'El cliente no existe o no te pertenece.'; end if;

  for v_line in select value from jsonb_array_elements(p_price_lines) loop
    if jsonb_typeof(v_line) is distinct from 'object'
      or jsonb_typeof(v_line -> 'quantity') is distinct from 'number'
      or jsonb_typeof(v_line -> 'unit_price') is distinct from 'number'
      or coalesce(v_line ->> 'quantity', '') !~ '^[1-9][0-9]*$' then
      raise exception 'Cada renglón necesita cantidad y precio numéricos.';
    end if;
    begin
      v_line_quantity := (v_line ->> 'quantity')::integer;
      v_line_price := (v_line ->> 'unit_price')::numeric(12, 2);
    exception when others then
      raise exception 'Revisa las cantidades y precios de la venta.';
    end;
    if v_line_quantity < 1 then raise exception 'Cada cantidad debe ser mayor que cero.'; end if;
    if v_line_price <= 0 then raise exception 'Cada precio debe ser mayor que cero.'; end if;
    v_total_quantity := v_total_quantity + v_line_quantity;
    v_total_merchandise := v_total_merchandise + v_line_quantity * v_line_price;
  end loop;

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
  if v_inventory.available_quantity < v_total_quantity then
    raise exception 'La paca elegida solo tiene % piezas disponibles.', v_inventory.available_quantity;
  end if;

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
    v_unit_cost * v_total_quantity, v_first_payment,
    case when v_first_payment > 0 then p_payment_method else null end,
    case when v_first_payment > 0 then timezone('utc', now()) else null end,
    p_notes
  ) returning * into v_sale;

  for v_line in select value from jsonb_array_elements(p_price_lines) loop
    v_line_quantity := (v_line ->> 'quantity')::integer;
    v_line_price := (v_line ->> 'unit_price')::numeric(12, 2);
    insert into public.sale_items (
      sale_id, category_id, quantity, unit_price, reference_unit_cost, recommended_unit_price
    ) values (
      v_sale.id, p_category_id, v_line_quantity, v_line_price, v_unit_cost, v_recommended
    ) returning id into v_sale_item_id;
    insert into public.sale_item_allocations (sale_item_id, bale_inventory_id, quantity)
    values (v_sale_item_id, v_inventory.id, v_line_quantity);
  end loop;

  update public.bale_inventory
  set sold_quantity = sold_quantity + v_total_quantity
  where id = v_inventory.id;
  return v_sale;
end;
$$;

grant execute on function public.register_sale_with_prices(uuid, uuid, jsonb, text, uuid, timestamptz, text, text, numeric, numeric, numeric) to authenticated;
notify pgrst, 'reload schema';
commit;

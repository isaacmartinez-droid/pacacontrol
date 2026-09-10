-- Pedidos con varios artículos, retiro en tienda y edición segura de pacas.
begin;

alter table public.sales add column if not exists fulfillment_method text;
update public.sales
set fulfillment_method = case when delivery_cost > 0 or delivery_charge > 0 then 'delivery' else 'pickup' end
where fulfillment_method is null;
alter table public.sales alter column fulfillment_method set default 'pickup';
alter table public.sales alter column fulfillment_method set not null;
alter table public.sales drop constraint if exists sales_fulfillment_method_check;
alter table public.sales add constraint sales_fulfillment_method_check
  check (fulfillment_method in ('pickup', 'delivery'));
alter table public.sales drop constraint if exists sales_fulfillment_delivery_check;
alter table public.sales add constraint sales_fulfillment_delivery_check check (
  (fulfillment_method = 'pickup' and delivery_cost = 0 and delivery_charge = 0)
  or (fulfillment_method = 'delivery' and customer_id is not null and delivery_cost > 0)
);

-- Mantiene compatibles las funciones anteriores, que todavía no enviaban la
-- forma de entrega pero sí registraban los costos de delivery.
create or replace function public.normalize_sale_fulfillment()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.fulfillment_method = 'pickup'
    and (coalesce(new.delivery_cost, 0) > 0 or coalesce(new.delivery_charge, 0) > 0) then
    new.fulfillment_method := 'delivery';
  end if;
  return new;
end;
$$;

drop trigger if exists sales_normalize_fulfillment on public.sales;
create trigger sales_normalize_fulfillment before insert or update on public.sales
for each row execute procedure public.normalize_sale_fulfillment();
revoke execute on function public.normalize_sale_fulfillment() from public, anon, authenticated;

create or replace function public.register_sale_with_items(
  p_items jsonb,
  p_payment_method text,
  p_customer_id uuid default null,
  p_fulfillment_method text default 'pickup',
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
  v_item jsonb;
  v_line jsonb;
  v_inventory record;
  v_inventory_id uuid;
  v_category_id uuid;
  v_line_quantity integer;
  v_line_price numeric(12, 2);
  v_item_quantity integer;
  v_total_quantity integer := 0;
  v_total_merchandise numeric(12, 2) := 0;
  v_total_cost numeric(12, 2) := 0;
  v_total_due numeric(12, 2);
  v_first_payment numeric(12, 2);
  v_base_recommended numeric(12, 2);
  v_recommended numeric(12, 2);
  v_item_count integer;
  v_distinct_inventory_count integer;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión para registrar una venta.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un artículo a la venta.';
  end if;
  if p_payment_status not in ('pending', 'partial', 'paid') then raise exception 'Estado de pago inválido.'; end if;
  if p_payment_method not in ('cash', 'transfer', 'card', 'other') then raise exception 'Método de pago inválido.'; end if;
  if p_fulfillment_method not in ('pickup', 'delivery') then raise exception 'Forma de entrega inválida.'; end if;
  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and owner_id = auth.uid()
  ) then raise exception 'El cliente no existe o no te pertenece.'; end if;
  if p_payment_status <> 'paid' and p_customer_id is null then
    raise exception 'Elige un cliente para registrar un pago pendiente o parcial.';
  end if;
  if p_fulfillment_method = 'delivery' then
    if p_customer_id is null then raise exception 'Elige un cliente para realizar el envío.'; end if;
    if p_delivery_cost is null or p_delivery_cost <= 0 then raise exception 'Ingresa el costo real del delivery.'; end if;
    if coalesce(p_delivery_charge, 0) < 0 then raise exception 'El cobro de delivery no puede ser negativo.'; end if;
  elsif coalesce(p_delivery_cost, 0) <> 0 or coalesce(p_delivery_charge, 0) <> 0 then
    raise exception 'Un pedido que se recoge en tienda no lleva valores de delivery.';
  end if;

  select count(*), count(distinct value ->> 'bale_inventory_id')
  into v_item_count, v_distinct_inventory_count
  from jsonb_array_elements(p_items);
  if v_item_count <> v_distinct_inventory_count then
    raise exception 'No repitas la misma categoría y paca; agrega sus precios dentro del mismo artículo.';
  end if;

  -- Se bloquean en orden fijo todas las filas necesarias para evitar sobreventa
  -- y bloqueos cruzados cuando dos pedidos se registran al mismo tiempo.
  for v_inventory_id in
    select distinct (value ->> 'bale_inventory_id')::uuid
    from jsonb_array_elements(p_items)
    order by 1
  loop
    perform bi.id
    from public.bale_inventory bi
    join public.bales b on b.id = bi.bale_id
    where bi.id = v_inventory_id and b.owner_id = auth.uid()
    for update of bi;
    if not found then raise exception 'Una paca elegida no existe o no te pertenece.'; end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_inventory_id := (v_item ->> 'bale_inventory_id')::uuid;
      v_category_id := (v_item ->> 'category_id')::uuid;
    exception when others then
      raise exception 'Revisa la categoría y la paca de cada artículo.';
    end;
    if jsonb_typeof(v_item -> 'price_lines') is distinct from 'array'
      or jsonb_array_length(v_item -> 'price_lines') = 0 then
      raise exception 'Cada artículo necesita al menos una cantidad y precio.';
    end if;

    select
      bi.id, bi.available_quantity, bi.price_level, bi.custom_recommended_price,
      b.target_margin_percent,
      (b.purchase_cost + b.transport_cost + b.other_expenses)
        / nullif(greatest(b.received_pieces - coalesce(d.damaged_quantity, 0), 0), 0) as unit_cost,
      c.economic_price, c.standard_price, c.premium_price
    into v_inventory
    from public.bale_inventory bi
    join public.bales b on b.id = bi.bale_id
    join public.categories c on c.id = bi.category_id
    left join lateral (
      select sum(all_bi.damaged_quantity) as damaged_quantity
      from public.bale_inventory all_bi where all_bi.bale_id = b.id
    ) d on true
    where bi.id = v_inventory_id and bi.category_id = v_category_id
      and b.owner_id = auth.uid() and c.owner_id = auth.uid();
    if not found then raise exception 'Una paca no corresponde con la categoría seleccionada.'; end if;

    v_item_quantity := 0;
    for v_line in select value from jsonb_array_elements(v_item -> 'price_lines') loop
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
      if v_line_quantity < 1 or v_line_price <= 0 then
        raise exception 'Cada cantidad y precio debe ser mayor que cero.';
      end if;
      v_item_quantity := v_item_quantity + v_line_quantity;
      v_total_quantity := v_total_quantity + v_line_quantity;
      v_total_merchandise := v_total_merchandise + v_line_quantity * v_line_price;
    end loop;
    if v_item_quantity > v_inventory.available_quantity then
      raise exception 'La paca elegida solo tiene % piezas disponibles.', v_inventory.available_quantity;
    end if;
    v_total_cost := v_total_cost + coalesce(v_inventory.unit_cost, 0) * v_item_quantity;
  end loop;

  v_total_due := v_total_merchandise + case when p_fulfillment_method = 'delivery' then coalesce(p_delivery_charge, 0) else 0 end;
  v_first_payment := case p_payment_status
    when 'paid' then v_total_due
    when 'pending' then 0
    else coalesce(p_paid_amount, 0)
  end;
  if p_payment_status = 'partial' and (v_first_payment <= 0 or v_first_payment >= v_total_due) then
    raise exception 'El primer pago debe ser mayor que cero y menor que el total.';
  end if;

  insert into public.sales (
    owner_id, customer_id, payment_method, payment_status, paid_amount,
    delivery_status, fulfillment_method, sold_at, total, merchandise_total,
    delivery_cost, delivery_charge, estimated_merchandise_cost,
    first_payment_amount, first_payment_method, first_payment_at, notes
  ) values (
    auth.uid(), p_customer_id, p_payment_method,
    case when v_first_payment = 0 then 'pending' when v_first_payment = v_total_due then 'paid' else 'partial' end,
    v_first_payment, 'to_prepare', p_fulfillment_method,
    coalesce(p_sold_at, timezone('utc', now())), v_total_due, v_total_merchandise,
    case when p_fulfillment_method = 'delivery' then p_delivery_cost else 0 end,
    case when p_fulfillment_method = 'delivery' then coalesce(p_delivery_charge, 0) else 0 end,
    v_total_cost, v_first_payment,
    case when v_first_payment > 0 then p_payment_method else null end,
    case when v_first_payment > 0 then timezone('utc', now()) else null end,
    p_notes
  ) returning * into v_sale;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_inventory_id := (v_item ->> 'bale_inventory_id')::uuid;
    v_category_id := (v_item ->> 'category_id')::uuid;
    select bi.price_level, bi.custom_recommended_price,
      b.target_margin_percent,
      (b.purchase_cost + b.transport_cost + b.other_expenses)
        / nullif(greatest(b.received_pieces - coalesce(d.damaged_quantity, 0), 0), 0) as unit_cost,
      c.economic_price, c.standard_price, c.premium_price
    into v_inventory
    from public.bale_inventory bi
    join public.bales b on b.id = bi.bale_id
    join public.categories c on c.id = bi.category_id
    left join lateral (
      select sum(all_bi.damaged_quantity) as damaged_quantity
      from public.bale_inventory all_bi where all_bi.bale_id = b.id
    ) d on true
    where bi.id = v_inventory_id;

    v_base_recommended := ceil((coalesce(v_inventory.unit_cost, 0) / (1 - v_inventory.target_margin_percent / 100)) / 5) * 5;
    v_recommended := case v_inventory.price_level
      when 'custom' then v_inventory.custom_recommended_price
      when 'economic' then coalesce(v_inventory.economic_price, v_base_recommended)
      when 'standard' then coalesce(v_inventory.standard_price, ceil((v_base_recommended * 1.20) / 5) * 5)
      when 'premium' then coalesce(v_inventory.premium_price, ceil((v_base_recommended * 1.50) / 5) * 5)
      else v_base_recommended
    end;
    v_item_quantity := 0;
    for v_line in select value from jsonb_array_elements(v_item -> 'price_lines') loop
      v_line_quantity := (v_line ->> 'quantity')::integer;
      v_line_price := (v_line ->> 'unit_price')::numeric(12, 2);
      v_item_quantity := v_item_quantity + v_line_quantity;
      insert into public.sale_items (
        sale_id, category_id, quantity, unit_price, reference_unit_cost, recommended_unit_price
      ) values (
        v_sale.id, v_category_id, v_line_quantity, v_line_price,
        coalesce(v_inventory.unit_cost, 0), v_recommended
      ) returning id into v_sale_item_id;
      insert into public.sale_item_allocations (sale_item_id, bale_inventory_id, quantity)
      values (v_sale_item_id, v_inventory_id, v_line_quantity);
    end loop;
    update public.bale_inventory
    set sold_quantity = sold_quantity + v_item_quantity
    where id = v_inventory_id;
  end loop;
  return v_sale;
end;
$$;

revoke execute on function public.register_sale_with_items(jsonb, text, uuid, text, timestamptz, text, text, numeric, numeric, numeric) from public, anon;
grant execute on function public.register_sale_with_items(jsonb, text, uuid, text, timestamptz, text, text, numeric, numeric, numeric) to authenticated;

create or replace function public.update_sale_delivery_status(p_sale_id uuid, p_delivery_status text)
returns public.sales language plpgsql security definer set search_path = public as $$
declare v_sale public.sales;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_delivery_status not in ('to_prepare', 'ready', 'on_the_way', 'delivered') then raise exception 'Estado de entrega inválido.'; end if;
  select * into v_sale from public.sales where id = p_sale_id and owner_id = auth.uid() for update;
  if not found then raise exception 'No se encontró el pedido.'; end if;
  if v_sale.payment_status <> 'paid' then raise exception 'Primero registra el pago completo antes de preparar o entregar el pedido.'; end if;
  if v_sale.fulfillment_method = 'pickup' and p_delivery_status = 'on_the_way' then
    raise exception 'Un pedido que se recoge en tienda no pasa a En camino.';
  end if;
  update public.sales set delivery_status = p_delivery_status where id = p_sale_id returning * into v_sale;
  return v_sale;
end;
$$;

create or replace function public.update_bale_details(
  p_bale_id uuid,
  p_purchase_date date,
  p_purchase_cost numeric,
  p_transport_cost numeric,
  p_other_expenses numeric,
  p_target_margin numeric,
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
  if p_target_margin is null or p_target_margin < 1 or p_target_margin > 90 then raise exception 'El margen debe estar entre 1% y 90%.'; end if;
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
    target_margin_percent = p_target_margin,
    received_pieces = v_total_received,
    notes = nullif(trim(p_notes), '')
  where id = p_bale_id returning * into v_bale;
  return v_bale;
end;
$$;

create or replace function public.delete_empty_bale(p_bale_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if not exists (select 1 from public.bales where id = p_bale_id and owner_id = auth.uid()) then raise exception 'No se encontró la paca.'; end if;
  if exists (
    select 1 from public.sale_item_allocations a
    join public.bale_inventory bi on bi.id = a.bale_inventory_id
    where bi.bale_id = p_bale_id
  ) or exists (
    select 1 from public.bale_inventory where bale_id = p_bale_id and sold_quantity > 0
  ) then raise exception 'No puedes borrar una paca con ventas; su historial financiero debe conservarse.'; end if;
  if exists (
    select 1 from public.damaged_products dp
    join public.bale_inventory bi on bi.id = dp.bale_inventory_id
    where bi.bale_id = p_bale_id
  ) then raise exception 'No puedes borrar una paca con daños registrados.'; end if;
  delete from public.bales where id = p_bale_id and owner_id = auth.uid();
end;
$$;

revoke execute on function public.update_bale_details(uuid, date, numeric, numeric, numeric, numeric, jsonb, text) from public, anon;
revoke execute on function public.delete_empty_bale(uuid) from public, anon;
grant execute on function public.update_bale_details(uuid, date, numeric, numeric, numeric, numeric, jsonb, text) to authenticated;
grant execute on function public.delete_empty_bale(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;

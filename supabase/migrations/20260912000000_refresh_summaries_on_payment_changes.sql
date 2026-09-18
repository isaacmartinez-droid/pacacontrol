-- Mantiene los reportes diarios alineados cuando cambian ventas, cobros o entregas.
begin;

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
  if auth.uid() is null then raise exception 'Debes iniciar sesion para registrar una venta.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un articulo a la venta.';
  end if;
  if p_payment_status not in ('pending', 'partial', 'paid') then raise exception 'Estado de pago invalido.'; end if;
  if p_payment_method not in ('cash', 'transfer', 'card', 'other') then raise exception 'Metodo de pago invalido.'; end if;
  if p_fulfillment_method not in ('pickup', 'delivery') then raise exception 'Forma de entrega invalida.'; end if;
  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and owner_id = auth.uid()
  ) then raise exception 'El cliente no existe o no te pertenece.'; end if;
  if p_payment_status <> 'paid' and p_customer_id is null then
    raise exception 'Elige un cliente para registrar un pago pendiente o parcial.';
  end if;
  if p_fulfillment_method = 'delivery' then
    if p_customer_id is null then raise exception 'Elige un cliente para realizar el envio.'; end if;
    if p_delivery_cost is null or p_delivery_cost <= 0 then raise exception 'Ingresa el costo real del delivery.'; end if;
    if coalesce(p_delivery_charge, 0) < 0 then raise exception 'El cobro de delivery no puede ser negativo.'; end if;
  elsif coalesce(p_delivery_cost, 0) <> 0 or coalesce(p_delivery_charge, 0) <> 0 then
    raise exception 'Un pedido que se recoge en tienda no lleva valores de delivery.';
  end if;

  select count(*), count(distinct value ->> 'bale_inventory_id')
  into v_item_count, v_distinct_inventory_count
  from jsonb_array_elements(p_items);
  if v_item_count <> v_distinct_inventory_count then
    raise exception 'No repitas la misma categoria y paca; agrega sus precios dentro del mismo articulo.';
  end if;

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
      raise exception 'Revisa la categoria y la paca de cada articulo.';
    end;
    if jsonb_typeof(v_item -> 'price_lines') is distinct from 'array'
      or jsonb_array_length(v_item -> 'price_lines') = 0 then
      raise exception 'Cada articulo necesita al menos una cantidad y precio.';
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
    if not found then raise exception 'Una paca no corresponde con la categoria seleccionada.'; end if;

    v_item_quantity := 0;
    for v_line in select value from jsonb_array_elements(v_item -> 'price_lines') loop
      if jsonb_typeof(v_line) is distinct from 'object'
        or jsonb_typeof(v_line -> 'quantity') is distinct from 'number'
        or jsonb_typeof(v_line -> 'unit_price') is distinct from 'number'
        or coalesce(v_line ->> 'quantity', '') !~ '^[1-9][0-9]*$' then
        raise exception 'Cada renglon necesita cantidad y precio numericos.';
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

  perform public.refresh_daily_summaries((v_sale.sold_at at time zone 'America/Guatemala')::date);
  return v_sale;
end;
$$;

create or replace function public.complete_sale_payment(p_sale_id uuid, p_payment_method text)
returns public.sales
language plpgsql security definer set search_path = public
as $$
declare
  v_sale public.sales;
  v_remaining numeric(12, 2);
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesion.'; end if;
  if p_payment_method not in ('cash', 'transfer', 'card', 'other') then raise exception 'Metodo de pago invalido.'; end if;
  select * into v_sale from public.sales where id = p_sale_id and owner_id = auth.uid() for update;
  if not found then raise exception 'No se encontro el pedido.'; end if;
  v_remaining := v_sale.total - v_sale.paid_amount;
  if v_remaining <= 0 then raise exception 'Este pedido ya esta pagado.'; end if;

  if v_sale.first_payment_amount = 0 then
    update public.sales set
      first_payment_amount = v_remaining,
      first_payment_method = p_payment_method,
      first_payment_at = timezone('utc', now()),
      paid_amount = total,
      payment_method = p_payment_method,
      payment_status = 'paid'
    where id = p_sale_id returning * into v_sale;
  else
    if v_sale.second_payment_amount > 0 then raise exception 'Este pedido ya tiene registrados sus dos pagos.'; end if;
    update public.sales set
      second_payment_amount = v_remaining,
      second_payment_method = p_payment_method,
      second_payment_at = timezone('utc', now()),
      paid_amount = total,
      payment_status = 'paid'
    where id = p_sale_id returning * into v_sale;
  end if;

  perform public.refresh_daily_summaries((now() at time zone 'America/Guatemala')::date);
  return v_sale;
end;
$$;

create or replace function public.update_sale_delivery_status(p_sale_id uuid, p_delivery_status text)
returns public.sales language plpgsql security definer set search_path = public as $$
declare v_sale public.sales;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesion.'; end if;
  if p_delivery_status not in ('to_prepare', 'ready', 'on_the_way', 'delivered') then raise exception 'Estado de entrega invalido.'; end if;
  select * into v_sale from public.sales where id = p_sale_id and owner_id = auth.uid() for update;
  if not found then raise exception 'No se encontro el pedido.'; end if;
  if v_sale.payment_status <> 'paid' then raise exception 'Primero registra el pago completo antes de preparar o entregar el pedido.'; end if;
  if v_sale.fulfillment_method = 'pickup' and p_delivery_status = 'on_the_way' then
    raise exception 'Un pedido que se recoge en tienda no pasa a En camino.';
  end if;
  update public.sales set delivery_status = p_delivery_status where id = p_sale_id returning * into v_sale;
  perform public.refresh_daily_summaries((now() at time zone 'America/Guatemala')::date);
  return v_sale;
end;
$$;

revoke execute on function public.register_sale_with_items(jsonb, text, uuid, text, timestamptz, text, text, numeric, numeric, numeric) from public, anon;
revoke execute on function public.complete_sale_payment(uuid, text) from public, anon;
revoke execute on function public.update_sale_delivery_status(uuid, text) from public, anon;
grant execute on function public.register_sale_with_items(jsonb, text, uuid, text, timestamptz, text, text, numeric, numeric, numeric) to authenticated;
grant execute on function public.complete_sale_payment(uuid, text) to authenticated;
grant execute on function public.update_sale_delivery_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;

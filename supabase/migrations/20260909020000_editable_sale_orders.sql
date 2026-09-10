-- Permite corregir un pedido completo sin perder pagos ni descuadrar inventario.
-- La edición reemplaza los artículos de forma atómica y recalcula sus totales.
begin;

create or replace function public.update_sale_order(
  p_sale_id uuid,
  p_items jsonb,
  p_customer_id uuid default null,
  p_fulfillment_method text default 'pickup',
  p_notes text default null,
  p_delivery_cost numeric default 0,
  p_delivery_charge numeric default 0
)
returns public.sales
language plpgsql security definer set search_path = public
as $$
declare
  v_sale public.sales;
  v_item jsonb;
  v_line jsonb;
  v_inventory record;
  v_inventory_id uuid;
  v_category_id uuid;
  v_sale_item_id uuid;
  v_line_quantity integer;
  v_line_price numeric(12, 2);
  v_item_quantity integer;
  v_total_merchandise numeric(12, 2) := 0;
  v_total_cost numeric(12, 2) := 0;
  v_total_due numeric(12, 2);
  v_item_count integer;
  v_distinct_inventory_count integer;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido necesita al menos un artículo.';
  end if;
  if p_fulfillment_method not in ('pickup', 'delivery') then raise exception 'Forma de entrega inválida.'; end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id and owner_id = auth.uid()
  for update;
  if not found then raise exception 'No se encontró el pedido.'; end if;
  if v_sale.delivery_status = 'delivered' then
    raise exception 'Un pedido entregado ya forma parte del historial y no se puede editar.';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and owner_id = auth.uid()
  ) then raise exception 'El cliente no existe o no te pertenece.'; end if;

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
    raise exception 'No repitas la misma categoría y paca; reúne sus precios en el mismo artículo.';
  end if;

  -- Valida el formato antes de bloquear o devolver existencias.
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
        raise exception 'Revisa las cantidades y precios del pedido.';
      end;
      if v_line_quantity < 1 or v_line_price <= 0 then
        raise exception 'Cada cantidad y precio debe ser mayor que cero.';
      end if;
      v_total_merchandise := v_total_merchandise + v_line_quantity * v_line_price;
    end loop;
  end loop;

  -- Bloquea en orden fijo tanto el inventario anterior como el nuevo.
  for v_inventory_id in
    select inventory_id from (
      select distinct a.bale_inventory_id as inventory_id
      from public.sale_items si
      join public.sale_item_allocations a on a.sale_item_id = si.id
      where si.sale_id = p_sale_id
      union
      select distinct (value ->> 'bale_inventory_id')::uuid
      from jsonb_array_elements(p_items)
    ) inventories
    order by inventory_id
  loop
    perform bi.id
    from public.bale_inventory bi
    join public.bales b on b.id = bi.bale_id
    where bi.id = v_inventory_id and b.owner_id = auth.uid()
    for update of bi;
    if not found then raise exception 'Una paca elegida no existe o no te pertenece.'; end if;
  end loop;

  -- Devuelve temporalmente las piezas del pedido anterior. Cualquier error
  -- posterior revierte toda la función y deja el pedido original intacto.
  update public.bale_inventory bi
  set sold_quantity = bi.sold_quantity - previous.quantity
  from (
    select a.bale_inventory_id, sum(a.quantity)::integer as quantity
    from public.sale_items si
    join public.sale_item_allocations a on a.sale_item_id = si.id
    where si.sale_id = p_sale_id
    group by a.bale_inventory_id
  ) previous
  where bi.id = previous.bale_inventory_id;

  delete from public.sale_items where sale_id = p_sale_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_inventory_id := (v_item ->> 'bale_inventory_id')::uuid;
    v_category_id := (v_item ->> 'category_id')::uuid;

    select bi.available_quantity, pricing.estimated_unit_cost, pricing.recommended_unit_price
    into v_inventory
    from public.bale_inventory bi
    join public.bales b on b.id = bi.bale_id
    join public.categories c on c.id = bi.category_id
    join public.bale_inventory_pricing pricing on pricing.id = bi.id
    where bi.id = v_inventory_id and bi.category_id = v_category_id
      and b.owner_id = auth.uid() and c.owner_id = auth.uid();
    if not found then raise exception 'Una paca no corresponde con la categoría seleccionada.'; end if;

    v_item_quantity := 0;
    for v_line in select value from jsonb_array_elements(v_item -> 'price_lines') loop
      v_line_quantity := (v_line ->> 'quantity')::integer;
      v_line_price := (v_line ->> 'unit_price')::numeric(12, 2);
      v_item_quantity := v_item_quantity + v_line_quantity;

      insert into public.sale_items (
        sale_id, category_id, quantity, unit_price,
        reference_unit_cost, recommended_unit_price
      ) values (
        p_sale_id, v_category_id, v_line_quantity, v_line_price,
        v_inventory.estimated_unit_cost, v_inventory.recommended_unit_price
      ) returning id into v_sale_item_id;
      insert into public.sale_item_allocations (sale_item_id, bale_inventory_id, quantity)
      values (v_sale_item_id, v_inventory_id, v_line_quantity);
    end loop;

    if v_item_quantity > v_inventory.available_quantity then
      raise exception 'La paca elegida solo tiene % piezas disponibles para este pedido.', v_inventory.available_quantity;
    end if;
    v_total_cost := v_total_cost + v_inventory.estimated_unit_cost * v_item_quantity;
    update public.bale_inventory
    set sold_quantity = sold_quantity + v_item_quantity
    where id = v_inventory_id;
  end loop;

  v_total_due := v_total_merchandise
    + case when p_fulfillment_method = 'delivery' then coalesce(p_delivery_charge, 0) else 0 end;

  if v_sale.paid_amount > v_total_due then
    raise exception 'El nuevo total es menor que lo ya pagado (%). Ajusta los artículos o registra primero la devolución.', v_sale.paid_amount;
  end if;
  if p_customer_id is null and v_sale.paid_amount < v_total_due then
    raise exception 'Elige un cliente para conservar un saldo pendiente.';
  end if;
  if v_sale.second_payment_amount > 0 and v_sale.paid_amount < v_total_due then
    raise exception 'El pedido ya tiene dos pagos. No puede quedar un saldo que necesite un tercer pago.';
  end if;

  update public.sales set
    customer_id = p_customer_id,
    fulfillment_method = p_fulfillment_method,
    merchandise_total = v_total_merchandise,
    delivery_cost = case when p_fulfillment_method = 'delivery' then p_delivery_cost else 0 end,
    delivery_charge = case when p_fulfillment_method = 'delivery' then coalesce(p_delivery_charge, 0) else 0 end,
    estimated_merchandise_cost = v_total_cost,
    total = v_total_due,
    payment_status = case
      when paid_amount = 0 then 'pending'
      when paid_amount = v_total_due then 'paid'
      else 'partial'
    end,
    delivery_status = case
      when p_fulfillment_method = 'pickup' and delivery_status = 'on_the_way' then 'ready'
      else delivery_status
    end,
    notes = nullif(trim(p_notes), '')
  where id = p_sale_id
  returning * into v_sale;

  perform public.refresh_daily_summaries((v_sale.sold_at at time zone 'America/Guatemala')::date);
  return v_sale;
end;
$$;

revoke execute on function public.update_sale_order(uuid, jsonb, uuid, text, text, numeric, numeric) from public, anon;
grant execute on function public.update_sale_order(uuid, jsonb, uuid, text, text, numeric, numeric) to authenticated;

notify pgrst, 'reload schema';
commit;

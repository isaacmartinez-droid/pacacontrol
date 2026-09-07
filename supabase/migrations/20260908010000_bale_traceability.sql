-- Permite elegir una paca concreta al vender, sin quitar la asignación automática.
create or replace function public.register_sale(
  p_category_id uuid,
  p_quantity integer,
  p_unit_price numeric,
  p_payment_method text,
  p_customer_id uuid default null,
  p_sold_at timestamptz default timezone('utc', now()),
  p_notes text default null,
  p_bale_inventory_id uuid default null
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
  v_sale_item_id uuid;
  v_inventory record;
  v_remaining integer := p_quantity;
  v_allocated integer;
  v_available integer;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión para registrar una venta.'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'La cantidad debe ser mayor que cero.'; end if;
  if p_unit_price is null or p_unit_price <= 0 then raise exception 'El precio por pieza debe ser mayor que cero.'; end if;
  if p_payment_method not in ('cash', 'transfer', 'card', 'other') then raise exception 'Método de pago inválido.'; end if;
  if not exists (select 1 from public.categories where id = p_category_id and owner_id = auth.uid()) then raise exception 'La categoría no existe o no te pertenece.'; end if;
  if p_customer_id is not null and not exists (select 1 from public.customers where id = p_customer_id and owner_id = auth.uid()) then raise exception 'El cliente no existe o no te pertenece.'; end if;

  if p_bale_inventory_id is not null then
    select bi.id, bi.available_quantity into v_inventory
    from public.bale_inventory bi join public.bales b on b.id = bi.bale_id
    where bi.id = p_bale_inventory_id and bi.category_id = p_category_id and b.owner_id = auth.uid()
    for update of bi;
    if not found then raise exception 'La paca elegida no corresponde a esta categoría o no te pertenece.'; end if;
    if v_inventory.available_quantity < p_quantity then raise exception 'La paca elegida solo tiene % piezas disponibles.', v_inventory.available_quantity; end if;
  else
    select coalesce(sum(bi.available_quantity), 0) into v_available
    from public.bale_inventory bi join public.bales b on b.id = bi.bale_id
    where b.owner_id = auth.uid() and bi.category_id = p_category_id;
    if v_available < p_quantity then raise exception 'Inventario insuficiente: hay % piezas disponibles.', v_available; end if;
  end if;

  insert into public.sales (owner_id, customer_id, payment_method, sold_at, total, notes)
  values (auth.uid(), p_customer_id, p_payment_method, coalesce(p_sold_at, timezone('utc', now())), p_quantity * p_unit_price, p_notes)
  returning * into v_sale;
  insert into public.sale_items (sale_id, category_id, quantity, unit_price)
  values (v_sale.id, p_category_id, p_quantity, p_unit_price) returning id into v_sale_item_id;

  if p_bale_inventory_id is not null then
    update public.bale_inventory set sold_quantity = sold_quantity + p_quantity where id = v_inventory.id;
    insert into public.sale_item_allocations (sale_item_id, bale_inventory_id, quantity)
    values (v_sale_item_id, v_inventory.id, p_quantity);
  else
    for v_inventory in
      select bi.id, bi.available_quantity from public.bale_inventory bi join public.bales b on b.id = bi.bale_id
      where b.owner_id = auth.uid() and bi.category_id = p_category_id and bi.available_quantity > 0
      order by b.purchase_date, b.created_at, bi.created_at for update of bi
    loop
      exit when v_remaining = 0;
      v_allocated := least(v_remaining, v_inventory.available_quantity);
      update public.bale_inventory set sold_quantity = sold_quantity + v_allocated where id = v_inventory.id;
      insert into public.sale_item_allocations (sale_item_id, bale_inventory_id, quantity) values (v_sale_item_id, v_inventory.id, v_allocated);
      v_remaining := v_remaining - v_allocated;
    end loop;
  end if;
  return v_sale;
end;
$$;

grant execute on function public.register_sale(uuid, integer, numeric, text, uuid, timestamptz, text, uuid) to authenticated;

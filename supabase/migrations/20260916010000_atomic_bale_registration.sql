-- La paca, sus categorías, inventario y daños se crean en una transacción RPC.
begin;
create or replace function public.create_bale_with_inventory(
  p_purchase_date date,
  p_purchase_cost numeric,
  p_transport_cost numeric,
  p_other_expenses numeric,
  p_target_profit_amount numeric,
  p_category_entries jsonb
)
returns public.bales language plpgsql security definer set search_path = public as $$
declare
  v_bale public.bales;
  v_entry jsonb;
  v_name text;
  v_names text[] := array[]::text[];
  v_quantity integer;
  v_damaged integer;
  v_total integer := 0;
  v_price_level text;
  v_custom_price numeric(12, 2);
  v_category_id uuid;
  v_inventory_id uuid;
begin
  if auth.uid() is null or not public.current_account_is_active() then
    raise exception 'Esta cuenta no tiene acceso activo.' using errcode = '42501';
  end if;
  if p_purchase_date is null or p_purchase_cost is null or p_purchase_cost <= 0
    or p_purchase_cost::text in ('NaN', 'Infinity', '-Infinity')
    or p_transport_cost is null or p_transport_cost < 0 or p_transport_cost::text in ('NaN', 'Infinity', '-Infinity')
    or p_other_expenses is null or p_other_expenses < 0 or p_other_expenses::text in ('NaN', 'Infinity', '-Infinity')
    or p_target_profit_amount is null or p_target_profit_amount < 0 or p_target_profit_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Revisa la fecha, costos y ganancia deseada de la paca.';
  end if;
  if jsonb_typeof(p_category_entries) is distinct from 'array' then
    raise exception 'Agrega las categorías de la paca.';
  end if;
  if jsonb_array_length(p_category_entries) not between 1 and 100 then
    raise exception 'La paca necesita entre 1 y 100 categorías.';
  end if;
  for v_entry in select value from jsonb_array_elements(p_category_entries) loop
    v_name := regexp_replace(trim(v_entry ->> 'name'), '\s+', ' ', 'g');
    if jsonb_typeof(v_entry) is distinct from 'object' or v_name is null
      or char_length(v_name) not between 1 and 80 or lower(v_name) = any(v_names) then
      raise exception 'Revisa los nombres de categorías; no pueden repetirse.';
    end if;
    v_names := array_append(v_names, lower(v_name));
    if jsonb_typeof(v_entry -> 'quantity') is distinct from 'number'
      or coalesce(v_entry ->> 'quantity', '') !~ '^[1-9][0-9]*$'
      or jsonb_typeof(v_entry -> 'damagedPieces') is distinct from 'number'
      or coalesce(v_entry ->> 'damagedPieces', '') !~ '^[0-9]+$' then
      raise exception 'Las cantidades deben ser números enteros; revisa los daños.';
    end if;
    v_quantity := (v_entry ->> 'quantity')::integer;
    v_damaged := (v_entry ->> 'damagedPieces')::integer;
    if v_damaged > v_quantity or (v_damaged > 0 and nullif(trim(v_entry ->> 'damageReason'), '') is null) then
      raise exception 'Revisa la cantidad y el motivo de daños de %.', v_name;
    end if;
    v_price_level := v_entry ->> 'priceLevel';
    if v_price_level is null or v_price_level not in ('economic', 'standard', 'premium', 'custom') then
      raise exception 'Nivel de precio inválido.';
    end if;
    if v_price_level = 'custom' then
      v_custom_price := (v_entry ->> 'customRecommendedPrice')::numeric(12, 2);
      if v_custom_price is null or v_custom_price <= 0 or v_custom_price::text in ('NaN', 'Infinity', '-Infinity') then
        raise exception 'Revisa el precio personalizado de %.', v_name;
      end if;
    end if;
    v_total := v_total + v_quantity;
  end loop;

  -- Serializa creación de categorías del mismo negocio sin bloquear otros.
  perform id from public.profiles where id = auth.uid() for update;
  insert into public.bales(owner_id, purchase_date, purchase_cost, transport_cost,
    other_expenses, received_pieces, target_profit_amount)
  values(auth.uid(), p_purchase_date, p_purchase_cost, p_transport_cost,
    p_other_expenses, v_total, p_target_profit_amount) returning * into v_bale;

  for v_entry in select value from jsonb_array_elements(p_category_entries) loop
    v_name := regexp_replace(trim(v_entry ->> 'name'), '\s+', ' ', 'g');
    v_category_id := null;
    select id into v_category_id from public.categories
      where owner_id = auth.uid() and lower(name) = lower(v_name) order by created_at, id limit 1;
    if v_category_id is null then
      insert into public.categories(owner_id, slug, name)
      values(auth.uid(), 'categoria-' || gen_random_uuid()::text, v_name)
      returning id into v_category_id;
    end if;
    v_price_level := v_entry ->> 'priceLevel';
    insert into public.bale_inventory(bale_id, category_id, received_quantity, price_level, custom_recommended_price)
    values(v_bale.id, v_category_id, (v_entry ->> 'quantity')::integer, v_price_level,
      case when v_price_level = 'custom' then (v_entry ->> 'customRecommendedPrice')::numeric else null end)
    returning id into v_inventory_id;
    v_damaged := (v_entry ->> 'damagedPieces')::integer;
    if v_damaged > 0 then
      perform public.register_damaged_product(v_inventory_id, v_damaged, trim(v_entry ->> 'damageReason'));
    end if;
  end loop;
  return v_bale;
end;
$$;
revoke execute on function public.create_bale_with_inventory(date, numeric, numeric, numeric, numeric, jsonb) from public, anon;
grant execute on function public.create_bale_with_inventory(date, numeric, numeric, numeric, numeric, jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;

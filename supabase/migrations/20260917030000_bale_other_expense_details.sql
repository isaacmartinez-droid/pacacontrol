-- Desglose explicable de otros gastos de compra, sin inventar conceptos históricos.
begin;

create table if not exists public.bale_other_expense_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  bale_id uuid not null references public.bales(id) on delete cascade,
  concept text not null check (char_length(trim(concept)) between 1 and 160),
  amount numeric(12, 2) not null check (amount > 0),
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (bale_id, sort_order)
);

create index if not exists bale_other_expense_items_owner_idx
  on public.bale_other_expense_items(owner_id, bale_id, sort_order);

drop trigger if exists bale_other_expense_items_set_updated_at on public.bale_other_expense_items;
create trigger bale_other_expense_items_set_updated_at
before update on public.bale_other_expense_items
for each row execute procedure public.set_updated_at();

-- Aplica a la tabla nueva la misma defensa usada por los demás registros del negocio.
drop trigger if exists business_write_access on public.bale_other_expense_items;
create trigger business_write_access
before insert or update or delete on public.bale_other_expense_items
for each row execute function public.enforce_business_write_access();

create or replace function public.validate_bale_other_expense_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner_id uuid;
  v_archived_at timestamptz;
begin
  if tg_op = 'DELETE' then return old; end if;
  select owner_id, archived_at into v_owner_id, v_archived_at
  from public.bales where id = new.bale_id;
  if v_owner_id is null or v_owner_id is distinct from new.owner_id then
    raise exception 'El gasto y la compra deben pertenecer al mismo negocio.' using errcode = '23514';
  end if;
  if v_archived_at is not null then
    raise exception 'Reactiva la compra antes de corregir sus otros gastos.';
  end if;
  return new;
end;
$$;
revoke execute on function public.validate_bale_other_expense_item() from public, anon, authenticated;

drop trigger if exists bale_other_expense_items_validate_owner on public.bale_other_expense_items;
create trigger bale_other_expense_items_validate_owner
before insert or update on public.bale_other_expense_items
for each row execute function public.validate_bale_other_expense_item();

alter table public.bale_other_expense_items enable row level security;
drop policy if exists "Users read their bale other expense items" on public.bale_other_expense_items;
create policy "Users read their bale other expense items"
on public.bale_other_expense_items for select to authenticated
using (owner_id = (select auth.uid()) and public.current_account_is_active());

revoke all on public.bale_other_expense_items from public, anon, authenticated;
grant select on public.bale_other_expense_items to authenticated;
grant all on public.bale_other_expense_items to service_role;

-- Valida el arreglo completo antes de crear o modificar cualquier registro.
create or replace function public.bale_other_expense_total(p_items jsonb)
returns numeric language plpgsql immutable set search_path = public as $$
declare
  v_item jsonb;
  v_concept text;
  v_amount numeric;
  v_total numeric := 0;
begin
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Los otros gastos deben enviarse como una lista.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Una compra admite como máximo 50 conceptos de otros gastos.';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or jsonb_typeof(v_item -> 'amount') is distinct from 'number' then
      raise exception 'Cada otro gasto necesita concepto y monto.';
    end if;
    v_concept := regexp_replace(trim(v_item ->> 'concept'), '\s+', ' ', 'g');
    begin
      v_amount := round((v_item ->> 'amount')::numeric, 2);
    exception when others then
      raise exception 'Revisa los montos de otros gastos.';
    end;
    if v_concept is null or char_length(v_concept) not between 1 and 160
      or v_amount <= 0 or v_amount >= 10000000000
      or v_amount::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'Cada otro gasto necesita un concepto y un monto mayor que cero.';
    end if;
    v_total := v_total + v_amount;
    if v_total >= 10000000000 then
      raise exception 'El total de otros gastos es demasiado grande.';
    end if;
  end loop;
  return round(v_total, 2);
end;
$$;
revoke execute on function public.bale_other_expense_total(jsonb) from public, anon, authenticated;

-- Cuando una compra ya tiene desglose, ese desglose es la fuente de su total.
-- Esto impide que clientes antiguos cambien solo el agregado y lo descuadren.
create or replace function public.enforce_bale_other_expense_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_detail_total numeric;
begin
  select sum(amount) into v_detail_total
  from public.bale_other_expense_items where bale_id = new.id;
  if v_detail_total is not null and new.other_expenses is distinct from v_detail_total then
    raise exception 'Los otros gastos de esta compra deben corregirse mediante su desglose.';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_bale_other_expense_total() from public, anon, authenticated;

drop trigger if exists bales_enforce_other_expense_total on public.bales;
create trigger bales_enforce_other_expense_total
before update of other_expenses on public.bales
for each row execute function public.enforce_bale_other_expense_total();

create or replace function public.create_bale_with_expense_details(
  p_purchase_date date,
  p_purchase_cost numeric,
  p_transport_cost numeric,
  p_target_profit_amount numeric,
  p_category_entries jsonb,
  p_other_expense_items jsonb default '[]'::jsonb
)
returns public.bales language plpgsql security definer set search_path = public as $$
declare
  v_bale public.bales;
  v_item jsonb;
  v_order integer := 0;
  v_other_expenses numeric;
begin
  if auth.uid() is null or not public.current_account_is_active() then
    raise exception 'Esta cuenta no tiene acceso activo.' using errcode = '42501';
  end if;
  v_other_expenses := public.bale_other_expense_total(p_other_expense_items);

  select * into v_bale from public.create_bale_with_inventory(
    p_purchase_date, p_purchase_cost, p_transport_cost, v_other_expenses,
    p_target_profit_amount, p_category_entries
  );

  for v_item in select value from jsonb_array_elements(p_other_expense_items) loop
    insert into public.bale_other_expense_items(owner_id, bale_id, concept, amount, sort_order)
    values (
      auth.uid(), v_bale.id,
      regexp_replace(trim(v_item ->> 'concept'), '\s+', ' ', 'g'),
      round((v_item ->> 'amount')::numeric, 2), v_order
    );
    v_order := v_order + 1;
  end loop;
  return v_bale;
end;
$$;

create or replace function public.update_bale_with_expense_details(
  p_bale_id uuid,
  p_purchase_date date,
  p_purchase_cost numeric,
  p_transport_cost numeric,
  p_target_profit_amount numeric,
  p_inventory_lines jsonb,
  p_other_expense_items jsonb default null,
  p_notes text default null
)
returns public.bales language plpgsql security definer set search_path = public as $$
declare
  v_before_bale public.bales;
  v_after_bale public.bales;
  v_before jsonb;
  v_after jsonb;
  v_item jsonb;
  v_order integer := 0;
  v_other_expenses numeric;
begin
  if auth.uid() is null or not public.current_account_is_active() then
    raise exception 'Esta cuenta no tiene acceso activo.' using errcode = '42501';
  end if;
  select * into v_before_bale from public.bales
  where id = p_bale_id and owner_id = auth.uid() for update;
  if not found then raise exception 'No se encontró la compra.'; end if;

  select jsonb_build_object(
    'bale', to_jsonb(v_before_bale),
    'other_expense_items', coalesce(jsonb_agg(to_jsonb(e) order by e.sort_order, e.id), '[]'::jsonb)
  ) into v_before
  from public.bale_other_expense_items e where e.bale_id = p_bale_id;

  if p_other_expense_items is null then
    -- Una compra histórica conserva su total agregado hasta que el usuario decida desglosarlo.
    v_other_expenses := v_before_bale.other_expenses;
  else
    v_other_expenses := public.bale_other_expense_total(p_other_expense_items);
  end if;

  if p_other_expense_items is not null then
    delete from public.bale_other_expense_items where bale_id = p_bale_id;
    for v_item in select value from jsonb_array_elements(p_other_expense_items) loop
      insert into public.bale_other_expense_items(owner_id, bale_id, concept, amount, sort_order)
      values (
        auth.uid(), p_bale_id,
        regexp_replace(trim(v_item ->> 'concept'), '\s+', ' ', 'g'),
        round((v_item ->> 'amount')::numeric, 2), v_order
      );
      v_order := v_order + 1;
    end loop;
  end if;

  select * into v_after_bale from public.update_bale_details_with_profit(
    p_bale_id, p_purchase_date, p_purchase_cost, p_transport_cost,
    v_other_expenses, p_target_profit_amount, p_inventory_lines, p_notes
  );

  select jsonb_build_object(
    'bale', to_jsonb(v_after_bale),
    'other_expense_items', coalesce(jsonb_agg(to_jsonb(e) order by e.sort_order, e.id), '[]'::jsonb)
  ) into v_after
  from public.bale_other_expense_items e where e.bale_id = p_bale_id;

  insert into public.business_history(
    owner_id, entity_type, entity_id, action, description, before_state, after_state
  ) values (
    auth.uid(), 'bale', p_bale_id, 'purchase_corrected',
    'Compra corregida; se conservaron sus movimientos y se actualizaron sus costos.',
    v_before, v_after
  );
  return v_after_bale;
end;
$$;

revoke execute on function public.create_bale_with_expense_details(date,numeric,numeric,numeric,jsonb,jsonb) from public, anon;
revoke execute on function public.update_bale_with_expense_details(uuid,date,numeric,numeric,numeric,jsonb,jsonb,text) from public, anon;
grant execute on function public.create_bale_with_expense_details(date,numeric,numeric,numeric,jsonb,jsonb) to authenticated;
grant execute on function public.update_bale_with_expense_details(uuid,date,numeric,numeric,numeric,jsonb,jsonb,text) to authenticated;

notify pgrst, 'reload schema';
commit;

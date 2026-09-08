-- Historial financiero simple por cliente: un pago inicial y un pago final.
-- El delivery se incorpora al total y a la utilidad real de cada pedido.
begin;

alter table public.sales
  add column if not exists merchandise_total numeric(12, 2),
  add column if not exists delivery_cost numeric(12, 2) not null default 0,
  add column if not exists delivery_charge numeric(12, 2) not null default 0,
  add column if not exists estimated_merchandise_cost numeric(12, 2) not null default 0,
  add column if not exists first_payment_amount numeric(12, 2) not null default 0,
  add column if not exists first_payment_method text,
  add column if not exists first_payment_at timestamptz,
  add column if not exists second_payment_amount numeric(12, 2) not null default 0,
  add column if not exists second_payment_method text,
  add column if not exists second_payment_at timestamptz;

update public.sales
set merchandise_total = total,
    first_payment_amount = paid_amount,
    first_payment_method = case when paid_amount > 0 then payment_method else null end,
    first_payment_at = case when paid_amount > 0 then sold_at else null end
where merchandise_total is null;

with bale_costs as (
  select b.id,
    (b.purchase_cost + b.transport_cost + b.other_expenses)
      / nullif(greatest(b.received_pieces - coalesce(sum(bi.damaged_quantity), 0), 0), 0) as unit_cost
  from public.bales b
  left join public.bale_inventory bi on bi.bale_id = b.id
  group by b.id
), sale_costs as (
  select si.sale_id, coalesce(sum(a.quantity * bc.unit_cost), 0) as estimated_cost
  from public.sale_items si
  join public.sale_item_allocations a on a.sale_item_id = si.id
  join public.bale_inventory bi on bi.id = a.bale_inventory_id
  join bale_costs bc on bc.id = bi.bale_id
  group by si.sale_id
)
update public.sales s
set estimated_merchandise_cost = sc.estimated_cost
from sale_costs sc
where sc.sale_id = s.id and s.estimated_merchandise_cost = 0;

alter table public.sales alter column merchandise_total set not null;
alter table public.sales drop constraint if exists sales_delivery_cost_check;
alter table public.sales drop constraint if exists sales_delivery_charge_check;
alter table public.sales drop constraint if exists sales_first_payment_check;
alter table public.sales drop constraint if exists sales_second_payment_check;
alter table public.sales drop constraint if exists sales_payment_methods_check;
alter table public.sales drop constraint if exists sales_financial_totals_check;
alter table public.sales drop constraint if exists sales_payment_history_check;
alter table public.sales add constraint sales_delivery_cost_check check (delivery_cost >= 0);
alter table public.sales add constraint sales_delivery_charge_check check (delivery_charge >= 0);
alter table public.sales add constraint sales_first_payment_check check (first_payment_amount >= 0 and first_payment_amount <= total);
alter table public.sales add constraint sales_second_payment_check check (
  second_payment_amount >= 0 and first_payment_amount + second_payment_amount <= total
);
alter table public.sales add constraint sales_payment_methods_check check (
  (first_payment_method is null or first_payment_method in ('cash', 'transfer', 'card', 'other'))
  and (second_payment_method is null or second_payment_method in ('cash', 'transfer', 'card', 'other'))
);
alter table public.sales add constraint sales_financial_totals_check check (
  merchandise_total >= 0 and estimated_merchandise_cost >= 0
  and total = merchandise_total + delivery_charge
);
alter table public.sales add constraint sales_payment_history_check check (
  paid_amount = first_payment_amount + second_payment_amount
  and ((first_payment_amount = 0 and first_payment_method is null and first_payment_at is null)
    or (first_payment_amount > 0 and first_payment_method is not null and first_payment_at is not null))
  and ((second_payment_amount = 0 and second_payment_method is null and second_payment_at is null)
    or (second_payment_amount > 0 and second_payment_method is not null and second_payment_at is not null))
  and ((payment_status = 'pending' and paid_amount = 0)
    or (payment_status = 'partial' and paid_amount > 0 and paid_amount < total)
    or (payment_status = 'paid' and paid_amount = total))
);

drop function if exists public.register_sale(uuid, integer, numeric, text, uuid, timestamptz, text, uuid, text, numeric);
create function public.register_sale(
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

  select bi.id, bi.available_quantity,
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
    coalesce(v_inventory.unit_cost, 0) * p_quantity, v_first_payment,
    case when v_first_payment > 0 then p_payment_method else null end,
    case when v_first_payment > 0 then timezone('utc', now()) else null end,
    p_notes
  ) returning * into v_sale;

  insert into public.sale_items (sale_id, category_id, quantity, unit_price)
  values (v_sale.id, p_category_id, p_quantity, p_unit_price)
  returning id into v_sale_item_id;
  update public.bale_inventory set sold_quantity = sold_quantity + p_quantity where id = v_inventory.id;
  insert into public.sale_item_allocations (sale_item_id, bale_inventory_id, quantity)
  values (v_sale_item_id, v_inventory.id, p_quantity);
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
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_payment_method not in ('cash', 'transfer', 'card', 'other') then raise exception 'Método de pago inválido.'; end if;
  select * into v_sale from public.sales where id = p_sale_id and owner_id = auth.uid() for update;
  if not found then raise exception 'No se encontró el pedido.'; end if;
  v_remaining := v_sale.total - v_sale.paid_amount;
  if v_remaining <= 0 then raise exception 'Este pedido ya está pagado.'; end if;

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
  return v_sale;
end;
$$;

-- Compatibilidad temporal con la pantalla anterior: únicamente permite completar.
create or replace function public.update_sale_payment(p_sale_id uuid, p_payment_status text, p_paid_amount numeric, p_payment_method text)
returns public.sales language plpgsql security definer set search_path = public as $$
begin
  if p_payment_status <> 'paid' then raise exception 'Los pagos parciales solo se registran como primer pago al crear la venta.'; end if;
  return public.complete_sale_payment(p_sale_id, p_payment_method);
end;
$$;

alter table public.daily_summaries
  add column if not exists orders_total numeric(12, 2) not null default 0,
  add column if not exists delivery_cost_total numeric(12, 2) not null default 0,
  add column if not exists delivery_charge_total numeric(12, 2) not null default 0,
  add column if not exists pending_receivables numeric(12, 2) not null default 0;

create or replace function public.refresh_daily_summaries(
  p_summary_date date default ((now() at time zone 'America/Guatemala')::date - 1)
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner_id uuid;
  v_start timestamptz := p_summary_date::timestamp at time zone 'America/Guatemala';
  v_end timestamptz := (p_summary_date + 1)::timestamp at time zone 'America/Guatemala';
begin
  for v_owner_id in select id from public.profiles loop
    insert into public.daily_summaries (
      owner_id, summary_date, sales_total, cash_total, transfer_total, card_total, other_total,
      pieces_sold, damaged_pieces, estimated_cost, estimated_profit, expenses_total, net_result,
      pending_deliveries, orders_total, delivery_cost_total, delivery_charge_total,
      pending_receivables, generated_at, updated_at
    )
    with orders_for_day as (
      select * from public.sales
      where owner_id = v_owner_id and sold_at >= v_start and sold_at < v_end
    ), payments_for_day as (
      select first_payment_amount as amount, first_payment_method as method from public.sales
      where owner_id = v_owner_id and first_payment_at >= v_start and first_payment_at < v_end and first_payment_amount > 0
      union all
      select second_payment_amount, second_payment_method from public.sales
      where owner_id = v_owner_id and second_payment_at >= v_start and second_payment_at < v_end and second_payment_amount > 0
    ), payment_totals as (
      select coalesce(sum(amount), 0) as collected,
        coalesce(sum(amount) filter (where method = 'cash'), 0) as cash,
        coalesce(sum(amount) filter (where method = 'transfer'), 0) as transfer,
        coalesce(sum(amount) filter (where method = 'card'), 0) as card,
        coalesce(sum(amount) filter (where method = 'other'), 0) as other
      from payments_for_day
    ), order_totals as (
      select coalesce(sum(total), 0) as orders_total,
        coalesce(sum(delivery_cost), 0) as delivery_cost,
        coalesce(sum(delivery_charge), 0) as delivery_charge,
        coalesce(sum(estimated_merchandise_cost), 0) as estimated_cost
      from orders_for_day
    ), sold_items as (
      select coalesce(sum(si.quantity), 0)::integer as pieces_sold
      from public.sale_items si join orders_for_day s on s.id = si.sale_id
    ), day_expenses as (
      select coalesce(sum(amount), 0) as expenses from public.expenses
      where owner_id = v_owner_id and expense_date = p_summary_date
    ), day_damage as (
      select coalesce(sum(quantity), 0)::integer as damaged from public.damaged_products
      where owner_id = v_owner_id and reported_at >= v_start and reported_at < v_end
    ), open_totals as (
      select (count(*) filter (where customer_id is not null and delivery_status <> 'delivered'))::integer as deliveries,
        coalesce(sum(total - paid_amount) filter (where payment_status <> 'paid'), 0) as receivables
      from public.sales where owner_id = v_owner_id and sold_at < v_end
    )
    select v_owner_id, p_summary_date, pt.collected, pt.cash, pt.transfer, pt.card, pt.other,
      si.pieces_sold, dd.damaged, ot.estimated_cost,
      ot.orders_total - ot.estimated_cost - ot.delivery_cost,
      de.expenses, ot.orders_total - ot.estimated_cost - ot.delivery_cost - de.expenses,
      op.deliveries, ot.orders_total, ot.delivery_cost, ot.delivery_charge, op.receivables,
      timezone('utc', now()), timezone('utc', now())
    from payment_totals pt cross join order_totals ot cross join sold_items si
    cross join day_expenses de cross join day_damage dd cross join open_totals op
    on conflict (owner_id, summary_date) do update set
      sales_total = excluded.sales_total, cash_total = excluded.cash_total,
      transfer_total = excluded.transfer_total, card_total = excluded.card_total,
      other_total = excluded.other_total, pieces_sold = excluded.pieces_sold,
      damaged_pieces = excluded.damaged_pieces, estimated_cost = excluded.estimated_cost,
      estimated_profit = excluded.estimated_profit, expenses_total = excluded.expenses_total,
      net_result = excluded.net_result, pending_deliveries = excluded.pending_deliveries,
      orders_total = excluded.orders_total, delivery_cost_total = excluded.delivery_cost_total,
      delivery_charge_total = excluded.delivery_charge_total,
      pending_receivables = excluded.pending_receivables,
      generated_at = excluded.generated_at, updated_at = excluded.updated_at;
  end loop;
end;
$$;

grant execute on function public.register_sale(uuid, integer, numeric, text, uuid, timestamptz, text, uuid, text, numeric, numeric, numeric) to authenticated;
grant execute on function public.complete_sale_payment(uuid, text) to authenticated;
grant execute on function public.update_sale_payment(uuid, text, numeric, text) to authenticated;
revoke update(payment_status, paid_amount, payment_method) on public.sales from authenticated;
select public.refresh_daily_summaries(((now() at time zone 'America/Guatemala')::date - 1));
notify pgrst, 'reload schema';
commit;

-- Los gastos reales y cobros adicionales actualizan el cierre diario.
begin;

create or replace function public.refresh_daily_summaries(
  p_summary_date date default ((now() at time zone 'America/Guatemala')::date - 1)
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner_id uuid;
  v_start timestamptz := p_summary_date::timestamp at time zone 'America/Guatemala';
  v_end timestamptz := (p_summary_date + 1)::timestamp at time zone 'America/Guatemala';
begin
  for v_owner_id in select id from public.profiles where auth.uid() is null or id = auth.uid() loop
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
      union all
      select amount, method from public.sale_additional_payments
      where owner_id = v_owner_id and paid_at >= v_start and paid_at < v_end
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
      select (count(*) filter (where fulfillment_method = 'delivery' and delivery_status <> 'delivered'
        and exists (
          select 1 from public.sale_items si
          join public.sale_item_allocations a on a.sale_item_id = si.id
          join public.bale_inventory bi on bi.id = a.bale_inventory_id
          join public.bales b on b.id = bi.bale_id
          where si.sale_id = sales.id and b.archived_at is null
        )))::integer as deliveries,
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

revoke execute on function public.refresh_daily_summaries(date) from public, anon;
grant execute on function public.refresh_daily_summaries(date) to authenticated, service_role;

create or replace function public.refresh_expense_daily_summaries()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_daily_summaries(old.expense_date);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_daily_summaries(new.expense_date);
  end if;
  return null;
end;
$$;

drop trigger if exists expenses_refresh_daily_summaries on public.expenses;
create trigger expenses_refresh_daily_summaries
after insert or update or delete on public.expenses
for each row execute procedure public.refresh_expense_daily_summaries();
revoke execute on function public.refresh_expense_daily_summaries() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;

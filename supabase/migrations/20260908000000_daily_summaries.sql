-- Cierres diarios automáticos. Los días se calculan en hora de Guatemala.
create table if not exists public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  summary_date date not null,
  sales_total numeric(12, 2) not null default 0 check (sales_total >= 0),
  cash_total numeric(12, 2) not null default 0 check (cash_total >= 0),
  transfer_total numeric(12, 2) not null default 0 check (transfer_total >= 0),
  card_total numeric(12, 2) not null default 0 check (card_total >= 0),
  other_total numeric(12, 2) not null default 0 check (other_total >= 0),
  pieces_sold integer not null default 0 check (pieces_sold >= 0),
  damaged_pieces integer not null default 0 check (damaged_pieces >= 0),
  estimated_cost numeric(12, 2) not null default 0 check (estimated_cost >= 0),
  estimated_profit numeric(12, 2) not null default 0,
  expenses_total numeric(12, 2) not null default 0 check (expenses_total >= 0),
  net_result numeric(12, 2) not null default 0,
  pending_deliveries integer not null default 0 check (pending_deliveries >= 0),
  generated_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, summary_date)
);

create index if not exists daily_summaries_owner_date_idx
  on public.daily_summaries(owner_id, summary_date desc);

create or replace function public.refresh_daily_summaries(
  p_summary_date date default ((now() at time zone 'America/Guatemala')::date - 1)
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_start timestamptz := p_summary_date::timestamp at time zone 'America/Guatemala';
  v_end timestamptz := (p_summary_date + 1)::timestamp at time zone 'America/Guatemala';
begin
  for v_owner_id in select id from public.profiles loop
    insert into public.daily_summaries (
      owner_id, summary_date, sales_total, cash_total, transfer_total, card_total, other_total,
      pieces_sold, damaged_pieces, estimated_cost, estimated_profit, expenses_total, net_result,
      pending_deliveries, generated_at, updated_at
    )
    with sales_for_day as (
      select id, payment_method, total
      from public.sales
      where owner_id = v_owner_id and sold_at >= v_start and sold_at < v_end
    ),
    sale_totals as (
      select
        coalesce(sum(total), 0) as sales_total,
        coalesce(sum(total) filter (where payment_method = 'cash'), 0) as cash_total,
        coalesce(sum(total) filter (where payment_method = 'transfer'), 0) as transfer_total,
        coalesce(sum(total) filter (where payment_method = 'card'), 0) as card_total,
        coalesce(sum(total) filter (where payment_method = 'other'), 0) as other_total
      from sales_for_day
    ),
    bale_costs as (
      select
        b.id,
        b.purchase_cost + b.transport_cost + b.other_expenses as total_investment,
        greatest(b.received_pieces - coalesce(sum(bi.damaged_quantity), 0), 0) as sellable_pieces
      from public.bales b
      left join public.bale_inventory bi on bi.bale_id = b.id
      where b.owner_id = v_owner_id
      group by b.id
    ),
    sold_items as (
      select coalesce(sum(si.quantity), 0)::integer as pieces_sold
      from public.sale_items si
      join sales_for_day s on s.id = si.sale_id
    ),
    allocated_cost as (
      select coalesce(sum(a.quantity * bc.total_investment / nullif(bc.sellable_pieces, 0)), 0) as estimated_cost
      from public.sale_item_allocations a
      join public.sale_items si on si.id = a.sale_item_id
      join sales_for_day s on s.id = si.sale_id
      join public.bale_inventory bi on bi.id = a.bale_inventory_id
      join bale_costs bc on bc.id = bi.bale_id
    ),
    day_expenses as (
      select coalesce(sum(amount), 0) as expenses_total
      from public.expenses
      where owner_id = v_owner_id and expense_date = p_summary_date
    ),
    day_damage as (
      select coalesce(sum(quantity), 0)::integer as damaged_pieces
      from public.damaged_products
      where owner_id = v_owner_id and reported_at >= v_start and reported_at < v_end
    ),
    open_deliveries as (
      select count(*)::integer as pending_deliveries
      from public.sales
      where owner_id = v_owner_id
        and customer_id is not null
        and sold_at < v_end
        and coalesce(delivery_status, 'paid') <> 'delivered'
    )
    select
      v_owner_id, p_summary_date, st.sales_total, st.cash_total, st.transfer_total, st.card_total, st.other_total,
      si.pieces_sold, dd.damaged_pieces, ac.estimated_cost, st.sales_total - ac.estimated_cost,
      de.expenses_total, st.sales_total - ac.estimated_cost - de.expenses_total, od.pending_deliveries,
      timezone('utc', now()), timezone('utc', now())
    from sale_totals st
    cross join sold_items si
    cross join allocated_cost ac
    cross join day_expenses de
    cross join day_damage dd
    cross join open_deliveries od
    on conflict (owner_id, summary_date) do update set
      sales_total = excluded.sales_total,
      cash_total = excluded.cash_total,
      transfer_total = excluded.transfer_total,
      card_total = excluded.card_total,
      other_total = excluded.other_total,
      pieces_sold = excluded.pieces_sold,
      damaged_pieces = excluded.damaged_pieces,
      estimated_cost = excluded.estimated_cost,
      estimated_profit = excluded.estimated_profit,
      expenses_total = excluded.expenses_total,
      net_result = excluded.net_result,
      pending_deliveries = excluded.pending_deliveries,
      generated_at = excluded.generated_at,
      updated_at = excluded.updated_at;
  end loop;
end;
$$;

drop trigger if exists daily_summaries_set_updated_at on public.daily_summaries;
create trigger daily_summaries_set_updated_at before update on public.daily_summaries
for each row execute procedure public.set_updated_at();

alter table public.daily_summaries enable row level security;
drop policy if exists "Users read their daily summaries" on public.daily_summaries;
create policy "Users read their daily summaries" on public.daily_summaries
for select to authenticated using (owner_id = (select auth.uid()));

grant select on public.daily_summaries to authenticated;
grant execute on function public.refresh_daily_summaries(date) to service_role;

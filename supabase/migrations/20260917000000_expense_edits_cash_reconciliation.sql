-- Edición auditada de gastos y arqueos de efectivo independientes de la ganancia.
begin;

alter table public.expenses add column if not exists payment_method text not null default 'unknown';
alter table public.expenses drop constraint if exists expenses_payment_method_check;
alter table public.expenses add constraint expenses_payment_method_check
  check (payment_method in ('cash', 'transfer', 'card', 'other', 'unknown'));

create or replace function public.update_business_expense(
  p_expense_id uuid, p_concept text, p_amount numeric, p_expense_date date,
  p_category text, p_bale_id uuid default null, p_notes text default null,
  p_payment_method text default 'unknown'
)
returns public.expenses language plpgsql security definer set search_path = public as $$
declare v_before public.expenses; v_after public.expenses;
begin
  if auth.uid() is null or not public.current_account_is_active() then
    raise exception 'Esta cuenta no tiene acceso activo.';
  end if;
  select * into v_before from public.expenses where id = p_expense_id and owner_id = auth.uid() for update;
  if not found then raise exception 'No se encontró el gasto o no te pertenece.'; end if;
  if p_concept is null or char_length(trim(p_concept)) not between 1 and 160
    or p_amount is null or p_amount <= 0 or p_amount >= 10000000000 or round(p_amount, 2) <= 0 or p_expense_date is null
    or p_category is null or p_payment_method is null then
    raise exception 'Revisa el concepto, monto, fecha y medio de pago del gasto.';
  end if;
  update public.expenses set concept = trim(p_concept), amount = p_amount,
    expense_date = p_expense_date, category = p_category, bale_id = p_bale_id,
    notes = nullif(trim(p_notes), ''), payment_method = p_payment_method
  where id = p_expense_id returning * into v_after;
  insert into public.business_history(owner_id, entity_type, entity_id, action, description, before_state, after_state)
    values(auth.uid(), 'expense', p_expense_id, 'expense_corrected',
      'Gasto corregido; se actualizaron sus reportes. Los arqueos anteriores conservan su fotografía.',
      to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;
revoke execute on function public.update_business_expense(uuid,text,numeric,date,text,uuid,text,text) from public, anon;
grant execute on function public.update_business_expense(uuid,text,numeric,date,text,uuid,text,text) to authenticated;

create table if not exists public.cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  opening_amount numeric(12,2) not null check (opening_amount >= 0),
  cash_collected numeric(12,2) not null check (cash_collected >= 0),
  cash_expenses numeric(12,2) not null check (cash_expenses >= 0),
  other_income numeric(12,2) not null check (other_income >= 0),
  other_outflows numeric(12,2) not null check (other_outflows >= 0),
  counted_amount numeric(12,2) not null check (counted_amount >= 0),
  expected_amount numeric(12,2) generated always as (opening_amount + cash_collected + other_income - cash_expenses - other_outflows) stored,
  difference numeric(12,2) generated always as (counted_amount - opening_amount - cash_collected - other_income + cash_expenses + other_outflows) stored,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists cash_reconciliations_owner_created_idx on public.cash_reconciliations(owner_id, created_at desc);
alter table public.cash_reconciliations enable row level security;
drop policy if exists "Users read their cash reconciliations" on public.cash_reconciliations;
create policy "Users read their cash reconciliations" on public.cash_reconciliations for select to authenticated
  using (owner_id = (select auth.uid()) and public.current_account_is_active());
revoke all on public.cash_reconciliations from public, anon, authenticated;
grant select on public.cash_reconciliations to authenticated;
grant all on public.cash_reconciliations to service_role;

create or replace function public.save_cash_reconciliation(
  p_start_date date, p_end_date date, p_opening numeric, p_other_income numeric,
  p_other_outflows numeric, p_counted numeric, p_notes text default null
)
returns public.cash_reconciliations language plpgsql security definer set search_path = public as $$
declare
  v_result public.cash_reconciliations;
  v_collected numeric;
  v_expenses numeric;
  v_unknown bigint;
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null or not public.current_account_is_active() then raise exception 'Esta cuenta no tiene acceso activo.'; end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date
    or p_end_date > (now() at time zone 'America/Guatemala')::date then
    raise exception 'Elige un período válido, sin fechas futuras.';
  end if;
  if p_opening is null or p_other_income is null or p_other_outflows is null or p_counted is null
    or least(p_opening, p_other_income, p_other_outflows, p_counted) < 0
    or greatest(p_opening, p_other_income, p_other_outflows, p_counted) >= 10000000000 then
    raise exception 'Los montos del arqueo deben ser cero o mayores.';
  end if;
  v_start := p_start_date::timestamp at time zone 'America/Guatemala';
  v_end := (p_end_date + 1)::timestamp at time zone 'America/Guatemala';
  -- Una sola consulta mantiene los cobros y gastos en la misma fotografía.
  with payments as (
    select first_payment_amount as amount, first_payment_method as method, first_payment_at as at
      from public.sales where owner_id = auth.uid()
    union all
    select second_payment_amount, second_payment_method, second_payment_at
      from public.sales where owner_id = auth.uid()
    union all
    select amount, method, paid_at from public.sale_additional_payments where owner_id = auth.uid()
  )
  select
    (select coalesce(sum(amount),0) from payments where method = 'cash' and at >= v_start and at <= now() and at < v_end),
    coalesce(sum(amount) filter (where payment_method = 'cash'),0),
    count(*) filter (where payment_method = 'unknown')
  into v_collected, v_expenses, v_unknown
  from public.expenses where owner_id = auth.uid() and expense_date between p_start_date and p_end_date;
  if v_unknown > 0 then raise exception 'Revisa el medio de pago de % gastos antes de guardar el arqueo.', v_unknown; end if;
  insert into public.cash_reconciliations(owner_id, start_date, end_date, opening_amount, cash_collected, cash_expenses,
    other_income, other_outflows, counted_amount, notes)
  values(auth.uid(), p_start_date, p_end_date, round(p_opening,2), v_collected, v_expenses,
    round(p_other_income,2), round(p_other_outflows,2), round(p_counted,2), nullif(trim(p_notes),''))
  returning * into v_result;
  return v_result;
end;
$$;
revoke execute on function public.save_cash_reconciliation(date,date,numeric,numeric,numeric,numeric,text) from public, anon;
grant execute on function public.save_cash_reconciliation(date,date,numeric,numeric,numeric,numeric,text) to authenticated;
notify pgrst, 'reload schema';
commit;

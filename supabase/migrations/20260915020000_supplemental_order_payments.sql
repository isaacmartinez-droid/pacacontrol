-- Un pedido corregido puede necesitar cobros adicionales sin sobrescribir pagos antiguos.
begin;

alter table public.sales
  add column if not exists additional_paid_amount numeric(12, 2) not null default 0 check (additional_paid_amount >= 0),
  add column if not exists last_additional_payment_at timestamptz;

alter table public.sales drop constraint if exists sales_payment_history_check;
alter table public.sales add constraint sales_payment_history_check check (
  paid_amount = first_payment_amount + second_payment_amount + additional_paid_amount
  and ((first_payment_amount = 0 and first_payment_method is null and first_payment_at is null)
    or (first_payment_amount > 0 and first_payment_method is not null and first_payment_at is not null))
  and ((second_payment_amount = 0 and second_payment_method is null and second_payment_at is null)
    or (second_payment_amount > 0 and second_payment_method is not null and second_payment_at is not null))
  and ((additional_paid_amount = 0 and last_additional_payment_at is null)
    or (additional_paid_amount > 0 and last_additional_payment_at is not null))
  and ((payment_status = 'pending' and paid_amount = 0)
    or (payment_status = 'partial' and paid_amount > 0 and paid_amount < total)
    or (payment_status = 'paid' and paid_amount = total))
);

create table if not exists public.sale_additional_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('cash', 'transfer', 'card', 'other')),
  paid_at timestamptz not null default timezone('utc', now())
);

create index if not exists sale_additional_payments_sale_idx on public.sale_additional_payments (sale_id, paid_at);
create index if not exists sale_additional_payments_owner_date_idx on public.sale_additional_payments (owner_id, paid_at);
alter table public.sale_additional_payments enable row level security;
drop policy if exists "Users read their additional payments" on public.sale_additional_payments;
create policy "Users read their additional payments" on public.sale_additional_payments
for select to authenticated using ((select auth.uid()) = owner_id and public.current_account_is_active());
revoke all on public.sale_additional_payments from public, anon;
grant select on public.sale_additional_payments to authenticated;

create or replace function public.complete_sale_payment(p_sale_id uuid, p_payment_method text)
returns public.sales language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales;
  v_remaining numeric(12, 2);
  v_paid_at timestamptz := timezone('utc', now());
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesion.'; end if;
  if not public.current_account_is_active() then raise exception 'Esta cuenta no tiene acceso activo.'; end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'transfer', 'card', 'other') then raise exception 'Metodo de pago invalido.'; end if;
  select * into v_sale from public.sales where id = p_sale_id and owner_id = auth.uid() for update;
  if not found then raise exception 'No se encontro el pedido.'; end if;
  v_remaining := v_sale.total - v_sale.paid_amount;
  if v_remaining <= 0 then raise exception 'Este pedido ya esta pagado.'; end if;

  if v_sale.first_payment_amount = 0 then
    update public.sales set first_payment_amount = v_remaining,
      first_payment_method = p_payment_method, first_payment_at = v_paid_at,
      paid_amount = total, payment_method = p_payment_method, payment_status = 'paid'
    where id = p_sale_id returning * into v_sale;
  elsif v_sale.second_payment_amount = 0 then
    update public.sales set second_payment_amount = v_remaining,
      second_payment_method = p_payment_method, second_payment_at = v_paid_at,
      paid_amount = total, payment_status = 'paid'
    where id = p_sale_id returning * into v_sale;
  else
    insert into public.sale_additional_payments (sale_id, owner_id, amount, method, paid_at)
    values (p_sale_id, auth.uid(), v_remaining, p_payment_method, v_paid_at);
    update public.sales set additional_paid_amount = additional_paid_amount + v_remaining,
      last_additional_payment_at = v_paid_at, paid_amount = total, payment_status = 'paid'
    where id = p_sale_id returning * into v_sale;
  end if;

  perform public.refresh_daily_summaries((v_paid_at at time zone 'America/Guatemala')::date);
  return v_sale;
end;
$$;

revoke execute on function public.complete_sale_payment(uuid, text) from public, anon;
grant execute on function public.complete_sale_payment(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;

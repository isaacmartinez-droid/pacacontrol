-- Agrega seguimiento persistente a las ventas existentes y nuevas.

alter table public.sales
add column if not exists delivery_status text not null default 'paid';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_delivery_status_check'
      and conrelid = 'public.sales'::regclass
  ) then
    alter table public.sales
    add constraint sales_delivery_status_check
    check (delivery_status in ('paid', 'on_the_way', 'delivered'));
  end if;
end;
$$;

drop policy if exists "Users update their sale delivery status" on public.sales;
create policy "Users update their sale delivery status" on public.sales
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

grant update (delivery_status) on public.sales to authenticated;

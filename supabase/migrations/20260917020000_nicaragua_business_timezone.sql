-- Fecha comercial de Nicaragua. No mueve instantes ni reescribe datos históricos.
begin;
do $$
declare v_function record; v_definition text;
begin
  for v_function in
    select p.oid from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname in ('refresh_daily_summaries', 'register_sale',
        'register_sale_with_prices', 'register_sale_with_items', 'complete_sale_payment',
        'update_sale_order', 'update_sale_delivery_status',
        'refresh_expense_daily_summaries', 'save_cash_reconciliation')
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    if strpos(v_definition, 'America/Guatemala') > 0 then
      execute replace(v_definition, 'America/Guatemala', 'America/Managua');
    end if;
  end loop;
end;
$$;
alter table public.bales alter column purchase_date
  set default ((now() at time zone 'America/Managua')::date);
alter table public.expenses alter column expense_date
  set default ((now() at time zone 'America/Managua')::date);
notify pgrst, 'reload schema';
commit;

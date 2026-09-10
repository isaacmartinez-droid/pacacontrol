-- ATENCIÓN: elimina permanentemente todos los datos del negocio.
-- Conserva las cuentas de auth.users y sus perfiles para que los usuarios
-- actuales puedan seguir entrando con la misma contraseña.
-- También conserva tablas, funciones, políticas, extensiones y cron.

begin;

-- Se eliminan primero las tablas hijas. Esto evita que las relaciones
-- restrictivas entre categorías e inventario bloqueen el reinicio.
delete from public.sale_item_allocations;
delete from public.damaged_products;
delete from public.sale_items;
delete from public.sales;
delete from public.expenses;
delete from public.bale_inventory;
delete from public.bales;
delete from public.categories;
delete from public.customers;
delete from public.daily_summaries;
delete from public.push_subscriptions;
delete from public.business_settings;

-- DELETE no reinicia una identidad. Esto garantiza que la siguiente paca
-- registrada use bale_number = 1 y, por tanto, el código PAC-0001.
alter table public.bales alter column bale_number restart with 1;

-- Estado técnico sin dueño: se conserva la fila, pero se libera cualquier bloqueo.
update public.push_dispatch_state
set lock_token = null, locked_until = null, last_run_at = null;

commit;

-- Comprobación final: deben quedar usuarios y cero registros del negocio.
select
  (select count(*) from auth.users) as usuarios_conservados,
  (select count(*) from public.profiles) as perfiles_conservados,
  (select count(*) from public.bales) as pacas,
  (select count(*) from public.sales) as ventas,
  (select count(*) from public.customers) as clientes,
  (select count(*) from public.categories) as categorias;

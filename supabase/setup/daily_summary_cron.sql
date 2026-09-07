-- Ejecutar después de 20260908000000_daily_summaries.sql.
-- 06:05 UTC equivale a 00:05 en America/Guatemala.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'pacacontrol-daily-summary',
  '5 6 * * *',
  $$select public.refresh_daily_summaries(((now() at time zone 'America/Guatemala')::date - 1));$$
);

-- Genera el cierre de ayer de inmediato para comprobar la pantalla.
select public.refresh_daily_summaries(((now() at time zone 'America/Guatemala')::date - 1));

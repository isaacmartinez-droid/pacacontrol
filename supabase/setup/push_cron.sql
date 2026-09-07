-- Ejecutar DESPUÉS de la migración web_push y de configurar los secretos
-- indicados en docs/notificaciones-push.md. No contiene claves privadas.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'pacacontrol_push_url'
    and decrypted_secret ~ '^https://[^/]+/api/push-dispatch$') then
    raise exception 'Configura pacacontrol_push_url en Vault con la URL de producción terminada en /api/push-dispatch.';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'pacacontrol_push_cron_secret'
    and length(decrypted_secret) >= 32) then
    raise exception 'Configura pacacontrol_push_cron_secret en Vault; debe coincidir con PUSH_CRON_SECRET de Vercel.';
  end if;
end;
$$;

select cron.schedule(
  'pacacontrol-push-every-five-minutes',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'pacacontrol_push_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'pacacontrol_push_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $job$
);

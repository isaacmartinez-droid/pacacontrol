-- Dispositivos que autorizaron notificaciones del sistema.
begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 1 and 2048 and endpoint like 'https://%'),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22}$'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 2000),
  notified jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  last_test_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Owners manage push subscriptions" on public.push_subscriptions;
create policy "Owners manage push subscriptions" on public.push_subscriptions
for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant insert (owner_id, endpoint, p256dh, auth, settings), update (owner_id, endpoint, p256dh, auth, settings) on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
create index if not exists push_subscriptions_owner_idx on public.push_subscriptions(owner_id);
create index if not exists push_subscriptions_checked_idx on public.push_subscriptions(last_checked_at nulls first);

create table if not exists public.push_dispatch_state (
  id boolean primary key default true check (id),
  lock_token uuid,
  locked_until timestamptz,
  last_run_at timestamptz
);
insert into public.push_dispatch_state(id) values (true) on conflict do nothing;
alter table public.push_dispatch_state enable row level security;
revoke all on public.push_dispatch_state from public, anon, authenticated;
grant all on public.push_dispatch_state to service_role;

create or replace function public.acquire_push_dispatch_lock(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.push_dispatch_state set lock_token = p_token, locked_until = now() + interval '2 minutes'
  where id = true and (locked_until is null or locked_until < now());
  return found;
end;
$$;
revoke all on function public.acquire_push_dispatch_lock(uuid) from public, anon, authenticated;
grant execute on function public.acquire_push_dispatch_lock(uuid) to service_role;

notify pgrst, 'reload schema';
commit;

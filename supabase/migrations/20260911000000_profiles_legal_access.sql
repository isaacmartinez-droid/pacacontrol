-- Guarda aceptacion legal y prepara control basico de acceso por cuenta.
begin;

alter table public.profiles add column if not exists access_status text;
alter table public.profiles add column if not exists service_plan text;
alter table public.profiles add column if not exists legal_terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists privacy_version text;
alter table public.profiles add column if not exists privacy_accepted_at timestamptz;

update public.profiles set access_status = 'active' where access_status is null;
update public.profiles set service_plan = 'pilot_free' where service_plan is null;

alter table public.profiles alter column access_status set default 'active';
alter table public.profiles alter column access_status set not null;
alter table public.profiles alter column service_plan set default 'pilot_free';
alter table public.profiles alter column service_plan set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_access_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_access_status_check
    check (access_status in ('active', 'suspended', 'closed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_service_plan_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_service_plan_check
    check (service_plan in ('pilot_free', 'paid_monthly', 'demo', 'internal'));
  end if;
end $$;

create or replace function public.create_profile_and_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    display_name,
    legal_terms_version,
    terms_accepted_at,
    privacy_version,
    privacy_accepted_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name'),
    nullif(new.raw_user_meta_data ->> 'legal_terms_version', ''),
    case when nullif(new.raw_user_meta_data ->> 'legal_terms_version', '') is not null then timezone('utc', now()) else null end,
    nullif(new.raw_user_meta_data ->> 'privacy_version', ''),
    case when nullif(new.raw_user_meta_data ->> 'privacy_version', '') is not null then timezone('utc', now()) else null end
  )
  on conflict (id) do update set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    legal_terms_version = coalesce(public.profiles.legal_terms_version, excluded.legal_terms_version),
    terms_accepted_at = coalesce(public.profiles.terms_accepted_at, excluded.terms_accepted_at),
    privacy_version = coalesce(public.profiles.privacy_version, excluded.privacy_version),
    privacy_accepted_at = coalesce(public.profiles.privacy_accepted_at, excluded.privacy_accepted_at);

  insert into public.categories (owner_id, slug, name)
  values
    (new.id, 'shirts', 'Camisas'),
    (new.id, 'blouses', 'Blusas'),
    (new.id, 'pants', 'Pantalones'),
    (new.id, 'skirts', 'Faldas'),
    (new.id, 'dresses', 'Vestidos'),
    (new.id, 'kids', 'Ropa infantil'),
    (new.id, 'other', 'Otros')
  on conflict (owner_id, slug) do nothing;

  return new;
end;
$$;

create or replace function public.accept_legal_terms(
  p_terms_version text,
  p_privacy_version text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion.';
  end if;
  if nullif(trim(p_terms_version), '') is null or nullif(trim(p_privacy_version), '') is null then
    raise exception 'Version legal invalida.';
  end if;

  update public.profiles set
    legal_terms_version = trim(p_terms_version),
    terms_accepted_at = timezone('utc', now()),
    privacy_version = trim(p_privacy_version),
    privacy_accepted_at = timezone('utc', now())
  where id = auth.uid()
  returning * into v_profile;

  if not found then
    raise exception 'No encontramos el perfil de esta cuenta.';
  end if;

  return v_profile;
end;
$$;

revoke execute on function public.accept_legal_terms(text, text) from public, anon;
grant execute on function public.accept_legal_terms(text, text) to authenticated;

revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

notify pgrst, 'reload schema';
commit;

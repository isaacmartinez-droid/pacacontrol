-- Altas controladas: el administrador invita y el cliente define su clave.
-- El token original se entrega una sola vez y nunca se guarda en la base.
begin;

create table if not exists public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  code_digest text not null unique check (code_digest ~ '^[0-9a-f]{64}$'),
  code_hint text not null check (char_length(code_hint) = 8),
  business_name text not null check (char_length(trim(business_name)) between 1 and 120),
  owner_name text not null check (char_length(trim(owner_name)) between 1 and 120),
  username text not null check (username ~ '^[a-z0-9]+(\.[a-z0-9]+)+$' and char_length(username) between 3 and 80),
  contact_email text check (contact_email is null or char_length(trim(contact_email)) between 3 and 254),
  contact_phone text check (contact_phone is null or char_length(trim(contact_phone)) between 7 and 30),
  service_plan text not null default 'pilot_free' check (service_plan in ('pilot_free', 'paid_monthly', 'demo')),
  trial_days integer not null default 30 check (trial_days between 0 and 365),
  legal_terms_version text not null check (char_length(trim(legal_terms_version)) between 1 and 40),
  privacy_version text not null check (char_length(trim(privacy_version)) between 1 and 40),
  status text not null default 'pending' check (status in ('pending', 'processing', 'redeemed', 'revoked', 'expired')),
  expires_at timestamptz not null,
  processing_attempt_id uuid,
  processing_started_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  redeemed_by uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_invitations_expiration check (expires_at > created_at),
  constraint account_invitations_redemption check (
    (status = 'redeemed' and redeemed_by is not null and redeemed_at is not null)
    or (status <> 'redeemed' and redeemed_at is null)
  )
);

create unique index if not exists account_invitations_pending_username_idx
  on public.account_invitations(lower(username))
  where status in ('pending', 'processing');
create index if not exists account_invitations_status_created_idx
  on public.account_invitations(status, created_at desc);

drop trigger if exists account_invitations_set_updated_at on public.account_invitations;
create trigger account_invitations_set_updated_at before update on public.account_invitations
for each row execute procedure public.set_updated_at();

alter table public.account_invitations enable row level security;
revoke all on public.account_invitations from public, anon, authenticated;
grant all on public.account_invitations to service_role;

create or replace function public.admin_create_account_invitation(
  p_business_name text,
  p_owner_name text,
  p_username text,
  p_contact_email text,
  p_contact_phone text,
  p_service_plan text,
  p_trial_days integer,
  p_expires_in_days integer,
  p_legal_terms_version text,
  p_privacy_version text
)
returns table (
  invitation_id uuid,
  invitation_token text,
  username text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_username text := lower(trim(p_username));
  v_id uuid;
  v_expires_at timestamptz;
begin
  if not public.current_account_is_admin() then
    raise exception 'No tienes permisos de administrador.' using errcode = '42501';
  end if;
  if p_business_name is null or char_length(trim(p_business_name)) not between 1 and 120
    or p_owner_name is null or char_length(trim(p_owner_name)) not between 1 and 120 then
    raise exception 'Completa el negocio y la persona responsable.';
  end if;
  if v_username !~ '^[a-z0-9]+(\.[a-z0-9]+)+$' or char_length(v_username) not between 3 and 80 then
    raise exception 'El usuario debe usar el formato nombre.apellido, sin espacios ni tildes.';
  end if;
  if p_contact_email is not null and char_length(trim(p_contact_email)) not between 3 and 254 then
    raise exception 'El correo de contacto no es válido.';
  end if;
  if p_contact_phone is not null and char_length(trim(p_contact_phone)) not between 7 and 30 then
    raise exception 'El teléfono de contacto no es válido.';
  end if;
  if p_service_plan not in ('pilot_free', 'paid_monthly', 'demo') then
    raise exception 'El plan seleccionado no es válido.';
  end if;
  if p_trial_days is null or p_trial_days not between 0 and 365
    or p_expires_in_days is null or p_expires_in_days not between 1 and 30 then
    raise exception 'La vigencia de la invitación o prueba no es válida.';
  end if;
  if p_legal_terms_version is null or char_length(trim(p_legal_terms_version)) not between 1 and 40
    or p_privacy_version is null or char_length(trim(p_privacy_version)) not between 1 and 40 then
    raise exception 'Las versiones legales no son válidas.';
  end if;
  if exists (
    select 1 from auth.users u
    where lower(split_part(u.email, '@', 1)) = v_username
  ) then
    raise exception 'Ese usuario ya existe.' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.account_invitations i
    where lower(i.username) = v_username and i.status in ('pending', 'processing')
  ) then
    raise exception 'Ya existe una invitación pendiente para ese usuario.' using errcode = '23505';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires_at := now() + make_interval(days => p_expires_in_days);

  insert into public.account_invitations (
    code_digest, code_hint, business_name, owner_name, username,
    contact_email, contact_phone, service_plan, trial_days,
    legal_terms_version, privacy_version, expires_at, created_by
  ) values (
    encode(pg_catalog.sha256(convert_to(v_token, 'UTF8')), 'hex'), right(v_token, 8),
    trim(p_business_name), trim(p_owner_name), v_username,
    nullif(trim(p_contact_email), ''), nullif(trim(p_contact_phone), ''), p_service_plan, p_trial_days,
    trim(p_legal_terms_version), trim(p_privacy_version), v_expires_at, auth.uid()
  ) returning id into v_id;

  return query select v_id, v_token, v_username, v_expires_at;
end;
$$;

create or replace function public.admin_list_account_invitations()
returns table (
  invitation_id uuid,
  business_name text,
  owner_name text,
  username text,
  contact_email text,
  contact_phone text,
  service_plan text,
  trial_days integer,
  status text,
  code_hint text,
  expires_at timestamptz,
  redeemed_by uuid,
  redeemed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_account_is_admin() then
    raise exception 'No tienes permisos de administrador.' using errcode = '42501';
  end if;
  update public.account_invitations i
  set status = 'expired'
  where i.status = 'pending' and i.expires_at <= now();

  return query
  select i.id, i.business_name, i.owner_name, i.username, i.contact_email,
    i.contact_phone, i.service_plan, i.trial_days, i.status, i.code_hint,
    i.expires_at, i.redeemed_by, i.redeemed_at, i.created_at
  from public.account_invitations i
  order by i.created_at desc;
end;
$$;

create or replace function public.admin_revoke_account_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_account_is_admin() then
    raise exception 'No tienes permisos de administrador.' using errcode = '42501';
  end if;
  update public.account_invitations
  set status = 'revoked', revoked_at = now(), processing_attempt_id = null, processing_started_at = null
  where id = p_invitation_id and status in ('pending', 'processing');
  return found;
end;
$$;

-- Estas RPC solo pueden ser invocadas por el backend con service_role.
create or replace function public.preview_account_invitation(p_code_digest text)
returns table (
  business_name text,
  owner_name text,
  username text,
  legal_terms_version text,
  privacy_version text,
  expires_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select i.business_name, i.owner_name, i.username,
    i.legal_terms_version, i.privacy_version, i.expires_at
  from public.account_invitations i
  where i.code_digest = p_code_digest
    and (
      i.status = 'pending'
      or (i.status = 'processing' and i.processing_started_at < now() - interval '15 minutes')
    )
    and i.expires_at > now();
$$;

create or replace function public.claim_account_invitation(p_code_digest text, p_attempt_id uuid)
returns table (
  invitation_id uuid,
  business_name text,
  owner_name text,
  username text,
  service_plan text,
  trial_days integer,
  legal_terms_version text,
  privacy_version text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.account_invitations i
  set status = 'processing', processing_attempt_id = p_attempt_id, processing_started_at = now()
  where i.code_digest = p_code_digest
    and (
      i.status = 'pending'
      or (i.status = 'processing' and i.processing_started_at < now() - interval '15 minutes')
    )
    and i.expires_at > now()
  returning i.id, i.business_name, i.owner_name, i.username, i.service_plan,
    i.trial_days, i.legal_terms_version, i.privacy_version;
end;
$$;

create or replace function public.release_account_invitation(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_invitations
  set status = case when expires_at > now() then 'pending' else 'expired' end,
    processing_attempt_id = null, processing_started_at = null
  where processing_attempt_id = p_attempt_id and status = 'processing';
  return found;
end;
$$;

create or replace function public.complete_account_invitation_activation(p_attempt_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_invitation public.account_invitations;
begin
  select * into v_invitation
  from public.account_invitations
  where processing_attempt_id = p_attempt_id and status = 'processing'
  for update;
  if not found then
    raise exception 'La invitación ya no está disponible.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'La cuenta de acceso no existe.' using errcode = '23503';
  end if;

  update public.profiles
  set display_name = v_invitation.business_name,
    access_status = 'active', service_plan = v_invitation.service_plan,
    account_role = 'owner', suspension_reason = null,
    trial_ends_at = case when v_invitation.trial_days > 0
      then now() + make_interval(days => v_invitation.trial_days) else null end,
    legal_terms_version = v_invitation.legal_terms_version, terms_accepted_at = now(),
    privacy_version = v_invitation.privacy_version, privacy_accepted_at = now(),
    last_admin_action_at = now(), last_admin_action_by = v_invitation.created_by
  where id = p_user_id;
  if not found then
    raise exception 'No se creó el perfil de la cuenta.';
  end if;

  update public.business_profiles
  set business_name = v_invitation.business_name,
    onboarding_status = 'pending', onboarding_step = 0,
    onboarding_draft = jsonb_build_object(
      'businessName', v_invitation.business_name,
      'ownerName', v_invitation.owner_name
    )
  where owner_id = p_user_id;

  update public.account_invitations
  set status = 'redeemed', redeemed_by = p_user_id, redeemed_at = now(),
    processing_attempt_id = null, processing_started_at = null
  where id = v_invitation.id;

  insert into public.admin_account_events (
    target_user_id, actor_user_id, action, new_access_status,
    new_service_plan, new_account_role, admin_notes
  ) values (
    p_user_id, v_invitation.created_by, 'account_activated', 'active',
    v_invitation.service_plan, 'owner', 'Cuenta activada mediante invitación de un solo uso.'
  );
  return true;
end;
$$;

revoke execute on function public.admin_create_account_invitation(text,text,text,text,text,text,integer,integer,text,text) from public, anon;
revoke execute on function public.admin_list_account_invitations() from public, anon;
revoke execute on function public.admin_revoke_account_invitation(uuid) from public, anon;
grant execute on function public.admin_create_account_invitation(text,text,text,text,text,text,integer,integer,text,text) to authenticated;
grant execute on function public.admin_list_account_invitations() to authenticated;
grant execute on function public.admin_revoke_account_invitation(uuid) to authenticated;

revoke execute on function public.preview_account_invitation(text) from public, anon, authenticated;
revoke execute on function public.claim_account_invitation(text,uuid) from public, anon, authenticated;
revoke execute on function public.release_account_invitation(uuid) from public, anon, authenticated;
revoke execute on function public.complete_account_invitation_activation(uuid,uuid) from public, anon, authenticated;
grant execute on function public.preview_account_invitation(text) to service_role;
grant execute on function public.claim_account_invitation(text,uuid) to service_role;
grant execute on function public.release_account_invitation(uuid) to service_role;
grant execute on function public.complete_account_invitation_activation(uuid,uuid) to service_role;

notify pgrst, 'reload schema';
commit;

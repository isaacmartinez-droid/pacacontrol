-- El administrador invita a una persona; el propietario define su negocio
-- dentro del onboarding. Se conserva la firma anterior para compatibilidad.
begin;

alter table public.account_invitations
  alter column business_name drop not null;

comment on column public.account_invitations.business_name is
  'Compatibilidad histórica. Las invitaciones nuevas dejan el negocio por definir en el onboarding.';

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
  if p_owner_name is null or char_length(trim(p_owner_name)) not between 1 and 120 then
    raise exception 'Escribe el nombre de la persona responsable.';
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

  v_token := translate(rtrim(encode(uuid_send(gen_random_uuid()), 'base64'), '='), '+/', '-_');
  v_expires_at := now() + make_interval(days => p_expires_in_days);

  insert into public.account_invitations (
    code_digest, code_hint, business_name, owner_name, username,
    contact_email, contact_phone, service_plan, trial_days,
    legal_terms_version, privacy_version, expires_at, created_by
  ) values (
    encode(pg_catalog.sha256(convert_to(v_token, 'UTF8')), 'hex'), right(v_token, 8),
    null, trim(p_owner_name), v_username,
    nullif(trim(p_contact_email), ''), nullif(trim(p_contact_phone), ''), p_service_plan, p_trial_days,
    trim(p_legal_terms_version), trim(p_privacy_version), v_expires_at, auth.uid()
  ) returning id into v_id;

  return query select v_id, v_token, v_username, v_expires_at;
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
  set display_name = v_invitation.owner_name,
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
  set business_name = null,
    onboarding_status = 'pending', onboarding_step = 0,
    onboarding_draft = jsonb_build_object('ownerName', v_invitation.owner_name)
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

-- Una vez que el propietario elige o edita el nombre, el directorio
-- administrativo muestra ese negocio en vez del nombre provisional del titular.
create or replace function public.sync_business_name_to_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.business_name is not null
    and new.business_name is distinct from old.business_name then
    update public.profiles
    set display_name = new.business_name
    where id = new.owner_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_business_name_to_profile() from public, anon, authenticated;
drop trigger if exists business_profiles_sync_profile_name on public.business_profiles;
create trigger business_profiles_sync_profile_name
after update of business_name on public.business_profiles
for each row execute procedure public.sync_business_name_to_profile();

notify pgrst, 'reload schema';
commit;

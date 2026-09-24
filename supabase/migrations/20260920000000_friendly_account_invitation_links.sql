-- Enlaces de bienvenida más breves sin reducir la seguridad de las invitaciones.
-- Los tokens anteriores de 64 caracteres siguen siendo válidos hasta vencer.
begin;

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
  -- Un UUID aleatorio aporta 128 bits de entropía. Base64url lo representa
  -- en 22 caracteres aptos para una ruta, sin guardar el secreto original.
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

  v_token := translate(rtrim(encode(uuid_send(gen_random_uuid()), 'base64'), '='), '+/', '-_');
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

notify pgrst, 'reload schema';
commit;

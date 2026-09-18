-- Fundamento del perfil general del negocio y onboarding reanudable.
-- Las plantillas sugieren valores; nunca crean categorías antes de confirmarlas.
begin;

create table if not exists public.business_templates (
  template_key text not null check (template_key ~ '^[a-z0-9_]+$'),
  version integer not null check (version > 0),
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text not null check (char_length(trim(description)) between 1 and 300),
  config jsonb not null check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 16000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (template_key, version)
);

insert into public.business_templates(template_key, version, name, description, config)
values
  ('legacy_bales', 1, 'Venta por pacas o lotes',
    'Configuración compatible con las cuentas que ya trabajan con pacas, categorías y piezas.',
    '{"suggested_categories":[],"vocabulary":{"purchaseSingular":"Paca","purchasePlural":"Pacas","inventoryUnitSingular":"Pieza","inventoryUnitPlural":"Piezas"}}'),
  ('general_store', 1, 'Tienda general',
    'Para comercios que compran y venden diferentes tipos de productos.',
    '{"suggested_categories":["Abarrotes","Hogar","Cuidado personal"],"vocabulary":{"purchaseSingular":"Compra","purchasePlural":"Compras","inventoryUnitSingular":"Producto","inventoryUnitPlural":"Productos"}}'),
  ('clothing_footwear', 1, 'Ropa y calzado',
    'Para prendas, zapatos y accesorios con compras por unidades o lotes.',
    '{"suggested_categories":["Ropa","Calzado","Accesorios"],"vocabulary":{"purchaseSingular":"Compra","purchasePlural":"Compras","inventoryUnitSingular":"Pieza","inventoryUnitPlural":"Piezas"}}'),
  ('beauty_accessories', 1, 'Belleza y accesorios',
    'Para cosméticos, cuidado personal, bisutería y productos relacionados.',
    '{"suggested_categories":["Cosméticos","Cuidado personal","Accesorios"],"vocabulary":{"purchaseSingular":"Compra","purchasePlural":"Compras","inventoryUnitSingular":"Producto","inventoryUnitPlural":"Productos"}}'),
  ('social_catalog', 1, 'Venta por catálogo o redes',
    'Para negocios que administran pedidos, clientes, saldos y entregas.',
    '{"suggested_categories":["Disponible","Por encargo"],"vocabulary":{"purchaseSingular":"Compra","purchasePlural":"Compras","inventoryUnitSingular":"Producto","inventoryUnitPlural":"Productos"}}'),
  ('manual', 1, 'Configuración manual',
    'Para definir el negocio y sus categorías sin partir de sugerencias.',
    '{"suggested_categories":[],"vocabulary":{"purchaseSingular":"Compra","purchasePlural":"Compras","inventoryUnitSingular":"Producto","inventoryUnitPlural":"Productos"}}')
on conflict (template_key, version) do nothing;

drop trigger if exists business_templates_set_updated_at on public.business_templates;
create trigger business_templates_set_updated_at before update on public.business_templates
for each row execute procedure public.set_updated_at();

create table if not exists public.business_profiles (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  business_name text check (business_name is null or char_length(trim(business_name)) between 1 and 120),
  activity_description text check (activity_description is null or char_length(trim(activity_description)) between 1 and 500),
  template_key text,
  template_version integer,
  inventory_mode text check (inventory_mode is null or inventory_mode in ('units', 'batches', 'both')),
  tracks_variants boolean not null default false,
  sales_mode text check (sales_mode is null or sales_mode in ('immediate', 'credit', 'both')),
  fulfillment_methods text[] not null default array['pickup']::text[],
  vocabulary jsonb not null default '{"purchaseSingular":"Compra","purchasePlural":"Compras","inventoryUnitSingular":"Producto","inventoryUnitPlural":"Productos"}'::jsonb,
  onboarding_status text not null default 'pending' check (onboarding_status in ('pending', 'in_progress', 'completed')),
  onboarding_step integer not null default 0 check (onboarding_step between 0 and 7),
  onboarding_draft jsonb not null default '{}'::jsonb check (jsonb_typeof(onboarding_draft) = 'object' and octet_length(onboarding_draft::text) <= 16000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_profiles_template_reference
    foreign key (template_key, template_version)
    references public.business_templates(template_key, version),
  constraint business_profiles_template_pair check (
    (template_key is null and template_version is null)
    or (template_key is not null and template_version is not null)
  ),
  constraint business_profiles_fulfillment check (
    cardinality(fulfillment_methods) between 1 and 2
    and fulfillment_methods <@ array['pickup', 'delivery']::text[]
  ),
  constraint business_profiles_vocabulary check (
    jsonb_typeof(vocabulary) = 'object' and octet_length(vocabulary::text) <= 2000
  ),
  constraint business_profiles_completion check (
    (onboarding_status <> 'completed' and completed_at is null)
    or (onboarding_status = 'completed' and completed_at is not null
      and business_name is not null and template_key is not null
      and inventory_mode is not null and sales_mode is not null)
  )
);

create index if not exists business_profiles_onboarding_idx
  on public.business_profiles(onboarding_status, updated_at);

drop trigger if exists business_profiles_set_updated_at on public.business_profiles;
create trigger business_profiles_set_updated_at before update on public.business_profiles
for each row execute procedure public.set_updated_at();

-- Las cuentas que ya existen conservan su operación y no son forzadas a pasar
-- por un asistente nuevo. No se cambia ni se elimina ninguna categoría.
insert into public.business_profiles(
  owner_id, business_name, activity_description, template_key, template_version,
  inventory_mode, tracks_variants, sales_mode, fulfillment_methods, vocabulary,
  onboarding_status, onboarding_step, completed_at
)
select
  p.id,
  coalesce(nullif(trim(p.display_name), ''), 'Mi negocio'),
  'Operación existente migrada sin modificar sus datos.',
  'legacy_bales', 1, 'batches', false, 'both', array['pickup', 'delivery']::text[],
  t.config -> 'vocabulary', 'completed', 7, now()
from public.profiles p
join public.business_templates t on t.template_key = 'legacy_bales' and t.version = 1
on conflict (owner_id) do nothing;

create or replace function public.create_default_business_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.business_profiles(owner_id, business_name)
  values (new.id, nullif(trim(new.display_name), ''))
  on conflict (owner_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.create_default_business_profile() from public, anon, authenticated;

drop trigger if exists profiles_create_business_profile on public.profiles;
create trigger profiles_create_business_profile after insert on public.profiles
for each row execute procedure public.create_default_business_profile();

-- Las cuentas nuevas ya no reciben categorías de ropa por suposición.
create or replace function public.create_profile_and_categories()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(
    id, display_name, legal_terms_version, terms_accepted_at,
    privacy_version, privacy_accepted_at
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name'),
    nullif(new.raw_user_meta_data ->> 'legal_terms_version', ''),
    case when nullif(new.raw_user_meta_data ->> 'legal_terms_version', '') is not null then now() else null end,
    nullif(new.raw_user_meta_data ->> 'privacy_version', ''),
    case when nullif(new.raw_user_meta_data ->> 'privacy_version', '') is not null then now() else null end
  )
  on conflict (id) do update set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    legal_terms_version = coalesce(public.profiles.legal_terms_version, excluded.legal_terms_version),
    terms_accepted_at = coalesce(public.profiles.terms_accepted_at, excluded.terms_accepted_at),
    privacy_version = coalesce(public.profiles.privacy_version, excluded.privacy_version),
    privacy_accepted_at = coalesce(public.profiles.privacy_accepted_at, excluded.privacy_accepted_at);
  return new;
end;
$$;

alter table public.business_templates enable row level security;
alter table public.business_profiles enable row level security;

drop policy if exists "Active users read business templates" on public.business_templates;
create policy "Active users read business templates" on public.business_templates
for select to authenticated using (is_active and public.current_account_is_active());

drop policy if exists "Users read their business profile" on public.business_profiles;
create policy "Users read their business profile" on public.business_profiles
for select to authenticated
using (owner_id = (select auth.uid()) and public.current_account_is_active());

revoke all on public.business_templates, public.business_profiles from public, anon, authenticated;
grant select on public.business_templates, public.business_profiles to authenticated;
grant all on public.business_templates, public.business_profiles to service_role;

create or replace function public.validate_business_vocabulary(p_vocabulary jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare v_entry record;
begin
  if p_vocabulary is null or jsonb_typeof(p_vocabulary) is distinct from 'object'
    or octet_length(p_vocabulary::text) > 2000 then
    raise exception 'El vocabulario del negocio no es válido.';
  end if;
  for v_entry in select key, value from jsonb_each(p_vocabulary) loop
    if v_entry.key not in ('purchaseSingular', 'purchasePlural', 'inventoryUnitSingular', 'inventoryUnitPlural')
      or jsonb_typeof(v_entry.value) is distinct from 'string'
      or char_length(trim(v_entry.value #>> '{}')) not between 1 and 40 then
      raise exception 'Revisa las palabras personalizadas del negocio.';
    end if;
  end loop;
  if not p_vocabulary ?& array['purchaseSingular', 'purchasePlural', 'inventoryUnitSingular', 'inventoryUnitPlural'] then
    raise exception 'El vocabulario del negocio está incompleto.';
  end if;
  return p_vocabulary;
end;
$$;
revoke execute on function public.validate_business_vocabulary(jsonb) from public, anon, authenticated;

create or replace function public.save_business_onboarding_draft(
  p_step integer,
  p_draft jsonb
)
returns public.business_profiles language plpgsql security definer set search_path = public as $$
declare v_result public.business_profiles;
begin
  if auth.uid() is null or not public.current_account_is_active() then
    raise exception 'Esta cuenta no tiene acceso activo.' using errcode = '42501';
  end if;
  if p_step is null or p_step not between 0 and 7
    or p_draft is null or jsonb_typeof(p_draft) is distinct from 'object'
    or octet_length(p_draft::text) > 16000 then
    raise exception 'El avance de configuración no es válido.';
  end if;

  insert into public.business_profiles(owner_id, onboarding_status, onboarding_step, onboarding_draft)
  values (auth.uid(), 'in_progress', p_step, p_draft)
  on conflict (owner_id) do update set
    onboarding_status = 'in_progress',
    onboarding_step = excluded.onboarding_step,
    onboarding_draft = excluded.onboarding_draft
  where public.business_profiles.onboarding_status <> 'completed'
  returning * into v_result;

  if not found then
    raise exception 'La configuración inicial ya fue completada.';
  end if;
  return v_result;
end;
$$;

create or replace function public.complete_business_onboarding(
  p_business_name text,
  p_template_key text,
  p_inventory_mode text,
  p_tracks_variants boolean,
  p_sales_mode text,
  p_fulfillment_methods text[],
  p_categories text[],
  p_activity_description text default null
)
returns public.business_profiles language plpgsql security definer set search_path = public as $$
declare
  v_result public.business_profiles;
  v_template public.business_templates;
  v_category text;
begin
  if auth.uid() is null or not public.current_account_is_active() then
    raise exception 'Esta cuenta no tiene acceso activo.' using errcode = '42501';
  end if;
  if p_business_name is null or char_length(trim(p_business_name)) not between 1 and 120 then
    raise exception 'Escribe un nombre de negocio válido.';
  end if;
  if p_activity_description is not null
    and char_length(trim(p_activity_description)) not between 1 and 500 then
    raise exception 'La descripción de la actividad no es válida.';
  end if;
  if p_inventory_mode is null or p_inventory_mode not in ('units', 'batches', 'both')
    or p_sales_mode is null or p_sales_mode not in ('immediate', 'credit', 'both')
    or p_tracks_variants is null then
    raise exception 'Revisa cómo compras y vendes tus productos.';
  end if;
  if p_fulfillment_methods is null or cardinality(p_fulfillment_methods) not between 1 and 2
    or not p_fulfillment_methods <@ array['pickup', 'delivery']::text[]
    or cardinality(p_fulfillment_methods) <> cardinality(array(select distinct unnest(p_fulfillment_methods))) then
    raise exception 'Selecciona una forma de entrega válida.';
  end if;
  if p_categories is null or cardinality(p_categories) not between 1 and 30
    or exists (
      select 1 from unnest(p_categories) value
      where value is null or char_length(trim(value)) not between 1 and 80
    ) then
    raise exception 'Confirma entre 1 y 30 categorías válidas.';
  end if;

  select * into v_template
  from public.business_templates
  where template_key = p_template_key and is_active
  order by version desc limit 1;
  if not found then raise exception 'La plantilla seleccionada no está disponible.'; end if;

  -- Bloquear el perfil serializa confirmaciones simultáneas de la misma cuenta.
  select * into v_result from public.business_profiles
  where owner_id = auth.uid() for update;
  if not found then
    insert into public.business_profiles(owner_id) values (auth.uid());
  elsif v_result.onboarding_status = 'completed' then
    -- Repetir una confirmación ya aplicada es un no-op: no duplica categorías
    -- ni permite cambiar de plantilla mediante la RPC de configuración inicial.
    return v_result;
  end if;

  for v_category in
    select min(trim(value)) from unnest(p_categories) value
    group by lower(trim(value)) order by min(trim(value))
  loop
    update public.categories set is_user_created = true
    where owner_id = auth.uid() and lower(name) = lower(v_category);
    if not found then
      insert into public.categories(owner_id, slug, name, is_user_created)
      values (auth.uid(), 'category-' || replace(gen_random_uuid()::text, '-', ''), v_category, true);
    end if;
  end loop;

  update public.business_profiles set
    business_name = trim(p_business_name),
    activity_description = nullif(trim(p_activity_description), ''),
    template_key = v_template.template_key,
    template_version = v_template.version,
    inventory_mode = p_inventory_mode,
    tracks_variants = p_tracks_variants,
    sales_mode = p_sales_mode,
    fulfillment_methods = p_fulfillment_methods,
    vocabulary = public.validate_business_vocabulary(v_template.config -> 'vocabulary'),
    onboarding_status = 'completed',
    onboarding_step = 7,
    onboarding_draft = '{}'::jsonb,
    completed_at = coalesce(completed_at, now())
  where owner_id = auth.uid()
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.update_business_profile(
  p_business_name text,
  p_activity_description text default null,
  p_vocabulary jsonb default null
)
returns public.business_profiles language plpgsql security definer set search_path = public as $$
declare v_result public.business_profiles;
begin
  if auth.uid() is null or not public.current_account_is_active() then
    raise exception 'Esta cuenta no tiene acceso activo.' using errcode = '42501';
  end if;
  if p_business_name is null or char_length(trim(p_business_name)) not between 1 and 120 then
    raise exception 'Escribe un nombre de negocio válido.';
  end if;
  if p_activity_description is not null
    and char_length(trim(p_activity_description)) not between 1 and 500 then
    raise exception 'La descripción de la actividad no es válida.';
  end if;

  update public.business_profiles set
    business_name = trim(p_business_name),
    activity_description = nullif(trim(p_activity_description), ''),
    vocabulary = case when p_vocabulary is null then vocabulary
      else public.validate_business_vocabulary(p_vocabulary) end
  where owner_id = auth.uid() and onboarding_status = 'completed'
  returning * into v_result;
  if not found then raise exception 'Completa primero la configuración inicial del negocio.'; end if;
  return v_result;
end;
$$;

revoke execute on function public.save_business_onboarding_draft(integer,jsonb) from public, anon;
revoke execute on function public.complete_business_onboarding(text,text,text,boolean,text,text[],text[],text) from public, anon;
revoke execute on function public.update_business_profile(text,text,jsonb) from public, anon;
grant execute on function public.save_business_onboarding_draft(integer,jsonb) to authenticated;
grant execute on function public.complete_business_onboarding(text,text,text,boolean,text,text[],text[],text) to authenticated;
grant execute on function public.update_business_profile(text,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;

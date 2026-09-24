-- Auditoría de solo lectura para el Hito 0.
-- No crea, modifica ni elimina objetos o datos.
-- Ejecutar por separado en staging y producción y guardar la salida con fecha.

with feature_status(feature, installed, detail) as (
  values
    (
      'bales.archived_at',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'bales' and column_name = 'archived_at'
      ),
      'Archivo de compras/lotes'
    ),
    (
      'bale_inventory.is_active',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'bale_inventory' and column_name = 'is_active'
      ),
      'Inventario operativo o archivado'
    ),
    (
      'business_history',
      to_regclass('public.business_history') is not null,
      'Historial del negocio'
    ),
    (
      'monthly_expense_commitments',
      to_regclass('public.monthly_expense_commitments') is not null,
      'Metas mensuales de gastos'
    ),
    (
      'sale_additional_payments',
      to_regclass('public.sale_additional_payments') is not null,
      'Pagos adicionales sin sobrescribir historial'
    ),
    (
      'expenses.payment_method',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'expenses' and column_name = 'payment_method'
      ),
      'Medio de pago de gastos'
    ),
    (
      'cash_reconciliations',
      to_regclass('public.cash_reconciliations') is not null,
      'Arqueos de efectivo'
    ),
    (
      'categories.is_user_created',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'categories' and column_name = 'is_user_created'
      ),
      'Categorías agregadas explícitamente'
    ),
    (
      'create_bale_with_inventory',
      to_regprocedure('public.create_bale_with_inventory(date,numeric,numeric,numeric,numeric,jsonb)') is not null,
      'Registro atómico de compra e inventario'
    ),
    (
      'save_cash_reconciliation',
      to_regprocedure('public.save_cash_reconciliation(date,date,numeric,numeric,numeric,numeric,text)') is not null,
      'Registro seguro de arqueos'
    ),
    (
      'bale_other_expense_items',
      to_regclass('public.bale_other_expense_items') is not null,
      'Conceptos y montos de otros gastos de compra'
    ),
    (
      'create_bale_with_expense_details',
      to_regprocedure('public.create_bale_with_expense_details(date,numeric,numeric,numeric,jsonb,jsonb)') is not null,
      'Compra atómica con otros gastos desglosados'
    ),
    (
      'update_bale_with_expense_details',
      to_regprocedure('public.update_bale_with_expense_details(uuid,date,numeric,numeric,numeric,jsonb,jsonb,text)') is not null,
      'Corrección auditada de compra y desglose'
    ),
    (
      'business_templates',
      to_regclass('public.business_templates') is not null,
      'Plantillas versionadas del negocio'
    ),
    (
      'business_profiles',
      to_regclass('public.business_profiles') is not null,
      'Perfil y estado de configuración del negocio'
    ),
    (
      'save_business_onboarding_draft',
      to_regprocedure('public.save_business_onboarding_draft(integer,jsonb)') is not null,
      'Borrador reanudable sin crear categorías'
    ),
    (
      'complete_business_onboarding',
      to_regprocedure('public.complete_business_onboarding(text,text,text,boolean,text,text[],text[],text)') is not null,
      'Confirmación atómica e idempotente del negocio'
    ),
    (
      'update_business_profile',
      to_regprocedure('public.update_business_profile(text,text,jsonb)') is not null,
      'Edición validada de identidad y vocabulario'
    ),
    (
      'account_invitations',
      to_regclass('public.account_invitations') is not null,
      'Invitaciones de cuenta de un solo uso'
    ),
    (
      'admin_create_account_invitation',
      to_regprocedure('public.admin_create_account_invitation(text,text,text,text,text,text,integer,integer,text,text)') is not null,
      'Alta iniciada exclusivamente por administradores'
    ),
    (
      'claim_account_invitation',
      to_regprocedure('public.claim_account_invitation(text,uuid)') is not null,
      'Activación atómica desde backend seguro'
    ),
    (
      'complete_account_invitation_activation',
      to_regprocedure('public.complete_account_invitation_activation(uuid,uuid)') is not null,
      'Cuenta activa y onboarding pendiente'
    )
), date_defaults as (
  select
    table_name,
    column_name,
    column_default::text,
    position('America/Managua' in coalesce(column_default, '')) > 0 as uses_managua
  from information_schema.columns
  where table_schema = 'public'
    and (
      (table_name = 'bales' and column_name = 'purchase_date')
      or (table_name = 'expenses' and column_name = 'expense_date')
    )
), function_timezones as (
  select
    count(*) filter (where strpos(pg_get_functiondef(p.oid), 'America/Guatemala') > 0) as guatemala_count,
    count(*) filter (where strpos(pg_get_functiondef(p.oid), 'America/Managua') > 0) as managua_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.proname in (
      'refresh_daily_summaries',
      'register_sale',
      'register_sale_with_prices',
      'register_sale_with_items',
      'complete_sale_payment',
      'update_sale_order',
      'update_sale_delivery_status',
      'refresh_expense_daily_summaries',
      'save_cash_reconciliation'
    )
), audit_results(check_name, passed, observed) as (
  select feature, installed, detail
  from feature_status

  union all

  select
    table_name || '.' || column_name || ' usa America/Managua',
    uses_managua,
    coalesce(column_default, 'columna sin default')
  from date_defaults

  union all

  select
    'funciones sin America/Guatemala',
    guatemala_count = 0,
    guatemala_count::text || ' funciones encontradas'
  from function_timezones

  union all

  select
    'funciones con America/Managua',
    managua_count > 0,
    managua_count::text || ' funciones encontradas'
  from function_timezones
)
select check_name, passed, observed
from audit_results
order by passed, check_name;

-- Guarda reglas generales de precio y plantillas reutilizables en preferencias.
begin;

alter table public.business_settings
  add column if not exists default_pricing_rules jsonb,
  add column if not exists pricing_rule_templates jsonb;

update public.business_settings
set default_pricing_rules = '{
  "economicFactor": 1,
  "standardFactor": 1.2,
  "premiumFactor": 1.5,
  "specialFactor": 2,
  "roundingStep": 5,
  "minimumPrice": 0,
  "maximumPrice": 0,
  "estimatedDamagePercent": 0,
  "liquidationDiscountPercent": 20,
  "wholesaleDiscountPercent": 15,
  "wholesaleMinQuantity": 6
}'::jsonb
where default_pricing_rules is null;

update public.business_settings
set pricing_rule_templates = '[]'::jsonb
where pricing_rule_templates is null;

alter table public.business_settings
  alter column default_pricing_rules set default '{
    "economicFactor": 1,
    "standardFactor": 1.2,
    "premiumFactor": 1.5,
    "specialFactor": 2,
    "roundingStep": 5,
    "minimumPrice": 0,
    "maximumPrice": 0,
    "estimatedDamagePercent": 0,
    "liquidationDiscountPercent": 20,
    "wholesaleDiscountPercent": 15,
    "wholesaleMinQuantity": 6
  }'::jsonb,
  alter column default_pricing_rules set not null,
  alter column pricing_rule_templates set default '[]'::jsonb,
  alter column pricing_rule_templates set not null;

alter table public.business_settings
  drop constraint if exists business_settings_pricing_rules_check;

alter table public.business_settings
  add constraint business_settings_pricing_rules_check
  check (
    jsonb_typeof(default_pricing_rules) = 'object'
    and jsonb_typeof(pricing_rule_templates) = 'array'
    and case
      when jsonb_typeof(pricing_rule_templates) = 'array'
      then jsonb_array_length(pricing_rule_templates) <= 20
      else false
    end
  );

notify pgrst, 'reload schema';
commit;

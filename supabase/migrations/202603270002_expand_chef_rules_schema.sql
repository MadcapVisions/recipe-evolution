alter table public.chef_rules
  alter column rule_text drop not null,
  add column if not exists rule_key text,
  add column if not exists subcategory text,
  add column if not exists layer text,
  add column if not exists exclusion_conditions jsonb not null default '{}'::jsonb,
  add column if not exists severity text,
  add column if not exists user_explanation text,
  add column if not exists failure_if_missing text,
  add column if not exists action_type text,
  add column if not exists action_payload_template jsonb,
  add column if not exists expected_score_impact integer not null default 0,
  add column if not exists confidence numeric(3,2) not null default 0.80,
  add column if not exists applicability text;

update public.chef_rules
set
  rule_key = coalesce(rule_key, regexp_replace(lower(title), '[^a-z0-9]+', '_', 'g')),
  layer = coalesce(layer, case
    when category = 'universal' then 'foundation'
    when category like 'baking%' or category like 'protein%' or category = 'flavor' or category = 'sauce' or category = 'grilling' then 'technique'
    when category like 'special%' then 'risk'
    else 'dish'
  end),
  severity = coalesce(severity, case
    when rule_type = 'warning' then 'high'
    when rule_type = 'mandatory' then 'high'
    else 'medium'
  end),
  user_explanation = coalesce(user_explanation, rule_text),
  applicability = coalesce(applicability, 'conditional')
where
  rule_key is null
  or layer is null
  or severity is null
  or user_explanation is null
  or applicability is null;

alter table public.chef_rules
  alter column rule_key set not null,
  alter column layer set not null,
  alter column severity set not null,
  alter column user_explanation set not null,
  alter column applicability set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chef_rules_rule_key_unique'
  ) then
    alter table public.chef_rules
      add constraint chef_rules_rule_key_unique unique (rule_key);
  end if;
end $$;

create index if not exists idx_chef_rules_layer on public.chef_rules(layer);
create index if not exists idx_chef_rules_category on public.chef_rules(category);

-- Milestone 1 feature flags
-- All disabled by default — enable individually per rollout checklist (Ticket 10.2)

insert into public.feature_flags (key, value, updated_at)
values
  ('intent_resolver_v2',        false, now()),
  ('draft_recipe_lifecycle_v1', false, now()),
  ('create_guided_entry_v1',    false, now())
on conflict (key) do nothing;

-- Milestone 5 feature flags
-- All disabled by default — enable per rollout checklist after assisted planner,
-- overlap scoring, and grocery optimization are validated.

insert into public.feature_flags (key, value, updated_at)
values
  ('planner_assisted_v1',   false, now()),
  ('planner_overlap_v1',    false, now()),
  ('planner_grocery_opt_v1', false, now())
on conflict (key) do nothing;

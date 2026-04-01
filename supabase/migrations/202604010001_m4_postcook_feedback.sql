-- Milestone 4 Plan A: post-cook outcome event table.
--
-- Event model:
--   Each cooking outcome is a separate INSERT row — never upsert/overwrite.
--   Multiple rows per (user_id, recipe_version_id) are valid and expected.
--
-- Duplicate handling policy (enforced at the application layer, not DB layer):
--   Reject if (user_id, recipe_version_id, overall_outcome) matches a row
--   created within the last 30 seconds. Prevents accidental double-taps without
--   collapsing legitimate repeated cook sessions.
--
-- Version integrity:
--   recipe_version_id is stored as-is. Do not merge events across versions at
--   the storage layer. Downstream consumers decide how to aggregate.

create table if not exists recipe_postcook_feedback (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  recipe_id         uuid        not null,
  recipe_version_id uuid        not null,
  overall_outcome   text        not null
                                check (overall_outcome in (
                                  'great', 'good_with_changes', 'disappointing', 'failed'
                                )),
  would_make_again  boolean,
  issues            text[]      not null default '{}',
  notes             text,
  created_at        timestamptz not null default now()
);

alter table recipe_postcook_feedback enable row level security;

create policy "owner_insert"
  on recipe_postcook_feedback for insert
  with check (auth.uid() = user_id);

create policy "owner_select"
  on recipe_postcook_feedback for select
  using (auth.uid() = user_id);

-- Per-user recency lookups (primary query pattern)
create index recipe_postcook_feedback_user_created_idx
  on recipe_postcook_feedback(user_id, created_at desc);

-- Version-specific event lookups
create index recipe_postcook_feedback_user_version_idx
  on recipe_postcook_feedback(user_id, recipe_version_id, created_at desc);

-- Recipe-level aggregation
create index recipe_postcook_feedback_user_recipe_idx
  on recipe_postcook_feedback(user_id, recipe_id, created_at desc);

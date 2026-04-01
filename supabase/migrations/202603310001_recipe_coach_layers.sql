-- Milestone 3: coaching sidecar persistence
-- Stores CookingCoach artifacts per recipe version.
-- One row per recipe version (enforced by unique constraint on recipe_version_id).

create table recipe_coach_layers (
  id                 uuid        primary key default gen_random_uuid(),
  recipe_version_id  uuid        not null unique references recipe_versions(id) on delete cascade,
  user_id            uuid        not null references auth.users(id) on delete cascade,
  coach_json         jsonb       not null,
  created_at         timestamptz not null default now()
);

alter table recipe_coach_layers enable row level security;

-- Owner-scoped: users can only access their own coach data
create policy "owner_access" on recipe_coach_layers
  for all
  using (auth.uid() = user_id);

-- Index for fast lookup by version
create index recipe_coach_layers_version_idx on recipe_coach_layers(recipe_version_id);

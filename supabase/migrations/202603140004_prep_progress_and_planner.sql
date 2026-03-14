alter table public.user_preferences
add column if not exists pantry_confident_staples text[];

create table if not exists public.recipe_prep_progress (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  version_id uuid not null references public.recipe_versions(id) on delete cascade,
  checklist_item_id text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_prep_progress_unique unique (owner_id, version_id, checklist_item_id)
);

create trigger recipe_prep_progress_set_updated_at
before update on public.recipe_prep_progress
for each row
execute function public.set_updated_at();

alter table public.recipe_prep_progress enable row level security;

create policy "recipe_prep_progress_select_own"
on public.recipe_prep_progress
for select
using (owner_id = auth.uid());

create policy "recipe_prep_progress_insert_own"
on public.recipe_prep_progress
for insert
with check (owner_id = auth.uid());

create policy "recipe_prep_progress_update_own"
on public.recipe_prep_progress
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "recipe_prep_progress_delete_own"
on public.recipe_prep_progress
for delete
using (owner_id = auth.uid());

create extension if not exists pgcrypto;

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  tags text[],
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  version_number integer not null,
  servings integer,
  prep_time_min integer,
  cook_time_min integer,
  difficulty text,
  ingredients_json jsonb not null,
  steps_json jsonb not null,
  notes text,
  change_log text,
  rating integer,
  ai_metadata_json jsonb,
  created_at timestamptz not null default now(),
  constraint recipe_versions_recipe_id_version_number_key unique (recipe_id, version_number)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger recipes_set_updated_at
before update on public.recipes
for each row
execute function public.set_updated_at();

alter table public.recipes enable row level security;
alter table public.recipe_versions enable row level security;

create policy "recipes_select_own"
on public.recipes
for select
using (owner_id = auth.uid());

create policy "recipes_insert_own"
on public.recipes
for insert
with check (owner_id = auth.uid());

create policy "recipes_update_own"
on public.recipes
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "recipes_delete_own"
on public.recipes
for delete
using (owner_id = auth.uid());

create policy "recipe_versions_select_if_owner"
on public.recipe_versions
for select
using (
  exists (
    select 1
    from public.recipes r
    where r.id = recipe_id
      and r.owner_id = auth.uid()
  )
);

create policy "recipe_versions_insert_if_owner"
on public.recipe_versions
for insert
with check (
  exists (
    select 1
    from public.recipes r
    where r.id = recipe_id
      and r.owner_id = auth.uid()
  )
);

create policy "recipe_versions_update_if_owner"
on public.recipe_versions
for update
using (
  exists (
    select 1
    from public.recipes r
    where r.id = recipe_id
      and r.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.recipes r
    where r.id = recipe_id
      and r.owner_id = auth.uid()
  )
);

create policy "recipe_versions_delete_if_owner"
on public.recipe_versions
for delete
using (
  exists (
    select 1
    from public.recipes r
    where r.id = recipe_id
      and r.owner_id = auth.uid()
  )
);

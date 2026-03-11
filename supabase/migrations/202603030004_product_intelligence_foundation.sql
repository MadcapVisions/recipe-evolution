create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

alter table public.product_events enable row level security;

create policy "product_events_insert_own"
on public.product_events
for insert
with check (owner_id = auth.uid());

create policy "product_events_select_own"
on public.product_events
for select
using (owner_id = auth.uid());

alter table public.recipes
add column if not exists best_version_id uuid references public.recipe_versions(id) on delete set null;

create or replace function public.validate_recipe_best_version()
returns trigger
language plpgsql
as $$
begin
  if new.best_version_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.recipe_versions rv
    where rv.id = new.best_version_id
      and rv.recipe_id = new.id
  ) then
    raise exception 'best_version_id must belong to this recipe';
  end if;

  return new;
end;
$$;

create trigger validate_recipe_best_version_trigger
before insert or update on public.recipes
for each row
execute function public.validate_recipe_best_version();

create or replace function public.enforce_recipe_limit()
returns trigger
language plpgsql
as $$
declare
  recipe_count integer;
begin
  select count(*)
  into recipe_count
  from public.recipes
  where owner_id = new.owner_id;

  if recipe_count >= 50 then
    raise exception 'recipe_limit_exceeded';
  end if;

  return new;
end;
$$;

create trigger enforce_recipe_limit_trigger
before insert on public.recipes
for each row
execute function public.enforce_recipe_limit();

create table public.user_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  preferred_units text not null default 'metric',
  common_diet_tags text[],
  disliked_ingredients text[],
  cooking_skill_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

create policy "user_preferences_select_own"
on public.user_preferences
for select
using (owner_id = auth.uid());

create policy "user_preferences_update_own"
on public.user_preferences
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "user_preferences_insert_own"
on public.user_preferences
for insert
with check (owner_id = auth.uid());

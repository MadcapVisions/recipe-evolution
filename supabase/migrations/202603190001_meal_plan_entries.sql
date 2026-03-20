create table if not exists public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  sort_order integer not null default 0,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  version_id uuid not null references public.recipe_versions(id) on delete cascade,
  servings integer not null check (servings > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_plan_entries_owner_date_sort_key unique (owner_id, plan_date, sort_order)
);

create index if not exists meal_plan_entries_owner_date_idx
on public.meal_plan_entries (owner_id, plan_date);

drop trigger if exists meal_plan_entries_set_updated_at on public.meal_plan_entries;
create trigger meal_plan_entries_set_updated_at
before update on public.meal_plan_entries
for each row
execute function public.set_updated_at();

alter table public.meal_plan_entries enable row level security;

create policy "meal_plan_entries_select_own"
on public.meal_plan_entries
for select
using (owner_id = auth.uid());

create policy "meal_plan_entries_insert_own"
on public.meal_plan_entries
for insert
with check (owner_id = auth.uid());

create policy "meal_plan_entries_update_own"
on public.meal_plan_entries
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "meal_plan_entries_delete_own"
on public.meal_plan_entries
for delete
using (owner_id = auth.uid());

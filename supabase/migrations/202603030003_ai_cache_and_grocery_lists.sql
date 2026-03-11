create table public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('structure', 'refine')),
  input_hash text not null,
  model text not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  constraint ai_cache_owner_purpose_input_hash_model_key unique (owner_id, purpose, input_hash, model)
);

alter table public.ai_cache enable row level security;

create policy "ai_cache_select_own"
on public.ai_cache
for select
using (owner_id = auth.uid());

create policy "ai_cache_insert_own"
on public.ai_cache
for insert
with check (owner_id = auth.uid());

create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  version_id uuid not null references public.recipe_versions(id) on delete cascade,
  items_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grocery_lists_owner_version_key unique (owner_id, version_id)
);

create trigger grocery_lists_set_updated_at
before update on public.grocery_lists
for each row
execute function public.set_updated_at();

alter table public.grocery_lists enable row level security;

create policy "grocery_lists_select_own"
on public.grocery_lists
for select
using (owner_id = auth.uid());

create policy "grocery_lists_insert_own"
on public.grocery_lists
for insert
with check (owner_id = auth.uid());

create policy "grocery_lists_update_own"
on public.grocery_lists
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "grocery_lists_delete_own"
on public.grocery_lists
for delete
using (owner_id = auth.uid());

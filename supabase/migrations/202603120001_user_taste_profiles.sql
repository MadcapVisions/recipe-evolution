alter table public.user_preferences
add column if not exists favorite_cuisines text[],
add column if not exists favorite_proteins text[],
add column if not exists preferred_flavors text[],
add column if not exists pantry_staples text[],
add column if not exists spice_tolerance text,
add column if not exists health_goals text[],
add column if not exists taste_notes text;

create table if not exists public.user_taste_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  explicit_summary text,
  inferred_summary text,
  combined_summary text,
  inferred_signals_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_taste_profiles_set_updated_at on public.user_taste_profiles;
create trigger user_taste_profiles_set_updated_at
before update on public.user_taste_profiles
for each row
execute function public.set_updated_at();

alter table public.user_taste_profiles enable row level security;

create policy "user_taste_profiles_select_own"
on public.user_taste_profiles
for select
using (owner_id = auth.uid());

create policy "user_taste_profiles_insert_own"
on public.user_taste_profiles
for insert
with check (owner_id = auth.uid());

create policy "user_taste_profiles_update_own"
on public.user_taste_profiles
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

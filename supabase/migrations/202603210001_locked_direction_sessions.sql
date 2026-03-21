create table if not exists public.ai_locked_direction_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_key text not null,
  scope text not null,
  state text not null default 'exploring',
  session_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, conversation_key, scope)
);

alter table public.ai_locked_direction_sessions enable row level security;

create policy "locked direction sessions are owner readable"
on public.ai_locked_direction_sessions
for select
using (auth.uid() = owner_id);

create policy "locked direction sessions are owner writable"
on public.ai_locked_direction_sessions
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

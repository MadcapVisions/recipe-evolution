create table if not exists public.ai_recipe_session_states (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_key text not null,
  scope text not null check (scope in ('home_hub', 'recipe_detail')),
  recipe_id uuid references public.recipes(id) on delete set null,
  version_id uuid references public.recipe_versions(id) on delete set null,
  state_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, conversation_key, scope)
);

create index if not exists ai_recipe_session_states_owner_scope_idx
on public.ai_recipe_session_states (owner_id, scope, updated_at desc);

create index if not exists ai_recipe_session_states_conversation_idx
on public.ai_recipe_session_states (conversation_key, updated_at desc);

alter table public.ai_recipe_session_states enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_recipe_session_states'
      and policyname = 'ai_recipe_session_states_select_own'
  ) then
    create policy "ai_recipe_session_states_select_own"
    on public.ai_recipe_session_states
    for select
    using (owner_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_recipe_session_states'
      and policyname = 'ai_recipe_session_states_write_own'
  ) then
    create policy "ai_recipe_session_states_write_own"
    on public.ai_recipe_session_states
    for all
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());
  end if;
end $$;


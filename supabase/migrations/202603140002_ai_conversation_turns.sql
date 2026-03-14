create table if not exists public.ai_conversation_turns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_key text not null,
  scope text not null check (scope in ('home_hub', 'recipe_detail')),
  recipe_id uuid references public.recipes(id) on delete cascade,
  version_id uuid references public.recipe_versions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  message text not null,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_conversation_turns_owner_scope_created_idx
on public.ai_conversation_turns (owner_id, scope, created_at desc);

create index if not exists ai_conversation_turns_conversation_key_idx
on public.ai_conversation_turns (conversation_key, created_at asc);

alter table public.ai_conversation_turns enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_conversation_turns'
      and policyname = 'ai_conversation_turns_select_own'
  ) then
    create policy "ai_conversation_turns_select_own"
    on public.ai_conversation_turns
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
      and tablename = 'ai_conversation_turns'
      and policyname = 'ai_conversation_turns_insert_own'
  ) then
    create policy "ai_conversation_turns_insert_own"
    on public.ai_conversation_turns
    for insert
    with check (owner_id = auth.uid());
  end if;
end $$;

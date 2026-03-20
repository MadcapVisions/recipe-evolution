create table if not exists public.ai_cooking_briefs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_key text not null,
  scope text not null check (scope in ('home_hub', 'recipe_detail')),
  recipe_id uuid references public.recipes(id) on delete cascade,
  version_id uuid references public.recipe_versions(id) on delete cascade,
  brief_json jsonb not null,
  confidence numeric(5,4),
  is_locked boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_cooking_briefs_owner_conversation_scope_key unique (owner_id, conversation_key, scope)
);

create index if not exists ai_cooking_briefs_owner_scope_updated_idx
on public.ai_cooking_briefs (owner_id, scope, updated_at desc);

create index if not exists ai_cooking_briefs_conversation_key_idx
on public.ai_cooking_briefs (conversation_key);

create or replace function public.set_ai_cooking_briefs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists ai_cooking_briefs_set_updated_at on public.ai_cooking_briefs;
create trigger ai_cooking_briefs_set_updated_at
before update on public.ai_cooking_briefs
for each row
execute function public.set_ai_cooking_briefs_updated_at();

alter table public.ai_cooking_briefs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_cooking_briefs'
      and policyname = 'ai_cooking_briefs_select_own'
  ) then
    create policy "ai_cooking_briefs_select_own"
    on public.ai_cooking_briefs
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
      and tablename = 'ai_cooking_briefs'
      and policyname = 'ai_cooking_briefs_insert_own'
  ) then
    create policy "ai_cooking_briefs_insert_own"
    on public.ai_cooking_briefs
    for insert
    with check (owner_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_cooking_briefs'
      and policyname = 'ai_cooking_briefs_update_own'
  ) then
    create policy "ai_cooking_briefs_update_own"
    on public.ai_cooking_briefs
    for update
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());
  end if;
end $$;

create table if not exists public.ai_generation_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_key text not null,
  scope text not null check (scope in ('home_hub', 'recipe_detail')),
  recipe_id uuid references public.recipes(id) on delete set null,
  version_id uuid references public.recipe_versions(id) on delete set null,
  request_mode text,
  state_before text,
  state_after text,
  cooking_brief_json jsonb,
  recipe_plan_json jsonb,
  generator_payload_json jsonb,
  raw_model_output_json jsonb,
  normalized_recipe_json jsonb,
  verification_json jsonb,
  stage_metrics_json jsonb,
  provider text,
  model text,
  attempt_number integer not null default 1,
  outcome text not null check (outcome in ('passed', 'failed_verification', 'parse_failed', 'generation_failed', 'blocked')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_generation_attempts_owner_scope_created_idx
on public.ai_generation_attempts (owner_id, scope, created_at desc);

create index if not exists ai_generation_attempts_conversation_key_idx
on public.ai_generation_attempts (conversation_key, created_at desc);

create index if not exists ai_generation_attempts_outcome_idx
on public.ai_generation_attempts (outcome, created_at desc);

alter table public.ai_generation_attempts enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_generation_attempts'
      and policyname = 'ai_generation_attempts_select_own'
  ) then
    create policy "ai_generation_attempts_select_own"
    on public.ai_generation_attempts
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
      and tablename = 'ai_generation_attempts'
      and policyname = 'ai_generation_attempts_insert_own'
  ) then
    create policy "ai_generation_attempts_insert_own"
    on public.ai_generation_attempts
    for insert
    with check (owner_id = auth.uid());
  end if;
end $$;

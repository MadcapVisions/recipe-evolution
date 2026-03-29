alter table public.ai_task_settings
drop constraint if exists ai_task_settings_task_key_check;

alter table public.ai_task_settings
add constraint ai_task_settings_task_key_check
check (task_key in ('chef_chat', 'home_ideas', 'home_recipe', 'recipe_cia', 'recipe_improvement', 'recipe_structure'));

insert into public.ai_task_settings (
  task_key,
  primary_model,
  fallback_model,
  temperature,
  max_tokens,
  enabled
)
values
  ('recipe_cia', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-haiku', 0.10, 900, true)
on conflict (task_key) do nothing;

create table if not exists public.ai_cia_adjudications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_key text,
  scope text check (scope in ('home_hub', 'recipe_detail')),
  recipe_id uuid references public.recipes(id) on delete set null,
  version_id uuid references public.recipe_versions(id) on delete set null,
  flow text not null check (flow in ('home_create', 'recipe_improve', 'recipe_import')),
  task_key text not null check (task_key = 'recipe_cia'),
  parent_task_key text,
  failure_kind text not null,
  failure_stage text,
  adjudicator_source text not null check (adjudicator_source in ('heuristic', 'ai', 'default')),
  decision text not null check (decision in ('keep_failure', 'sanitize_constraints', 'return_structured_recipe', 'clarify_intent')),
  confidence numeric(5,4),
  summary text,
  retry_strategy text,
  provider text,
  model text,
  packet_json jsonb not null,
  result_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_cia_adjudications_owner_created_idx
on public.ai_cia_adjudications (owner_id, created_at desc);

create index if not exists ai_cia_adjudications_flow_created_idx
on public.ai_cia_adjudications (flow, created_at desc);

create index if not exists ai_cia_adjudications_conversation_created_idx
on public.ai_cia_adjudications (conversation_key, created_at desc);

alter table public.ai_cia_adjudications enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_cia_adjudications'
      and policyname = 'ai_cia_adjudications_select_own'
  ) then
    create policy "ai_cia_adjudications_select_own"
    on public.ai_cia_adjudications
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
      and tablename = 'ai_cia_adjudications'
      and policyname = 'ai_cia_adjudications_insert_own'
  ) then
    create policy "ai_cia_adjudications_insert_own"
    on public.ai_cia_adjudications
    for insert
    with check (owner_id = auth.uid());
  end if;
end $$;

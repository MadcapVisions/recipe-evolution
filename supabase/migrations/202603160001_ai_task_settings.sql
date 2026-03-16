create table if not exists public.ai_task_settings (
  task_key text primary key check (task_key in ('chef_chat', 'home_ideas', 'home_recipe', 'recipe_improvement', 'recipe_structure')),
  primary_model text not null,
  fallback_model text,
  temperature numeric(4,2),
  max_tokens integer,
  enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_ai_task_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists ai_task_settings_updated_at on public.ai_task_settings;
create trigger ai_task_settings_updated_at
before update on public.ai_task_settings
for each row
execute function public.set_ai_task_settings_updated_at();

alter table public.ai_task_settings enable row level security;

drop policy if exists "ai_task_settings_no_client_access" on public.ai_task_settings;
create policy "ai_task_settings_no_client_access"
on public.ai_task_settings
for all
to authenticated
using (false)
with check (false);

insert into public.ai_task_settings (
  task_key,
  primary_model,
  fallback_model,
  temperature,
  max_tokens,
  enabled
)
values
  ('chef_chat', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 0.35, 600, true),
  ('home_ideas', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 0.70, 900, true),
  ('home_recipe', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o-mini', 0.70, 900, true),
  ('recipe_improvement', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o-mini', 0.70, 600, true),
  ('recipe_structure', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 0.20, 1200, true)
on conflict (task_key) do nothing;


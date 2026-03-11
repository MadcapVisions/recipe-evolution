create table if not exists public.recipe_visibility_states (
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  state text not null check (state in ('hidden', 'archived')),
  updated_at timestamptz not null default now(),
  primary key (owner_id, recipe_id)
);

create or replace function public.set_recipe_visibility_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'recipe_visibility_states_set_updated_at'
  ) then
    create trigger recipe_visibility_states_set_updated_at
    before update on public.recipe_visibility_states
    for each row
    execute function public.set_recipe_visibility_states_updated_at();
  end if;
end;
$$;

alter table public.recipe_visibility_states enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_visibility_states'
      and policyname = 'recipe_visibility_states_select_own'
  ) then
    create policy "recipe_visibility_states_select_own"
    on public.recipe_visibility_states
    for select
    using (auth.uid() = owner_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_visibility_states'
      and policyname = 'recipe_visibility_states_insert_own'
  ) then
    create policy "recipe_visibility_states_insert_own"
    on public.recipe_visibility_states
    for insert
    with check (auth.uid() = owner_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_visibility_states'
      and policyname = 'recipe_visibility_states_update_own'
  ) then
    create policy "recipe_visibility_states_update_own"
    on public.recipe_visibility_states
    for update
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_visibility_states'
      and policyname = 'recipe_visibility_states_delete_own'
  ) then
    create policy "recipe_visibility_states_delete_own"
    on public.recipe_visibility_states
    for delete
    using (auth.uid() = owner_id);
  end if;
end;
$$;

create table public.version_photos (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.recipe_versions(id) on delete cascade,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

alter table public.version_photos enable row level security;

create policy "version_photos_select_if_owner"
on public.version_photos
for select
using (
  exists (
    select 1
    from public.recipe_versions rv
    join public.recipes r on r.id = rv.recipe_id
    where rv.id = version_id
      and r.owner_id = auth.uid()
  )
);

create policy "version_photos_insert_if_owner"
on public.version_photos
for insert
with check (
  exists (
    select 1
    from public.recipe_versions rv
    join public.recipes r on r.id = rv.recipe_id
    where rv.id = version_id
      and r.owner_id = auth.uid()
  )
);

create policy "version_photos_delete_if_owner"
on public.version_photos
for delete
using (
  exists (
    select 1
    from public.recipe_versions rv
    join public.recipes r on r.id = rv.recipe_id
    where rv.id = version_id
      and r.owner_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('version-photos', 'version-photos', false)
on conflict (id) do update set public = false;

create policy "version_photos_storage_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'version-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "version_photos_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'version-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "version_photos_storage_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'version-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create table public.cook_sessions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.recipe_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  share_slug text unique not null,
  current_step_index integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.cook_sessions enable row level security;

create policy "cook_sessions_owner_select"
on public.cook_sessions
for select
using (owner_id = auth.uid());

create policy "cook_sessions_public_active_select"
on public.cook_sessions
for select
using (is_active = true);

create policy "recipe_versions_select_for_active_live_session"
on public.recipe_versions
for select
using (
  exists (
    select 1
    from public.cook_sessions cs
    where cs.version_id = id
      and cs.is_active = true
  )
);

create policy "cook_sessions_owner_insert"
on public.cook_sessions
for insert
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.recipe_versions rv
    join public.recipes r on r.id = rv.recipe_id
    where rv.id = version_id
      and r.owner_id = auth.uid()
  )
);

create policy "cook_sessions_owner_update"
on public.cook_sessions
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "cook_sessions_owner_delete"
on public.cook_sessions
for delete
using (owner_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cook_sessions'
  ) then
    alter publication supabase_realtime add table public.cook_sessions;
  end if;
end
$$;

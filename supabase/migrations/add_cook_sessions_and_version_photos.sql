create table if not exists public.version_photos (
  id uuid primary key default gen_random_uuid(),
  version_id uuid references public.recipe_versions(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz default now()
);

alter table public.version_photos enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'version_photos'
      and policyname = 'version_photos_owner_access'
  ) then
    create policy "version_photos_owner_access"
    on public.version_photos
    for all
    using (
      exists (
        select 1
        from public.recipe_versions rv
        join public.recipes r on r.id = rv.recipe_id
        where rv.id = version_id
          and r.owner_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.recipe_versions rv
        join public.recipes r on r.id = rv.recipe_id
        where rv.id = version_id
          and r.owner_id = auth.uid()
      )
    );
  end if;
end
$$;

create table if not exists public.cook_sessions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid references public.recipe_versions(id),
  owner_id uuid references auth.users(id),
  share_slug text unique,
  current_step_index int default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  ended_at timestamptz
);

alter table public.cook_sessions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cook_sessions'
      and policyname = 'cook_sessions_owner_only'
  ) then
    create policy "cook_sessions_owner_only"
    on public.cook_sessions
    for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'version_photos_storage_select'
  ) then
    create policy "version_photos_storage_select"
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'version-photos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'version_photos_storage_insert'
  ) then
    create policy "version_photos_storage_insert"
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'version-photos');
  end if;
end
$$;

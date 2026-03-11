create table if not exists public.version_photos (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.recipe_versions(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.version_photos enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'version_photos'
      and policyname = 'version_photos_select_if_owner'
  ) then
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
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'version_photos'
      and policyname = 'version_photos_insert_if_owner'
  ) then
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
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'version_photos'
      and policyname = 'version_photos_delete_if_owner'
  ) then
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
  end if;
end
$$;

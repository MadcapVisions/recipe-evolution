-- Index on version_photos(version_id) — PostgreSQL does NOT auto-create indexes
-- on FK columns, so every photo lookup by version_id was a sequential scan.
create index if not exists version_photos_version_id_idx
  on public.version_photos(version_id);

-- RPC: returns one row per recipe with version count, latest version id,
-- and latest servings — replacing the full version-table scan in the browse page.
-- Uses DISTINCT ON so the planner can satisfy both in a single index pass over
-- (recipe_id, version_number DESC) from the existing unique constraint.
create or replace function public.get_recipe_version_summaries(
  p_owner_id  uuid,
  p_recipe_ids uuid[]
)
returns table (
  recipe_id          uuid,
  version_count      bigint,
  latest_version_id  uuid,
  latest_servings    integer
)
language sql
stable
security definer
set search_path = public
as $$
  with all_versions as (
    select rv.id, rv.recipe_id, rv.servings, rv.version_number
    from public.recipe_versions rv
    join public.recipes r on r.id = rv.recipe_id
    where rv.recipe_id = any(p_recipe_ids)
      and r.owner_id = p_owner_id
  ),
  counts as (
    select recipe_id, count(*) as version_count
    from all_versions
    group by recipe_id
  ),
  latest as (
    select distinct on (recipe_id)
      recipe_id,
      id              as latest_version_id,
      servings        as latest_servings
    from all_versions
    order by recipe_id, version_number desc
  )
  select c.recipe_id, c.version_count, l.latest_version_id, l.latest_servings
  from counts c
  join latest l using (recipe_id)
$$;

revoke all on function public.get_recipe_version_summaries(uuid, uuid[]) from public;
grant execute on function public.get_recipe_version_summaries(uuid, uuid[]) to authenticated;

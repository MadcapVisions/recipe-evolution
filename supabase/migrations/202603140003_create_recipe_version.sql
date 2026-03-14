create or replace function public.create_recipe_version(
  p_recipe_id uuid,
  p_version_label text default null,
  p_change_summary text default null,
  p_servings integer default null,
  p_prep_time_min integer default null,
  p_cook_time_min integer default null,
  p_difficulty text default null,
  p_ingredients_json jsonb default '[]'::jsonb,
  p_steps_json jsonb default '[]'::jsonb,
  p_notes text default null,
  p_change_log text default null,
  p_ai_metadata_json jsonb default null
)
returns table (
  id uuid,
  recipe_id uuid,
  version_number integer,
  version_label text,
  change_summary text,
  servings integer,
  prep_time_min integer,
  cook_time_min integer,
  difficulty text,
  ingredients_json jsonb,
  steps_json jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe_owner_id uuid;
  v_next_version_number integer;
  v_inserted public.recipe_versions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_recipe_id is null then
    raise exception 'Recipe is required.';
  end if;

  if jsonb_typeof(p_ingredients_json) is distinct from 'array' or jsonb_array_length(p_ingredients_json) = 0 then
    raise exception 'At least one ingredient is required.';
  end if;

  if jsonb_typeof(p_steps_json) is distinct from 'array' or jsonb_array_length(p_steps_json) = 0 then
    raise exception 'At least one step is required.';
  end if;

  select r.owner_id
  into v_recipe_owner_id
  from public.recipes r
  where r.id = p_recipe_id
  for update;

  if v_recipe_owner_id is null then
    raise exception 'Recipe not found.';
  end if;

  if v_recipe_owner_id is distinct from auth.uid() then
    raise exception 'Recipe not found or access denied.';
  end if;

  select coalesce(max(rv.version_number), 0) + 1
  into v_next_version_number
  from public.recipe_versions rv
  where rv.recipe_id = p_recipe_id;

  insert into public.recipe_versions (
    recipe_id,
    version_number,
    version_label,
    change_summary,
    servings,
    prep_time_min,
    cook_time_min,
    difficulty,
    ingredients_json,
    steps_json,
    notes,
    change_log,
    ai_metadata_json
  )
  values (
    p_recipe_id,
    v_next_version_number,
    nullif(btrim(coalesce(p_version_label, '')), ''),
    nullif(btrim(coalesce(p_change_summary, '')), ''),
    p_servings,
    p_prep_time_min,
    p_cook_time_min,
    nullif(btrim(coalesce(p_difficulty, '')), ''),
    p_ingredients_json,
    p_steps_json,
    nullif(btrim(coalesce(p_notes, '')), ''),
    nullif(btrim(coalesce(p_change_log, '')), ''),
    p_ai_metadata_json
  )
  returning *
  into v_inserted;

  id := v_inserted.id;
  recipe_id := v_inserted.recipe_id;
  version_number := v_inserted.version_number;
  version_label := v_inserted.version_label;
  change_summary := v_inserted.change_summary;
  servings := v_inserted.servings;
  prep_time_min := v_inserted.prep_time_min;
  cook_time_min := v_inserted.cook_time_min;
  difficulty := v_inserted.difficulty;
  ingredients_json := v_inserted.ingredients_json;
  steps_json := v_inserted.steps_json;
  created_at := v_inserted.created_at;
  return next;
end;
$$;

revoke all on function public.create_recipe_version(
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  text,
  jsonb,
  jsonb,
  text,
  text,
  jsonb
) from public;

grant execute on function public.create_recipe_version(
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  text,
  jsonb,
  jsonb,
  text,
  text,
  jsonb
) to authenticated;

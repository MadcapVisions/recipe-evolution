create or replace function public.create_recipe_with_initial_version(
  p_owner_id uuid,
  p_title text,
  p_description text default null,
  p_tags text[] default null,
  p_version_number integer default 1,
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
  recipe_id uuid,
  version_id uuid,
  version_number integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe_id uuid;
  v_version_id uuid;
  v_version_number integer := coalesce(p_version_number, 1);
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_owner_id is distinct from auth.uid() then
    raise exception 'Owner mismatch.';
  end if;

  if p_title is null or btrim(p_title) = '' then
    raise exception 'Title is required.';
  end if;

  if jsonb_typeof(p_ingredients_json) is distinct from 'array' or jsonb_array_length(p_ingredients_json) = 0 then
    raise exception 'At least one ingredient is required.';
  end if;

  if jsonb_typeof(p_steps_json) is distinct from 'array' or jsonb_array_length(p_steps_json) = 0 then
    raise exception 'At least one step is required.';
  end if;

  insert into public.recipes (
    owner_id,
    title,
    description,
    tags
  )
  values (
    p_owner_id,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    case
      when p_tags is null or cardinality(p_tags) = 0 then null
      else p_tags
    end
  )
  returning id into v_recipe_id;

  insert into public.recipe_versions (
    recipe_id,
    version_number,
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
    v_recipe_id,
    v_version_number,
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
  returning id, public.recipe_versions.version_number into v_version_id, v_version_number;

  recipe_id := v_recipe_id;
  version_id := v_version_id;
  version_number := v_version_number;
  return next;
end;
$$;

revoke all on function public.create_recipe_with_initial_version(
  uuid,
  text,
  text,
  text[],
  integer,
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

grant execute on function public.create_recipe_with_initial_version(
  uuid,
  text,
  text,
  text[],
  integer,
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

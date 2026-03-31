-- docs/locked-session-audit.sql
-- Run these queries in the Supabase SQL editor (read-only) to audit
-- ai_locked_direction_sessions records for backward compatibility.

-- 1. Record count and state distribution
SELECT
  state,
  COUNT(*) AS record_count
FROM ai_locked_direction_sessions
GROUP BY state
ORDER BY record_count DESC;

-- 2. build_spec presence rate
SELECT
  CASE
    WHEN session_json->>'build_spec' IS NULL OR session_json->>'build_spec' = 'null'
      THEN 'null (legacy)'
    WHEN (session_json->'build_spec'->>'derived_at') = 'lock_time'
      THEN 'valid (lock_time sentinel present)'
    ELSE 'present but invalid sentinel'
  END AS build_spec_status,
  COUNT(*) AS record_count
FROM ai_locked_direction_sessions
GROUP BY build_spec_status
ORDER BY record_count DESC;

-- 3. Refinement optional-field coverage (sample first 500 records)
SELECT
  id,
  state,
  jsonb_array_length(session_json->'refinements') AS refinement_count,
  CASE
    WHEN session_json->'refinements'->0 IS NULL THEN 'no refinements'
    WHEN session_json->'refinements'->0->'resolved_ingredient_intents' IS NULL THEN 'missing resolved_ingredient_intents'
    ELSE 'has resolved_ingredient_intents'
  END AS refinement_shape,
  CASE
    WHEN session_json->'refinements'->0 IS NULL THEN 'no refinements'
    WHEN session_json->'refinements'->0->'extracted_changes'->'ingredient_provenance' IS NULL THEN 'missing ingredient_provenance'
    ELSE 'has ingredient_provenance'
  END AS provenance_shape
FROM ai_locked_direction_sessions
LIMIT 500;

-- 4. Spot-check: any sessions with state values outside the known enum
SELECT DISTINCT state
FROM ai_locked_direction_sessions
WHERE state NOT IN (
  'exploring', 'direction_locked', 'ready_to_build', 'building', 'built'
);

-- 5. Spot-check: any sessions with build_spec dish_family not in canonical list
SELECT
  id,
  session_json->'build_spec'->>'dish_family' AS dish_family_value
FROM ai_locked_direction_sessions
WHERE
  session_json->'build_spec' IS NOT NULL
  AND session_json->'build_spec' != 'null'::jsonb
  AND session_json->'build_spec'->>'derived_at' = 'lock_time'
  -- KEEP IN SYNC WITH: lib/ai/homeRecipeAlignment.ts DISH_FAMILIES
  AND session_json->'build_spec'->>'dish_family' NOT IN (
    'brownies_bars','muffins_scones','cookies','cake','pastry','fried_pastry',
    'dessert_bread','bread','pie','tart','frozen_dessert','bread_pudding','custard_pudding',
    'candy_confection','dessert','pizza','flatbread','noodle_soup','pasta','stir_fry',
    'tamales','tacos','burger','sandwich','wraps','spring_rolls','dumplings','savory_pastry',
    'chili','soup','curry','rice','grains','salad','dips_spreads','sauce_condiment',
    'egg_dish','pancakes_crepes','savory_pancake','porridge_cereal','breakfast',
    'pot_pie','casserole','braised','stuffed','grilled_bbq','fried','roasted',
    'steamed','fritters_patties','meatballs_ground_meat','sushi_raw','raw_cured',
    'seafood_fish','chicken_poultry','sausage','tofu_tempeh','beans_legumes',
    'potato','vegetable_side','skillet','bowl','beverage','preserve','pickled_fermented',
    'appetizer_snack','board_platter','souffle','fondue'
  )
  AND session_json->'build_spec'->>'dish_family' IS NOT NULL;

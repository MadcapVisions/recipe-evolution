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
  AND session_json->'build_spec'->>'dish_family' NOT IN (
    'stir_fry','pasta','pizza','soup','salad','sandwich','burger','tacos',
    'curry','bread','cake','cookies','brownies_bars','muffins_scones',
    'pie','tart','casserole','stew','roast','grilled_meat','grilled_fish',
    'fried_chicken','fried_fish','seafood','sushi','ramen','noodle_soup',
    'congee','rice','bowl','flatbread','dumplings','wraps','quesadilla',
    'frittata','omelet','pancakes','waffles','granola','smoothie','beverage',
    'ice_cream','pudding','mousse','cheesecake','trifle','crepes',
    'bread_pudding','jam_preserve','pickle','fermented','sauce_condiment',
    'soup_cream','chowder','bisque','rillettes','terrine','pate',
    'ceviche','tartare','carpaccio','bruschetta','crostini'
  )
  AND session_json->'build_spec'->>'dish_family' IS NOT NULL;

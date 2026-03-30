import type { BuildSpec } from "../contracts/buildSpec";
import type { ResolvedCookingIntent } from "./intentTypes";
import { DISH_FAMILIES, type DishFamily } from "../homeRecipeAlignment";

const DISH_FAMILY_SET = new Set<string>(DISH_FAMILIES);

// Families where dish format is locked — must_preserve_format = true
const FORMAT_LOCKED_FAMILIES = new Set<string>([
  "pizza", "flatbread", "pasta", "tacos", "dumplings", "burger", "sandwich",
  "wraps", "soup", "curry", "bread", "pie", "tart", "cake", "cookies",
  "muffins_scones", "brownies_bars", "rice", "bowl", "salad",
]);

function isKnownDishFamily(value: string | null): value is DishFamily {
  return value !== null && DISH_FAMILY_SET.has(value);
}

/**
 * Bridges ResolvedCookingIntent → BuildSpec.
 *
 * BuildSpec is a temporary downstream execution contract. CookingBrief is no
 * longer the upstream semantic source in migrated flows — this adapter replaces
 * the old briefCompiler → buildSpecDeriver chain for migrated routes.
 */
export function resolvedIntentToBuildSpec(intent: ResolvedCookingIntent): BuildSpec {
  const dishFamily = isKnownDishFamily(intent.dishFamily) ? intent.dishFamily : null;

  const requiredIngredients = intent.constraints
    .filter((c) => c.type === "ingredient" && c.strength === "hard")
    .map((c) => c.value);

  const forbiddenIngredients = intent.constraints
    .filter((c) => c.type === "forbidden_ingredient")
    .map((c) => c.value);

  const styleTags = intent.constraints
    .filter((c) => c.type === "style")
    .map((c) => c.value);

  const buildTitle = intent.dishName ?? intent.rawUserPhrase ?? "Recipe";

  return {
    dish_family: dishFamily,
    display_title: buildTitle,
    build_title: buildTitle,
    primary_anchor_type: intent.dishName ? "dish" : null,
    primary_anchor_value: intent.dishName,
    required_ingredients: requiredIngredients,
    forbidden_ingredients: forbiddenIngredients,
    style_tags: styleTags,
    must_preserve_format: dishFamily !== null && FORMAT_LOCKED_FAMILIES.has(dishFamily),
    confidence: intent.dishFamilyConfidence,
    derived_at: "lock_time",
    dish_family_source:
      intent.dishFamilyConfidence >= 0.7 ? "model" : "inferred",
    anchor_source: intent.dishName ? "model" : "none",
  };
}

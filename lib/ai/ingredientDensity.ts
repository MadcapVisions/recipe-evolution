/**
 * Ingredient density lookup
 *
 * Units: grams per ml
 *
 * These are rough kitchen-working values, not lab values.
 * Use only for ratio validation and macro approximations.
 * Conservative coverage is intentional — bad density is worse than missing density.
 */

export const INGREDIENT_DENSITY_G_PER_ML: Record<string, number> = {
  // ── Liquids ────────────────────────────────────────────────────────────
  water: 1.0,
  milk: 1.03,
  "milk, whole": 1.03,
  "whole milk": 1.03,
  "skim milk": 1.03,
  "heavy cream": 0.99,
  "whipping cream": 0.99,
  "half and half": 1.01,
  "half-and-half": 1.01,
  buttermilk: 1.03,
  yogurt: 1.04,
  "greek yogurt": 1.1,

  // ── Broths / stocks ────────────────────────────────────────────────────
  "chicken broth": 1.0,
  "beef broth": 1.0,
  "vegetable broth": 1.0,
  "chicken stock": 1.0,
  "beef stock": 1.0,
  "fish stock": 1.0,

  // ── Juices / acids ─────────────────────────────────────────────────────
  "lemon juice": 1.03,
  "lime juice": 1.03,
  "orange juice": 1.04,
  "apple juice": 1.04,
  "white wine vinegar": 1.0,
  "red wine vinegar": 1.01,
  "apple cider vinegar": 1.01,
  "balsamic vinegar": 1.09,
  vinegar: 1.01,

  // ── Oils / fats ────────────────────────────────────────────────────────
  "olive oil": 0.91,
  "extra virgin olive oil": 0.91,
  "vegetable oil": 0.92,
  "canola oil": 0.92,
  "coconut oil": 0.92,
  "avocado oil": 0.91,
  "sesame oil": 0.92,
  "peanut oil": 0.92,
  butter: 0.91,

  // ── Sweeteners ─────────────────────────────────────────────────────────
  "granulated sugar": 0.85,
  sugar: 0.85,
  "brown sugar": 0.72,
  "powdered sugar": 0.56,
  "confectioners sugar": 0.56,
  honey: 1.42,
  "maple syrup": 1.33,
  "corn syrup": 1.38,
  agave: 1.36,
  molasses: 1.47,

  // ── Dry goods ──────────────────────────────────────────────────────────
  "all-purpose flour": 0.53,
  "all purpose flour": 0.53,
  flour: 0.53,
  "bread flour": 0.54,
  "cake flour": 0.5,
  "whole wheat flour": 0.52,
  "almond flour": 0.38,
  "oat flour": 0.42,
  cornmeal: 0.68,
  "cocoa powder": 0.42,
  "baking powder": 0.9,
  "baking soda": 0.93,
  "oats": 0.34,
  "rolled oats": 0.34,

  // ── Grains ─────────────────────────────────────────────────────────────
  rice: 0.85,
  "arborio rice": 0.82,
  "white rice": 0.85,
  quinoa: 0.72,

  // ── Dairy / cheese ─────────────────────────────────────────────────────
  "cream cheese": 0.96,
  "sour cream": 1.01,
  "parmesan cheese": 0.5,
  "grated parmesan": 0.5,
  mozzarella: 0.6,
  ricotta: 1.0,

  // ── Sauces / condiments ────────────────────────────────────────────────
  "soy sauce": 1.16,
  tamari: 1.16,
  "fish sauce": 1.06,
  "tomato paste": 1.06,
  "tomato sauce": 1.04,
  "vanilla extract": 0.95,

  // ── Eggs (count-based — use quantity directly) ─────────────────────────
  // Eggs are handled via count in the resolver; density is for completeness
  egg: 1.0,
  eggs: 1.0,
};

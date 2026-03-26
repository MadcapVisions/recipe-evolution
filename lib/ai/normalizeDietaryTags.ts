/**
 * Maps freeform dietary tag strings from CookingBrief into the constrained
 * DietaryConstraint union used by the repair and planning pipeline.
 *
 * Unknown tags are silently dropped. This is intentional — the planner
 * should not fail on unfamiliar tags.
 */

import type { DietaryConstraint } from "./dishAwareRepairPlanner";

const DIETARY_TAG_MAP: Record<string, DietaryConstraint> = {
  // vegetarian
  vegetarian: "vegetarian",
  veggie: "vegetarian",

  // vegan
  vegan: "vegan",
  "plant-based": "vegan",
  "plant based": "vegan",
  plantbased: "vegan",

  // gluten free
  "gluten-free": "gluten_free",
  "gluten free": "gluten_free",
  gluten_free: "gluten_free",
  glutenfree: "gluten_free",
  gf: "gluten_free",
  "no gluten": "gluten_free",
  celiac: "gluten_free",

  // dairy free
  "dairy-free": "dairy_free",
  "dairy free": "dairy_free",
  dairy_free: "dairy_free",
  dairyfree: "dairy_free",
  "no dairy": "dairy_free",
  "lactose-free": "dairy_free",
  "lactose free": "dairy_free",
  lactose_free: "dairy_free",
  lactosefree: "dairy_free",

  // nut free
  "nut-free": "nut_free",
  "nut free": "nut_free",
  nut_free: "nut_free",
  nutfree: "nut_free",
  "no nuts": "nut_free",
  "peanut-free": "nut_free",
  "peanut free": "nut_free",
  peanut_free: "nut_free",
  peanutfree: "nut_free",
  "tree nut free": "nut_free",

  // low carb
  "low-carb": "low_carb",
  "low carb": "low_carb",
  low_carb: "low_carb",
  lowcarb: "low_carb",
  keto: "low_carb",
  ketogenic: "low_carb",
  "no carbs": "low_carb",

  // high protein
  "high-protein": "high_protein",
  "high protein": "high_protein",
  high_protein: "high_protein",
  highprotein: "high_protein",
  "protein-rich": "high_protein",
  "protein rich": "high_protein",
  protein_rich: "high_protein",
  proteinrich: "high_protein",
};

export function normalizeDietaryTags(tags: string[]): DietaryConstraint[] {
  const result: DietaryConstraint[] = [];
  const seen = new Set<DietaryConstraint>();

  for (const raw of tags) {
    const key = raw.trim().toLowerCase();
    const mapped = DIETARY_TAG_MAP[key];
    if (mapped && !seen.has(mapped)) {
      result.push(mapped);
      seen.add(mapped);
    }
  }

  return result;
}

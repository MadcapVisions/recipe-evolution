import type { IngredientRole } from "./blueprintTypes";
import { getFamilyBlueprintRule, FALLBACK_BLUEPRINT_RULE } from "./familyBlueprintRules";

/**
 * Canonical ingredient role assignment for migrated generation flows.
 *
 * This is the authoritative role system for blueprint-driven generation.
 * The substitutionEngine/ingredientRoles.ts stub (11-entry Record) is classified
 * as `deprecate-later` and is NOT imported here.
 *
 * See docs/decisions/module-overlap-audit.md.
 */

export const ROLE_LOOKUP: Record<string, IngredientRole> = {
  // Proteins
  "chicken": "protein",
  "chicken breast": "protein",
  "chicken thigh": "protein",
  "chicken thighs": "protein",
  "ground beef": "protein",
  "beef": "protein",
  "steak": "protein",
  "salmon": "protein",
  "shrimp": "protein",
  "tofu": "protein",
  "tempeh": "protein",
  "eggs": "protein",
  "egg": "protein",
  "lentils": "protein",
  "chickpeas": "protein",
  "white beans": "protein",
  "black beans": "protein",
  "pork": "protein",
  "sausage": "protein",
  "ground turkey": "protein",
  "turkey": "protein",

  // Bases
  "pasta": "base",
  "spaghetti": "base",
  "penne": "base",
  "fettuccine": "base",
  "rice": "base",
  "brown rice": "base",
  "white rice": "base",
  "jasmine rice": "base",
  "quinoa": "base",
  "farro": "base",
  "couscous": "base",
  "potatoes": "base",
  "sweet potatoes": "base",
  "bread": "base",
  "tortillas": "base",
  "noodles": "base",
  "orzo": "base",

  // Aromatics
  "onion": "aromatic",
  "yellow onion": "aromatic",
  "white onion": "aromatic",
  "red onion": "aromatic",
  "shallot": "aromatic",
  "shallots": "aromatic",
  "garlic": "aromatic",
  "ginger": "aromatic",
  "celery": "aromatic",
  "leek": "aromatic",
  "leeks": "aromatic",
  "scallion": "aromatic",
  "scallions": "aromatic",
  "green onion": "aromatic",
  "green onions": "aromatic",
  "fennel": "aromatic",
  "lemongrass": "aromatic",

  // Fats
  "olive oil": "fat",
  "extra virgin olive oil": "fat",
  "butter": "fat",
  "unsalted butter": "fat",
  "coconut oil": "fat",
  "neutral oil": "fat",
  "vegetable oil": "fat",
  "avocado oil": "fat",
  "cream": "fat",
  "heavy cream": "fat",
  "coconut milk": "fat",
  "tahini": "fat",
  "ghee": "fat",
  "sesame oil": "finish",   // sesame oil as finish drizzle, not cooking fat

  // Acids
  "lemon juice": "acid",
  "lemon": "acid",
  "lime juice": "acid",
  "lime": "acid",
  "white wine vinegar": "acid",
  "red wine vinegar": "acid",
  "apple cider vinegar": "acid",
  "balsamic vinegar": "acid",
  "white wine": "acid",
  "red wine": "acid",
  "tomatoes": "acid",
  "cherry tomatoes": "acid",
  "canned tomatoes": "acid",
  "diced tomatoes": "acid",
  "tomato paste": "umami",  // tomato paste = concentrated umami, not just acid

  // Umami
  "soy sauce": "umami",
  "tamari": "umami",
  "fish sauce": "umami",
  "parmesan": "umami",
  "parmesan cheese": "umami",
  "pecorino": "umami",
  "miso": "umami",
  "white miso": "umami",
  "worcestershire sauce": "umami",
  "anchovies": "umami",
  "mushrooms": "umami",
  "shiitake mushrooms": "umami",
  "cremini mushrooms": "umami",
  "dried mushrooms": "umami",
  "nutritional yeast": "umami",
  "oyster sauce": "umami",
  "hoisin sauce": "umami",

  // Heat
  "chili flakes": "heat",
  "red pepper flakes": "heat",
  "chili": "heat",
  "jalapeño": "heat",
  "jalapeños": "heat",
  "cayenne": "heat",
  "cayenne pepper": "heat",
  "sriracha": "heat",
  "harissa": "heat",
  "gochujang": "heat",
  "chili powder": "heat",

  // Sweetness
  "honey": "sweetness",
  "maple syrup": "sweetness",
  "sugar": "sweetness",
  "brown sugar": "sweetness",
  "mirin": "sweetness",
  "agave": "sweetness",

  // Texture
  "walnuts": "texture",
  "almonds": "texture",
  "pine nuts": "texture",
  "sesame seeds": "texture",
  "panko": "texture",
  "breadcrumbs": "texture",
  "pumpkin seeds": "texture",
  "sunflower seeds": "texture",
  "croutons": "texture",

  // Binders
  "cornstarch": "binder",
  "flour": "binder",
  "egg yolk": "binder",
  "arrowroot": "binder",

  // Liquids
  "chicken stock": "liquid",
  "chicken broth": "liquid",
  "vegetable stock": "liquid",
  "vegetable broth": "liquid",
  "beef stock": "liquid",
  "beef broth": "liquid",
  "water": "liquid",
  "broth": "liquid",
  "stock": "liquid",

  // Finish
  "fresh parsley": "finish",
  "fresh basil": "finish",
  "fresh cilantro": "finish",
  "fresh thyme": "finish",
  "fresh mint": "finish",
  "chives": "finish",
  "lemon zest": "finish",
  "lime zest": "finish",
  "orange zest": "finish",
  "truffle oil": "finish",
  "microgreens": "finish",

  // Seasoning
  "salt": "seasoning",
  "kosher salt": "seasoning",
  "sea salt": "seasoning",
  "black pepper": "seasoning",
  "white pepper": "seasoning",
};

export type RoleCoverageResult = {
  covered: boolean;
  missingRoles: IngredientRole[];
};

/**
 * Assign a culinary role to each ingredient name.
 * Returns a map of ingredient → IngredientRole | null.
 * null means the ingredient is not in the lookup (needs manual classification or LLM inference).
 */
export function assignIngredientRoles(
  ingredients: string[],
  _family: string
): Record<string, IngredientRole | null> {
  const result: Record<string, IngredientRole | null> = {};
  for (const ingredient of ingredients) {
    const normalized = ingredient.toLowerCase().trim();
    result[ingredient] = ROLE_LOOKUP[normalized] ?? null;
  }
  return result;
}

/**
 * Check whether the assigned roles satisfy the required roles for the given family.
 */
export function checkRoleCoverage(
  roleMap: Record<string, IngredientRole | null>,
  family: string
): RoleCoverageResult {
  const rule = getFamilyBlueprintRule(family) ?? FALLBACK_BLUEPRINT_RULE;
  const presentRoles = new Set(
    Object.values(roleMap).filter((r): r is IngredientRole => r !== null)
  );
  const missingRoles = rule.requiredRoles.filter((r) => !presentRoles.has(r));
  return {
    covered: missingRoles.length === 0,
    missingRoles,
  };
}

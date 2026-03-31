/**
 * Canonical culinary-planning contract for migrated generation flows.
 *
 * Authority hierarchy (migrated flows):
 *   ResolvedCookingIntent  — upstream semantic authority (lib/ai/intent/intentTypes.ts)
 *   CulinaryBlueprint      — culinary planning authority (this file)
 *   BuildSpec              — temporary downstream execution bridge (lib/ai/contracts/buildSpec.ts)
 *   CookingBrief           — legacy compatibility context only
 *   RecipePlan             — deprecated as planning authority in migrated flows
 *
 * See docs/decisions/authority-boundaries.md for full contract hierarchy.
 */

export type IngredientRole =
  | "base"       // foundational starch or grain (rice, pasta, bread, potato)
  | "protein"    // main protein source (chicken, tofu, beans, fish)
  | "aromatic"   // flavor-base aromatic (onion, garlic, shallot, celery, ginger)
  | "fat"        // cooking fat or fat component (butter, oil, cream, coconut milk)
  | "acid"       // acid balance (lemon juice, vinegar, white wine, tomato)
  | "sweetness"  // sweetening element (honey, sugar, mirin, caramelized onion)
  | "umami"      // savory depth (soy sauce, fish sauce, parmesan, mushroom, miso)
  | "heat"       // spice or heat element (chili, black pepper, ginger, red pepper flake)
  | "texture"    // textural contrast (nuts, breadcrumbs, crispy element, seeds)
  | "binder"     // structural binder (egg, cornstarch, roux flour)
  | "structure"  // primary load-bearing structure (flour in pastry/dough)
  | "liquid"     // cooking liquid (stock, water, wine, coconut milk as base)
  | "finish"     // final-touch element (fresh herb, citrus zest, butter mount, drizzle)
  | "garnish"    // purely visual or minor aromatic finish
  | "seasoning"; // salt, pepper, and fundamental base seasoning

export type RichnessLevel = "light" | "moderate" | "rich" | "indulgent";

export type CheckpointPhase = "prep" | "active_cook" | "finish" | "plate";

export type ComponentPurpose =
  | "main"
  | "sauce"
  | "base"
  | "side"
  | "garnish"
  | "texture_contrast";

export type BlueprintIngredient = {
  name: string;
  role: IngredientRole;
  rationale: string;
};

export type BlueprintComponent = {
  name: string;
  purpose: ComponentPurpose;
  ingredients: BlueprintIngredient[];
  cookMethod: string;
  textureTarget: string | null;
};

export type BlueprintCheckpoint = {
  phase: CheckpointPhase;
  description: string;
  failureRisk: string;
};

export type FeasibilityFlags = {
  familyFit: boolean;
  ingredientFit: boolean;
  equipmentFit: boolean;
  timeBudgetPlausible: boolean;
  difficultyPlausible: boolean;
  issues: string[];
};

export type CulinaryBlueprint = {
  // Identity
  dishName: string;
  dishFamily: string;
  cuisineHint: string | null;
  richnessLevel: RichnessLevel;

  // Planning
  flavorArchitecture: string[];   // e.g. ["savory base", "umami depth", "bright acid finish"]
  components: BlueprintComponent[];
  primaryMethod: string;          // e.g. "sear then deglaze"
  sequenceLogic: string;          // how components come together
  finishStrategy: string;         // how the dish is finished

  // Quality targets
  textureTargets: string[];       // e.g. ["crispy skin", "silky sauce"]
  chefOpportunities: string[];    // technique moments that elevate the dish

  // Checkpoints
  checkpoints: BlueprintCheckpoint[];

  // Feasibility
  feasibility: FeasibilityFlags;

  // Tracing
  generatedFrom: string;  // requestId from ResolvedCookingIntent
  generatedAt: string;    // ISO 8601
};

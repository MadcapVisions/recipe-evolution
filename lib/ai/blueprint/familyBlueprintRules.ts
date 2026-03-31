import type { IngredientRole, RichnessLevel } from "./blueprintTypes";

/**
 * Planning-oriented family rules for blueprint generation.
 *
 * These complement (not replace) the validation-oriented rules in dishFamilyRules.ts.
 * - dishFamilyRules.ts  → used by culinaryValidator for post-draft validation
 * - familyBlueprintRules.ts → used by buildCulinaryBlueprint for pre-draft planning
 *
 * See docs/decisions/module-overlap-audit.md for classification.
 */

export type FamilyBlueprintRule = {
  family: string;
  typicalComponents: string[];
  defaultCookMethods: string[];
  textureTargets: string[];
  finishStrategies: string[];
  commonFailureRisks: string[];
  requiredRoles: IngredientRole[];
  optionalRoles: IngredientRole[];
  defaultDifficultyMinutes: { prep: number; cook: number };
  defaultServings: number;
  defaultRichnessLevel: RichnessLevel;
};

export const LAUNCH_FAMILY_KEYS = [
  "skillet_saute",
  "pasta",
  "soups_stews",
  "sheet_pan",
  "chicken_dinners",
  "rice_grain_bowls",
  "roasted_vegetables",
  "baked_casseroles",
] as const;

export type LaunchFamilyKey = (typeof LAUNCH_FAMILY_KEYS)[number];

const FAMILY_RULES: Record<LaunchFamilyKey, FamilyBlueprintRule> = {
  skillet_saute: {
    family: "skillet_saute",
    typicalComponents: ["seared protein", "pan sauce", "aromatics"],
    defaultCookMethods: ["sear", "deglaze", "simmer", "toss"],
    textureTargets: ["crispy protein exterior", "silky sauce"],
    finishStrategies: ["fresh herb", "acid squeeze", "butter mount"],
    commonFailureRisks: [
      "overcooked protein from overcrowded pan",
      "bland sauce from insufficient fond",
      "steaming instead of searing from wet protein surface",
    ],
    requiredRoles: ["protein", "fat", "aromatic"],
    optionalRoles: ["acid", "umami", "heat", "finish"],
    defaultDifficultyMinutes: { prep: 15, cook: 20 },
    defaultServings: 4,
    defaultRichnessLevel: "moderate",
  },

  pasta: {
    family: "pasta",
    typicalComponents: ["cooked pasta", "sauce", "protein or vegetable"],
    defaultCookMethods: ["boil", "sauté", "toss", "emulsify"],
    textureTargets: ["al dente pasta", "coating sauce that clings"],
    finishStrategies: ["pasta water emulsification", "grated cheese", "fresh herb"],
    commonFailureRisks: [
      "overcooked pasta loses al dente texture",
      "sauce too thick before pasta water is added",
      "under-seasoned pasta water",
    ],
    requiredRoles: ["base", "fat", "umami"],
    optionalRoles: ["protein", "acid", "heat", "aromatic", "finish"],
    defaultDifficultyMinutes: { prep: 10, cook: 25 },
    defaultServings: 4,
    defaultRichnessLevel: "moderate",
  },

  soups_stews: {
    family: "soups_stews",
    typicalComponents: ["aromatic base", "protein or legume", "liquid base", "vegetables"],
    defaultCookMethods: ["sweat aromatics", "brown protein", "simmer", "adjust seasoning"],
    textureTargets: ["tender protein", "rich flavorful broth", "soft but intact vegetables"],
    finishStrategies: ["fresh herb", "acid squeeze", "drizzle of quality oil"],
    commonFailureRisks: [
      "underseasoned broth from insufficient salting during cooking",
      "overcooked vegetables added too early",
      "flat flavor from skipping the browning step",
    ],
    requiredRoles: ["aromatic", "liquid", "seasoning"],
    optionalRoles: ["protein", "base", "umami", "acid", "heat", "finish"],
    defaultDifficultyMinutes: { prep: 20, cook: 45 },
    defaultServings: 6,
    defaultRichnessLevel: "moderate",
  },

  sheet_pan: {
    family: "sheet_pan",
    typicalComponents: ["seasoned protein", "roasted vegetables"],
    defaultCookMethods: ["roast", "broil finish"],
    textureTargets: ["caramelized edges", "tender interior", "crispy bits"],
    finishStrategies: ["fresh herb", "lemon squeeze", "quick pan sauce from drippings"],
    commonFailureRisks: [
      "uneven cook time from mis-matched protein and veg sizes",
      "soggy vegetables from overcrowding the pan",
      "steaming instead of roasting from excess moisture",
    ],
    requiredRoles: ["protein", "fat", "seasoning"],
    optionalRoles: ["aromatic", "acid", "heat", "finish"],
    defaultDifficultyMinutes: { prep: 15, cook: 35 },
    defaultServings: 4,
    defaultRichnessLevel: "light",
  },

  chicken_dinners: {
    family: "chicken_dinners",
    typicalComponents: ["chicken", "sauce or glaze", "aromatic base"],
    defaultCookMethods: ["sear", "bake", "braise", "rest"],
    textureTargets: ["crispy or golden skin", "juicy interior"],
    finishStrategies: ["pan sauce", "herb butter", "glaze reduction"],
    commonFailureRisks: [
      "undercooked thighs or overcooked breast",
      "rubbery skin from insufficient initial heat",
      "dry meat from skipping the rest step",
    ],
    requiredRoles: ["protein", "fat", "aromatic"],
    optionalRoles: ["acid", "umami", "heat", "finish", "sweetness"],
    defaultDifficultyMinutes: { prep: 20, cook: 30 },
    defaultServings: 4,
    defaultRichnessLevel: "moderate",
  },

  rice_grain_bowls: {
    family: "rice_grain_bowls",
    typicalComponents: ["cooked grain", "seasoned protein", "sauce or dressing", "toppings"],
    defaultCookMethods: ["cook grain", "sear or marinate protein", "make sauce", "assemble"],
    textureTargets: ["fluffy separate grains", "varied textural toppings", "coating sauce"],
    finishStrategies: ["sauce drizzle", "sesame or seed sprinkle", "fresh herb or microgreen"],
    commonFailureRisks: [
      "bland or gummy grain from poor water ratio or skipping rinse",
      "dry protein without sauce to carry moisture",
      "flat bowl from missing acid element",
    ],
    requiredRoles: ["base", "protein", "fat", "acid", "umami"],
    optionalRoles: ["heat", "texture", "finish", "aromatic", "sweetness"],
    defaultDifficultyMinutes: { prep: 20, cook: 30 },
    defaultServings: 4,
    defaultRichnessLevel: "moderate",
  },

  roasted_vegetables: {
    family: "roasted_vegetables",
    typicalComponents: ["seasoned vegetables", "optional glaze or dressing"],
    defaultCookMethods: ["roast", "optional broil finish"],
    textureTargets: ["caramelized exterior", "tender interior"],
    finishStrategies: ["lemon zest", "fresh herb", "quality cheese or nut sprinkle"],
    commonFailureRisks: [
      "steaming instead of roasting from overcrowded pan",
      "bland vegetables from insufficient fat or salt",
      "uneven cooking from inconsistent cut sizes",
    ],
    requiredRoles: ["fat", "seasoning"],
    optionalRoles: ["acid", "umami", "sweetness", "heat", "texture", "finish"],
    defaultDifficultyMinutes: { prep: 10, cook: 35 },
    defaultServings: 4,
    defaultRichnessLevel: "light",
  },

  baked_casseroles: {
    family: "baked_casseroles",
    typicalComponents: ["protein or vegetable filling", "binder or sauce", "topping"],
    defaultCookMethods: ["sauté filling", "make binder sauce", "layer", "bake", "rest"],
    textureTargets: ["crispy top crust", "creamy or saucy interior"],
    finishStrategies: ["fresh herb", "mandatory rest before cutting"],
    commonFailureRisks: [
      "watery casserole from insufficient binder or moisture reduction",
      "overbaked edges from too-thin layer",
      "cutting before resting leads to runny center",
    ],
    requiredRoles: ["protein", "binder", "fat"],
    optionalRoles: ["base", "umami", "aromatic", "heat", "texture", "finish"],
    defaultDifficultyMinutes: { prep: 30, cook: 50 },
    defaultServings: 6,
    defaultRichnessLevel: "rich",
  },
};

export function getFamilyBlueprintRule(family: string): FamilyBlueprintRule | null {
  return (FAMILY_RULES as Record<string, FamilyBlueprintRule>)[family] ?? null;
}

export const FALLBACK_BLUEPRINT_RULE: FamilyBlueprintRule = {
  family: "unknown",
  typicalComponents: ["main component"],
  defaultCookMethods: ["cook"],
  textureTargets: ["properly cooked texture"],
  finishStrategies: ["season and serve"],
  commonFailureRisks: ["under-seasoning", "incorrect cook time"],
  requiredRoles: ["protein", "fat", "seasoning"],
  optionalRoles: ["aromatic", "acid", "finish"],
  defaultDifficultyMinutes: { prep: 15, cook: 30 },
  defaultServings: 4,
  defaultRichnessLevel: "moderate",
};

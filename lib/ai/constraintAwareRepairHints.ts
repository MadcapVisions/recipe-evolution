/**
 * Builds constraint-aware repair hints from active dietary constraints and
 * validation issues. These translate raw violations into explicit, actionable
 * instructions that the repair model can act on directly.
 */

import type { DietaryConstraint } from "./dishAwareRepairPlanner";
import type { GenericIssue } from "./repairOrchestrator";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConstraintRepairHint = {
  constraint: string;
  priority: "critical" | "high" | "medium";
  promptInstruction: string;
  /** Ingredient names that triggered this hint */
  offendingIngredients: string[];
  /** Suggested replacement candidates */
  candidateReplacements: string[];
};

export type ConstraintAwareRepairHintsParams = {
  dietaryConstraints: DietaryConstraint[] | null | undefined;
  issues: GenericIssue[];
  /** Resolved ingredient names currently in the recipe */
  ingredientNames?: string[];
};

export type ConstraintAwareRepairHintsResult = {
  hints: ConstraintRepairHint[];
  /** true if any dietary_violation:* issue was found */
  hasConstraintViolations: boolean;
};

// ── Candidate replacements per constraint ─────────────────────────────────────

// low_carb and high_protein are macro targets handled by macroRepairHints, not here.
const CONSTRAINT_REPLACEMENTS: Partial<Record<DietaryConstraint, string[]>> = {
  vegan: [
    "tofu", "tempeh", "seitan", "chickpeas", "lentils", "black beans",
    "oat milk", "almond milk", "coconut milk", "coconut cream",
    "nutritional yeast", "cashew cream", "flax egg",
  ],
  vegetarian: [
    "tofu", "tempeh", "paneer", "halloumi", "lentils", "chickpeas",
    "black beans", "kidney beans", "eggs", "cheese",
  ],
  dairy_free: [
    "oat milk", "almond milk", "coconut milk", "coconut cream",
    "dairy-free butter", "dairy-free cheese", "cashew cream",
  ],
  nut_free: [
    "sunflower seeds", "pumpkin seeds", "hemp seeds", "oat milk",
    "soy milk", "coconut milk", "dried fruit",
  ],
  gluten_free: [
    "rice flour", "almond flour", "oat flour (certified gluten-free)",
    "tapioca starch", "cornstarch", "arrowroot powder",
    "tamari (gluten-free soy sauce)", "rice noodles", "corn tortillas",
  ],
};

// ── Prompt instruction templates ──────────────────────────────────────────────

function buildVeganHint(offending: string[]): ConstraintRepairHint {
  const offendingText = offending.length
    ? `Remove or replace: ${offending.join(", ")}.`
    : "Check all ingredients for animal-derived products.";
  return {
    constraint: "vegan",
    priority: "critical",
    promptInstruction: `This recipe must be fully vegan. ${offendingText} Replace with plant-based equivalents. Do not use any meat, fish, dairy, eggs, honey, or gelatin.`,
    offendingIngredients: offending,
    candidateReplacements: CONSTRAINT_REPLACEMENTS.vegan ?? [],
  };
}

function buildVegetarianHint(offending: string[]): ConstraintRepairHint {
  const offendingText = offending.length
    ? `Remove or replace: ${offending.join(", ")}.`
    : "Check all ingredients for meat or fish.";
  return {
    constraint: "vegetarian",
    priority: "critical",
    promptInstruction: `This recipe must be vegetarian. ${offendingText} Replace with plant-based protein or eggs/dairy if not otherwise restricted.`,
    offendingIngredients: offending,
    candidateReplacements: CONSTRAINT_REPLACEMENTS.vegetarian ?? [],
  };
}

function buildDairyFreeHint(offending: string[]): ConstraintRepairHint {
  const offendingText = offending.length
    ? `Remove or replace: ${offending.join(", ")}.`
    : "Check all ingredients for dairy.";
  return {
    constraint: "dairy_free",
    priority: "critical",
    promptInstruction: `This recipe must be dairy-free. ${offendingText} Replace with non-dairy alternatives such as oat milk, coconut milk, or coconut cream.`,
    offendingIngredients: offending,
    candidateReplacements: CONSTRAINT_REPLACEMENTS.dairy_free ?? [],
  };
}

function buildNutFreeHint(offending: string[]): ConstraintRepairHint {
  const offendingText = offending.length
    ? `Remove or replace: ${offending.join(", ")}.`
    : "Check all ingredients for nuts.";
  return {
    constraint: "nut_free",
    priority: "critical",
    promptInstruction: `This recipe must be nut-free. ${offendingText} Replace with nut-free alternatives such as seeds or other milks.`,
    offendingIngredients: offending,
    candidateReplacements: CONSTRAINT_REPLACEMENTS.nut_free ?? [],
  };
}

function buildGlutenFreeHint(offending: string[]): ConstraintRepairHint {
  const offendingText = offending.length
    ? `Remove or replace: ${offending.join(", ")}.`
    : "Check all ingredients for gluten-containing grains and sauces.";
  return {
    constraint: "gluten_free",
    priority: "critical",
    promptInstruction: `This recipe must be gluten-free. ${offendingText} Replace wheat-based ingredients with certified gluten-free alternatives.`,
    offendingIngredients: offending,
    candidateReplacements: CONSTRAINT_REPLACEMENTS.gluten_free ?? [],
  };
}

// ── Issue matching ─────────────────────────────────────────────────────────────

function issueLikelyMatchesConstraint(issue: GenericIssue, constraint: DietaryConstraint): boolean {
  // Exact dietary_violation:* match
  if (issue.code === `dietary_violation:${constraint}`) return true;
  // Loose match on message text
  const msg = issue.message.toLowerCase();
  return msg.includes(constraint.replace("_", " ")) || msg.includes(constraint);
}

function offendingIngredientsForConstraint(
  issues: GenericIssue[],
  constraint: DietaryConstraint
): string[] {
  const names = new Set<string>();
  for (const issue of issues) {
    if (!issueLikelyMatchesConstraint(issue, constraint)) continue;
    if (issue.ingredientName) names.add(issue.ingredientName);
    // Extract from message: "\"chicken breast\" has class..."
    const match = issue.message.match(/"([^"]+)"/);
    if (match) names.add(match[1]);
  }
  return Array.from(names);
}

// ── Main export ────────────────────────────────────────────────────────────────

const HINT_BUILDERS: Partial<Record<DietaryConstraint, (offending: string[]) => ConstraintRepairHint>> = {
  vegan: buildVeganHint,
  vegetarian: buildVegetarianHint,
  dairy_free: buildDairyFreeHint,
  nut_free: buildNutFreeHint,
  gluten_free: buildGlutenFreeHint,
};

export function buildConstraintAwareRepairHints(
  params: ConstraintAwareRepairHintsParams
): ConstraintAwareRepairHintsResult {
  const { dietaryConstraints, issues } = params;

  if (!dietaryConstraints?.length) {
    return { hints: [], hasConstraintViolations: false };
  }

  const violationCodes = new Set(
    issues.filter((i) => i.code.startsWith("dietary_violation:")).map((i) => i.code)
  );
  const hasConstraintViolations = violationCodes.size > 0;

  const hints: ConstraintRepairHint[] = [];

  for (const constraint of dietaryConstraints) {
    const builder = HINT_BUILDERS[constraint];
    if (!builder) continue;

    // Always emit a hint for each active constraint — even without a current
    // violation, the model must know the constraint applies to avoid regression.
    const offending = offendingIngredientsForConstraint(issues, constraint);
    hints.push(builder(offending));
  }

  return { hints, hasConstraintViolations };
}

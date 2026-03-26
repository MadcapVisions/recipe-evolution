import type { CookingBrief } from "./contracts/cookingBrief";
import type { VerificationResult } from "./contracts/verificationResult";

export const RECIPE_REPAIR_SCOPES = [
  "alignment_centerpiece",
  "alignment_required_ingredients",
  "alignment_forbidden_ingredients",
  "alignment_title",
  "alignment_style",
  "culinary_family",
  "quality_steps",
  "quality_taste",
  "quality_quantities",
] as const;

export type RecipeRepairScope = (typeof RECIPE_REPAIR_SCOPES)[number];

export type RecipeRepairPlan = {
  scopes: RecipeRepairScope[];
  instructions: string[];
};

/**
 * Returns true when the verification failure is caused by dish_family_match = false,
 * which means the model generated a completely different dish. This cannot be fixed
 * by a targeted repair call — it requires full regeneration.
 */
export function shouldEscalateVerification(checks: VerificationResult["checks"]): boolean {
  return !checks.dish_family_match;
}

/**
 * Finds ingredient names that are missing an explicit quantity.
 * An ingredient name without a digit has no quantity (e.g. "olive oil" vs "2 tbsp olive oil").
 */
export function findMissingQuantities(ingredients: Array<{ name: string }>): string[] {
  return ingredients.map((i) => i.name).filter((name) => !/\d/.test(name));
}

/**
 * Builds a list of specific fix instructions based on which verification checks failed.
 * Returns an empty array if nothing is patchable (caller should escalate).
 */
export function buildVerificationRepairInstructions(
  verification: VerificationResult,
  brief: CookingBrief | null | undefined
): string[] {
  return buildVerificationRepairPlan(verification, brief).instructions;
}

export function buildVerificationRepairPlan(
  verification: VerificationResult,
  brief: CookingBrief | null | undefined
): RecipeRepairPlan {
  const repairs: string[] = [];
  const scopes: RecipeRepairScope[] = [];
  const checks = verification.checks;
  const ing = brief?.ingredients;

  if (!checks.centerpiece_match && ing?.centerpiece) {
    scopes.push("alignment_centerpiece");
    repairs.push(
      `The centerpiece ingredient must be "${ing.centerpiece}". Make it the main ingredient in both the ingredient list and the cooking steps without changing the dish format.`
    );
  }

  if (!checks.required_ingredients_present && ing?.required && ing.required.length > 0) {
    scopes.push("alignment_required_ingredients");
    repairs.push(
      `These required ingredients are missing from the recipe: ${ing.required.join(", ")}. Add them naturally to the ingredient list and adjust the steps to use them.`
    );
  }

  const hardRequiredNamed = (ing?.requiredNamedIngredients ?? [])
    .filter((item) => item.requiredStrength === "hard")
    .map((item) => item.normalizedName);

  if (
    (checks.required_named_ingredients_present === false ||
      checks.required_named_ingredients_used_in_steps === false) &&
    hardRequiredNamed.length > 0
  ) {
    if (!scopes.includes("alignment_required_ingredients")) {
      scopes.push("alignment_required_ingredients");
    }
    repairs.push(
      `The user explicitly requested these exact ingredients: ${hardRequiredNamed.join(", ")}. They must appear by those names in the ingredient list and be explicitly used in at least one step. Do not substitute related ingredients.`
    );
  }

  if (!checks.forbidden_ingredients_avoided && ing?.forbidden && ing.forbidden.length > 0) {
    scopes.push("alignment_forbidden_ingredients");
    repairs.push(
      `Remove any of these forbidden ingredients: ${ing.forbidden.join(", ")}. Replace each with a compatible alternative that preserves the dish.`
    );
  }

  if (!checks.title_quality_pass) {
    scopes.push("alignment_title");
    repairs.push(
      `Replace the recipe title with a specific, recognizable name a home cook would understand (e.g. "Garlic Butter Shrimp Tostadas", not "Chef Conversation Recipe" or "Chef Special").`
    );
  }

  if (checks.culinary_family_valid === false && verification.culinary_violations) {
    const errorHints = verification.culinary_violations
      .filter((v) => v.severity === "error")
      .map((v) => v.repairHint);
    if (errorHints.length > 0) {
      scopes.push("culinary_family");
      repairs.push(...errorHints);
    }
  }

  if (!checks.style_match && brief?.style) {
    const styleHints = [
      ...(brief.style.tags ?? []),
      ...(brief.style.texture_tags ?? []),
      ...(brief.style.format_tags ?? []),
    ].filter(Boolean);
    if (styleHints.length > 0) {
      scopes.push("alignment_style");
      repairs.push(
        `The recipe should reflect these style cues: ${styleHints.join(", ")}. Adjust technique and ingredients to match without changing the dish family.`
      );
    }
  }

  return {
    scopes,
    instructions: repairs,
  };
}

export function buildQualityRepairPlan(input: {
  vagueSteps: Array<{ text: string }>;
  tasteViolations: string[];
  missingQuantities: string[];
}): RecipeRepairPlan {
  const scopes: RecipeRepairScope[] = [];
  const instructions: string[] = [];

  if (input.vagueSteps.length > 0) {
    scopes.push("quality_steps");
    instructions.push(
      `Expand these vague steps — each must include an actionable verb, technique, and timing or doneness cues (minimum 10 words): ${input.vagueSteps.map((step) => `"${step.text}"`).join("; ")}.`
    );
  }

  if (input.tasteViolations.length > 0) {
    scopes.push("quality_taste");
    instructions.push(
      `The user dislikes: ${input.tasteViolations.join(", ")}. Remove these ingredients and substitute a compatible alternative that preserves the dish format and flavor direction.`
    );
  }

  if (input.missingQuantities.length > 0) {
    scopes.push("quality_quantities");
    instructions.push(
      `These ingredients are missing explicit quantities: ${input.missingQuantities.join("; ")}. Add a realistic quantity to each one (e.g. "2 tbsp", "1 lb", "3 cloves"). Do not change anything else.`
    );
  }

  return {
    scopes,
    instructions,
  };
}

export function buildScopedRepairPrompt(plan: RecipeRepairPlan, mode: "alignment" | "quality") {
  const scopeLabel = plan.scopes.length > 0 ? plan.scopes.join(", ") : "none";
  const scopeRules =
    mode === "alignment"
      ? [
          "Only fix the listed alignment failures.",
          "Do not change the dish family, recipe format, or unrelated ingredients and steps.",
          "Keep the same JSON schema.",
        ]
      : [
          "Only fix the listed quality issues.",
          "Do not rename the dish or rewrite unrelated parts of the recipe.",
          "Keep the same JSON schema.",
        ];

  return `Repair scope: ${scopeLabel}
${scopeRules.join(" ")}
Fix these specific issues:
${plan.instructions.join("\n")}
Return the corrected recipe using the same JSON format.`;
}

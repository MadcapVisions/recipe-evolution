/**
 * Adapter layer bridging the new repair/planning pipeline to the app's
 * existing model client and validation stack.
 *
 * Pass these into orchestrateRecipeRepair(), runIngredientPlanner(), and
 * runStepGenerator() as the `deps` argument.
 */

import { callAIForJson } from "./jsonResponse";
import { validateCulinaryFit } from "./culinaryValidator";
import { findDishFamilyRule } from "./dishFamilyRules";
import { resolveIngredientListForRatio } from "./resolveIngredientGrams";
import { stripStepMetadata } from "./recipeSections";
import type { AICallOptions } from "./aiClient";
import type {
  RepairModelOutput,
  RepairOrchestratorDependencies,
  RepairDraft,
} from "./repairOrchestrator";
import type { RecipeGenerationDependencies } from "./recipeGenerationOrchestrator";
import type {
  IngredientPlannerDependencies,
  IngredientPlanCandidate,
} from "./ingredientPlanner";
import type { StepGeneratorDependencies, StepGenerationCandidate } from "./stepGenerator";
import type { DishFamilyRule } from "./dishFamilyRules";
import type { RepairableIngredient } from "./repairOrchestrator";
import type { DietaryConstraint } from "./dishAwareRepairPlanner";

// ── Dietary constraint → forbidden ingredient classes ─────────────────────────
// Note: gluten_free is intentionally omitted — gluten-free flour alternatives
// (almond, rice, oat flour) share the same flour_grain class as wheat flour,
// so a class-based check would produce false positives. The planner prompt
// handles the gluten_free constraint via ingredient selection instead.
const DIETARY_FORBIDDEN_CLASSES: Partial<Record<DietaryConstraint, string[]>> = {
  vegan:      ["dairy", "protein_meat", "protein_fish", "egg"],
  vegetarian: ["protein_meat", "protein_fish"],
  dairy_free: ["dairy"],
  nut_free:   ["nut"],
};

// ── Model call adapters ──────────────────────────────────────────────────────

/**
 * Calls the LLM with a repair prompt and parses the returned JSON into
 * RepairModelOutput. Throws on parse failure (caller should catch).
 */
async function callRepairModel(
  prompt: string,
  aiOptions?: AICallOptions
): Promise<RepairModelOutput> {
  const result = await callAIForJson(
    [{ role: "user", content: prompt }],
    { response_format: { type: "json_object" }, ...aiOptions }
  );

  const raw = result.parsed as Record<string, unknown>;

  return {
    title: typeof raw.title === "string" ? raw.title : null,
    ingredients: Array.isArray(raw.ingredients)
      ? (raw.ingredients as RepairModelOutput["ingredients"])
      : [],
    steps: Array.isArray(raw.steps) ? (raw.steps as RepairModelOutput["steps"]) : [],
    notes: Array.isArray(raw.notes) ? (raw.notes as string[]) : [],
  };
}

/**
 * Calls the LLM with an ingredient planner prompt and parses the result.
 */
async function callPlannerModel(
  payload: { systemPrompt: string; userPrompt: string },
  aiOptions?: AICallOptions
): Promise<IngredientPlanCandidate> {
  const result = await callAIForJson(
    [
      { role: "system", content: payload.systemPrompt },
      { role: "user", content: payload.userPrompt },
    ],
    { response_format: { type: "json_object" }, ...aiOptions }
  );

  const raw = result.parsed as Record<string, unknown>;

  return {
    title: typeof raw.title === "string" ? raw.title : null,
    ingredients: Array.isArray(raw.ingredients)
      ? (raw.ingredients as IngredientPlanCandidate["ingredients"])
      : [],
    notes: Array.isArray(raw.notes) ? (raw.notes as string[]) : [],
  };
}

/**
 * Calls the LLM with a step generation prompt and parses the result.
 */
async function callStepModel(
  payload: { systemPrompt: string; userPrompt: string },
  aiOptions?: AICallOptions
): Promise<StepGenerationCandidate> {
  const result = await callAIForJson(
    [
      { role: "system", content: payload.systemPrompt },
      { role: "user", content: payload.userPrompt },
    ],
    { response_format: { type: "json_object" }, ...aiOptions }
  );

  const raw = result.parsed as Record<string, unknown>;

  return {
    title: typeof raw.title === "string" ? raw.title : null,
    steps: Array.isArray(raw.steps)
      ? (raw.steps as StepGenerationCandidate["steps"])
      : [],
    notes: Array.isArray(raw.notes) ? (raw.notes as string[]) : [],
  };
}

// ── Validation adapter ────────────────────────────────────────────────────────

/**
 * Wraps validateCulinaryFit() into the ValidationResult shape the orchestrator expects.
 * Also resolves ingredient classes from the ingredient list for use in validation.
 */
function validateRecipe(params: {
  dishFamily: DishFamilyRule;
  ingredients: RepairableIngredient[];
  steps: Array<{ text: string; methodTag?: string | null }>;
  dietaryConstraints?: DietaryConstraint[] | null;
}): { passed: boolean; score: number; issues: Array<{ code: string; severity: "info" | "warning" | "error"; message: string }> } {
  const result = validateCulinaryFit(
    params.dishFamily.key,
    params.ingredients.map((ing) => ({ name: ing.normalizedName || ing.ingredientName })),
    params.steps.map((s) => ({ text: s.text, methodTag: s.methodTag }))
  );

  const issues: Array<{ code: string; severity: "info" | "warning" | "error"; message: string }> =
    result.violations.map((v) => ({
      code: v.code,
      severity: v.severity as "info" | "warning" | "error",
      message: v.message,
    }));

  // Enforce dietary constraints via ingredient class checks.
  for (const constraint of params.dietaryConstraints ?? []) {
    const forbidden = DIETARY_FORBIDDEN_CLASSES[constraint];
    if (!forbidden?.length) continue;

    for (const ing of params.ingredients) {
      const classes = ing.classes ?? [];
      for (const cls of forbidden) {
        if (classes.includes(cls)) {
          issues.push({
            code: `dietary_violation:${constraint}`,
            severity: "error",
            message: `"${ing.ingredientName}" has class "${cls}" which is forbidden for constraint "${constraint}".`,
          });
          break; // one issue per ingredient per constraint is enough
        }
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  let score = 1;
  score -= errorCount * 0.2;
  score -= warningCount * 0.05;
  score = Math.max(0, Math.min(1, score));

  return { passed: errorCount === 0, score, issues };
}

// ── Ingredient resolver ───────────────────────────────────────────────────────

/**
 * Resolves a RepairableIngredient[] by enriching grams and classes via the
 * existing resolveIngredientListForRatio utility.
 */
function resolveIngredients(
  ingredients: RepairableIngredient[]
): RepairableIngredient[] {
  const resolved = resolveIngredientListForRatio(
    ingredients.map((ing) => ({ name: ing.normalizedName || ing.ingredientName }))
  );

  return ingredients.map((ing, i) => ({
    ...ing,
    grams: resolved[i]?.grams ?? ing.grams ?? null,
    densityGPerMl: resolved[i]?.densityGPerMl ?? ing.densityGPerMl ?? null,
    classes: resolved[i]?.classes?.length ? resolved[i].classes : (ing.classes ?? []),
  }));
}

// ── Strip for persistence ─────────────────────────────────────────────────────

/**
 * Removes AI-only metadata (methodTag, estimatedMinutes, temperatureC) from
 * steps before the draft is written to the database.
 */
function stripForPersistence(draft: RepairDraft): RepairDraft {
  return {
    ...draft,
    steps: stripStepMetadata(
      draft.steps.map((s) => ({
        text: s.text,
        methodTag: s.methodTag ?? null,
        estimatedMinutes: s.estimatedMinutes ?? null,
        temperatureC: s.temperatureC ?? null,
      }))
    ),
  };
}

// ── Exported dependency bundles ───────────────────────────────────────────────

export function buildRepairDeps(aiOptions?: AICallOptions): RepairOrchestratorDependencies {
  return {
    callRepairModel: (prompt) => callRepairModel(prompt, aiOptions),
    validateRecipe,
    resolveIngredients,
    stripForPersistence,
  };
}

export function buildPlannerDeps(aiOptions?: AICallOptions): IngredientPlannerDependencies {
  return {
    callPlannerModel: (payload) => callPlannerModel(payload, aiOptions),
  };
}

export function buildStepDeps(aiOptions?: AICallOptions): StepGeneratorDependencies {
  return {
    callStepModel: (payload) => callStepModel(payload, aiOptions),
  };
}

/**
 * Builds the full dependency bundle for orchestrateRecipeGeneration().
 * Combines planner, step, and repair adapters into the single shape the orchestrator expects.
 */
export function buildGenerationDeps(aiOptions?: AICallOptions): RecipeGenerationDependencies {
  return {
    callPlannerModel: (payload) => callPlannerModel(payload, aiOptions),
    callStepModel: (payload) => callStepModel(payload, aiOptions),
    callRepairModel: (prompt) => callRepairModel(prompt, aiOptions),
    validateRecipe,
    resolveIngredients,
    stripForPersistence,
  };
}

/**
 * Convenience alias — returns `buildGenerationDeps()` with no AI option overrides.
 * Useful in benchmark and test contexts where you want default settings.
 */
export function getRepairAdapters(): RecipeGenerationDependencies {
  return buildGenerationDeps();
}

/**
 * Resolves the DishFamilyRule for a given brief's dish_family hint.
 * Returns null if no matching rule is found (safe to ignore in callers).
 */
export function resolveDishFamilyForRepair(dishFamilyHint: string | null | undefined) {
  if (!dishFamilyHint) return null;
  return findDishFamilyRule(dishFamilyHint) ?? null;
}

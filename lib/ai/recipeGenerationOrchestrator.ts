import {
  runIngredientPlanner,
  type IngredientPlannerInput,
  type IngredientPlanCandidate,
  type IngredientPlannerValidationResult,
  type CreativityMode,
  type IngredientCatalogItem,
} from "./ingredientPlanner";
import { repairIngredientPlan } from "./ingredientPlanRepair";
import {
  runStepGenerator,
  type StepGenerationInput,
  type StepGenerationCandidate,
  type StepGenerationValidationResult,
} from "./stepGenerator";
import { repairStepPlan } from "./stepPlanRepair";
import {
  orchestrateRecipeRepair,
  type RepairDraft,
  type ValidationResult,
  type RepairableIngredient,
} from "./repairOrchestrator";
import { validateRatios } from "./ratioValidator";
import { calculateRecipeNutrition } from "./nutritionCalculator";
import { validateMacroTargets, type MacroTargets } from "./macroTargetValidator";
import { checkFamilyMacroFeasibility } from "./familyMacroFeasibility";
import { findDishFamilyRule, type DishFamilyRule } from "./dishFamilyRules";
import { resolveIntent } from "./intentResolver";
import { normalizeDietaryTags } from "./normalizeDietaryTags";
import type { DietaryConstraint } from "./dishAwareRepairPlanner";
import type { RequiredNamedIngredient } from "./requiredNamedIngredient";
import {
  RecipeTelemetry,
  type RecipeTelemetrySession,
  type RecipeTelemetrySummary,
  withTelemetryTiming,
} from "./recipeTelemetry";

// ── Public types ──────────────────────────────────────────────────────────────

export type { CreativityMode };

/** Top-level output recipe shape — structurally identical to RepairDraft. */
export type FinalRecipeDraft = RepairDraft;

export type RecipeGenerationInput = {
  userIntent: string;
  titleHint?: string | null;
  dishHint?: string | null;
  requiredNamedIngredients?: RequiredNamedIngredient[] | null;
  /** Freeform dietary tags — normalized internally via normalizeDietaryTags(). */
  dietaryConstraints?: string[] | null;
  availableIngredients?: string[] | null;
  preferredIngredients?: string[] | null;
  forbiddenIngredients?: string[] | null;
  macroTargets?: MacroTargets | null;
  servings?: number | null;
  creativityMode?: CreativityMode;
  maxIngredientRepairRetries?: number;
  maxStepRepairRetries?: number;
  maxRecipeRepairRetries?: number;
  ingredientCatalog?: IngredientCatalogItem[] | null;
  /** Optional caller-supplied ID for telemetry correlation. Auto-generated if omitted. */
  requestId?: string | null;
  /**
   * Maximum number of fallback dish families to try (from intent resolver).
   * Defaults to all candidates. Set to 2-3 in benchmark mode to bound runtime.
   */
  maxFallbackFamilies?: number | null;
};

export type RecipeGenerationAttemptLog = {
  stage:
    | "dish_family_selection"
    | "ingredient_planning"
    | "ingredient_plan_repair"
    | "step_generation"
    | "step_plan_repair"
    | "full_recipe_validation"
    | "full_recipe_repair";
  success: boolean;
  details?: Record<string, unknown>;
};

export type RecipeGenerationResult = {
  success: boolean;
  status:
    | "accepted"
    | "accepted_after_recipe_repair"
    | "kept_repaired_recipe"
    | "regenerate_from_ingredients"
    | "failed";
  dishFamily: DishFamilyRule | null;
  recipe: FinalRecipeDraft | null;
  validation: {
    structural: ValidationResult | null;
    ratio: ValidationResult | null;
    macro: ReturnType<typeof validateMacroTargets> | null;
    nutrition: ReturnType<typeof calculateRecipeNutrition> | null;
  };
  attempts: RecipeGenerationAttemptLog[];
  reasons: string[];
  telemetry: {
    session: RecipeTelemetrySession;
    summary: RecipeTelemetrySummary;
  };
};

export type RecipeGenerationDependencies = {
  callPlannerModel: Parameters<typeof runIngredientPlanner>[1]["callPlannerModel"];
  callStepModel: Parameters<typeof runStepGenerator>[1]["callStepModel"];
  callRepairModel: Parameters<typeof orchestrateRecipeRepair>[1]["callRepairModel"];
  validateRecipe: Parameters<typeof orchestrateRecipeRepair>[1]["validateRecipe"];
  resolveIngredients?: Parameters<typeof orchestrateRecipeRepair>[1]["resolveIngredients"];
  stripForPersistence?: Parameters<typeof orchestrateRecipeRepair>[1]["stripForPersistence"];
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function toValidationResult(result: {
  passed: boolean;
  score: number;
  issues: Array<{
    code: string;
    severity: "warning" | "error";
    message: string;
    metadata?: Record<string, unknown>;
  }>;
}): ValidationResult {
  return {
    passed: result.passed,
    score: result.score,
    issues: result.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      metadata: issue.metadata,
    })),
  };
}

function mergeIssues(
  ...groups: Array<{ issues?: ValidationResult["issues"] } | null | undefined>
): ValidationResult["issues"] {
  return groups.flatMap((group) => group?.issues ?? []);
}

type DishFamilySelection = {
  primary: DishFamilyRule | null;
  /** Ordered list of families to try (includes primary at index 0). Empty only on total failure. */
  fallbackCandidates: DishFamilyRule[];
  reasoning: string;
};

function chooseDishFamily(input: RecipeGenerationInput): DishFamilySelection {
  // Explicit signals win immediately (dishHint > titleHint > userIntent)
  const explicit = [input.dishHint, input.titleHint, input.userIntent].filter(Boolean) as string[];
  for (const candidate of explicit) {
    const match = findDishFamilyRule(candidate);
    if (match) {
      return { primary: match, fallbackCandidates: [match], reasoning: "Matched explicit dish-family hint." };
    }
  }

  // Fall back to intent resolver for vague/pantry/goal prompts
  const intent = resolveIntent(input.userIntent);
  const resolved = intent.candidateFamilies
    .map((key) => findDishFamilyRule(key))
    .filter((r): r is DishFamilyRule => r != null);

  return {
    primary: resolved[0] ?? null,
    fallbackCandidates: resolved,
    reasoning: intent.reasoning,
  };
}

function buildIngredientPlannerInput(
  input: RecipeGenerationInput,
  dishFamily: DishFamilyRule
): IngredientPlannerInput {
  return {
    userIntent: input.userIntent,
    titleHint: input.titleHint ?? null,
    dishFamily,
    requiredNamedIngredients: input.requiredNamedIngredients ?? [],
    dietaryConstraints: input.dietaryConstraints ?? [],
    availableIngredients: input.availableIngredients ?? [],
    preferredIngredients: input.preferredIngredients ?? [],
    forbiddenIngredients: input.forbiddenIngredients ?? [],
    macroTargets: input.macroTargets ?? null,
    servings: input.servings ?? null,
    creativityMode: input.creativityMode ?? "safe",
    ingredientCatalog: input.ingredientCatalog ?? [],
  };
}

function buildStepGenerationInput(params: {
  input: RecipeGenerationInput;
  dishFamily: DishFamilyRule;
  ingredientPlan: IngredientPlanCandidate;
}): StepGenerationInput {
  const { input, dishFamily, ingredientPlan } = params;

  return {
    userIntent: input.userIntent,
    title: ingredientPlan.title ?? input.titleHint ?? null,
    dishFamily,
    ingredients: ingredientPlan.ingredients,
    requiredNamedIngredients: input.requiredNamedIngredients ?? [],
    dietaryConstraints: input.dietaryConstraints ?? [],
    servings: input.servings ?? null,
  };
}

async function resolveIfNeeded(
  ingredients: RepairableIngredient[],
  resolveIngredients?: RecipeGenerationDependencies["resolveIngredients"]
): Promise<RepairableIngredient[]> {
  if (!resolveIngredients) return ingredients;
  return resolveIngredients(ingredients);
}

function buildTelemetry(requestId?: string | null): RecipeTelemetry {
  const id =
    requestId && requestId.trim().length > 0
      ? requestId
      : `rgo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return new RecipeTelemetry(id);
}

function finalizeResult(
  telemetry: RecipeTelemetry,
  payload: Omit<RecipeGenerationResult, "telemetry">
): RecipeGenerationResult {
  return {
    ...payload,
    telemetry: {
      session: telemetry.getSession(),
      summary: telemetry.getSummary(),
    },
  };
}

const EMPTY_VALIDATION = {
  structural: null,
  ratio: null,
  macro: null,
  nutrition: null,
} as const;

// ── Per-family generation helper ──────────────────────────────────────────────

/**
 * Runs the full recipe generation pipeline for a single dish family.
 * Called by the main orchestrator, potentially multiple times for fallback families.
 * State (telemetry, attempts, reasons) is shared across calls — each attempt
 * contributes to the same session trace.
 */
async function runGenerationForFamily(params: {
  input: RecipeGenerationInput;
  dishFamily: DishFamilyRule;
  deps: RecipeGenerationDependencies;
  telemetry: RecipeTelemetry;
  attempts: RecipeGenerationAttemptLog[];
  reasons: string[];
  normalizedDietaryConstraints: DietaryConstraint[];
}): Promise<RecipeGenerationResult> {
  const { input, dishFamily, deps, telemetry, attempts, reasons, normalizedDietaryConstraints } = params;

  // ── 0b. Family-level macro feasibility check ────────────────────────────────
  // Reject structurally impossible macro constraints before burning planner retries.

  const familyFeasibility = checkFamilyMacroFeasibility({
    dishFamilyKey: dishFamily.key,
    macroTargets: input.macroTargets ?? null,
  });

  if (!familyFeasibility.feasible) {
    const reason = familyFeasibility.reason ?? "Macro targets are not achievable for this dish family.";
    reasons.push(reason);
    telemetry.log({
      stage: "final_decision",
      status: "rejected",
      dishFamily: dishFamily.key,
      issues: [{ code: familyFeasibility.code ?? "FAMILY_MACRO_INFEASIBLE", severity: "error", message: reason }],
      metadata: { status: "regenerate_from_ingredients" },
    });
    return finalizeResult(telemetry, {
      success: false,
      status: "regenerate_from_ingredients",
      dishFamily,
      recipe: null,
      validation: EMPTY_VALIDATION,
      attempts,
      reasons,
    });
  }

  // ── 1. Ingredient planning ──────────────────────────────────────────────────

  const plannerInput = buildIngredientPlannerInput(input, dishFamily);

  const initialPlanResult = await withTelemetryTiming(
    telemetry,
    { stage: "ingredient_planning", dishFamily: dishFamily.key },
    async () => runIngredientPlanner(plannerInput, { callPlannerModel: deps.callPlannerModel })
  );

  attempts.push({
    stage: "ingredient_planning",
    success: initialPlanResult.validation.passed,
    details: {
      score: initialPlanResult.validation.score,
      issues: initialPlanResult.validation.issues,
      nutritionConfidenceScore: initialPlanResult.validation.nutritionConfidenceScore,
    },
  });

  telemetry.log({
    stage: "ingredient_planning",
    status: initialPlanResult.validation.passed ? "success" : "warning",
    dishFamily: dishFamily.key,
    score: initialPlanResult.validation.score,
    issues: initialPlanResult.validation.issues.map((i) => ({ code: i.code, severity: i.severity, message: i.message })),
    metadata: {
      nutritionConfidenceScore: initialPlanResult.validation.nutritionConfidenceScore ?? null,
      candidateTitle: initialPlanResult.candidate.title ?? null,
    },
  });

  let finalIngredientPlan: IngredientPlanCandidate;
  let finalIngredientValidation: IngredientPlannerValidationResult;

  if (!initialPlanResult.validation.passed) {
    const repairedPlan = await withTelemetryTiming(
      telemetry,
      { stage: "ingredient_plan_repair", dishFamily: dishFamily.key },
      async () =>
        repairIngredientPlan(
          {
            plannerInput,
            failedCandidate: initialPlanResult.candidate,
            failedValidation: initialPlanResult.validation,
            maxRepairRetries: input.maxIngredientRepairRetries ?? 2,
          },
          { callPlannerModel: deps.callPlannerModel }
        )
    );

    attempts.push({
      stage: "ingredient_plan_repair",
      success: repairedPlan.success,
      details: { decision: repairedPlan.decision, reasons: repairedPlan.reasons, attempts: repairedPlan.attempts.length },
    });

    telemetry.log({
      stage: "ingredient_plan_repair",
      status: repairedPlan.success ? "success" : "retry",
      dishFamily: dishFamily.key,
      metadata: { decision: repairedPlan.decision, reasons: repairedPlan.reasons, attempts: repairedPlan.attempts.length },
    });

    if (!repairedPlan.success || !repairedPlan.candidate || !repairedPlan.validation) {
      reasons.push(...repairedPlan.reasons);
      reasons.push("Ingredient plan could not be repaired.");
      telemetry.log({ stage: "final_decision", status: "fallback", dishFamily: dishFamily.key, metadata: { status: "regenerate_from_ingredients", reasons } });
      return finalizeResult(telemetry, {
        success: false,
        status: "regenerate_from_ingredients",
        dishFamily,
        recipe: null,
        validation: EMPTY_VALIDATION,
        attempts,
        reasons,
      });
    }

    finalIngredientPlan = repairedPlan.candidate;
    finalIngredientValidation = repairedPlan.validation;
  } else {
    finalIngredientPlan = initialPlanResult.candidate;
    finalIngredientValidation = initialPlanResult.validation;
  }

  // ── 2. Step generation ──────────────────────────────────────────────────────

  const stepInput = buildStepGenerationInput({ input, dishFamily, ingredientPlan: finalIngredientPlan });

  const initialStepResult = await withTelemetryTiming(
    telemetry,
    { stage: "step_generation", dishFamily: dishFamily.key },
    async () => runStepGenerator(stepInput, { callStepModel: deps.callStepModel })
  );

  attempts.push({
    stage: "step_generation",
    success: initialStepResult.validation.passed,
    details: { score: initialStepResult.validation.score, issues: initialStepResult.validation.issues },
  });

  telemetry.log({
    stage: "step_generation",
    status: initialStepResult.validation.passed ? "success" : "warning",
    dishFamily: dishFamily.key,
    score: initialStepResult.validation.score,
    issues: initialStepResult.validation.issues.map((i) => ({ code: i.code, severity: i.severity, message: i.message })),
    metadata: { stepCount: initialStepResult.candidate.steps.length },
  });

  let finalStepPlan: StepGenerationCandidate;
  let finalStepValidation: StepGenerationValidationResult;

  if (!initialStepResult.validation.passed) {
    const repairedSteps = await withTelemetryTiming(
      telemetry,
      { stage: "step_plan_repair", dishFamily: dishFamily.key },
      async () =>
        repairStepPlan(
          {
            stepInput,
            failedCandidate: initialStepResult.candidate,
            failedValidation: initialStepResult.validation,
            maxRepairRetries: input.maxStepRepairRetries ?? 2,
          },
          { callStepModel: deps.callStepModel }
        )
    );

    attempts.push({
      stage: "step_plan_repair",
      success: repairedSteps.success,
      details: { decision: repairedSteps.decision, reasons: repairedSteps.reasons, attempts: repairedSteps.attempts.length },
    });

    telemetry.log({
      stage: "step_plan_repair",
      status: repairedSteps.success ? "success" : "retry",
      dishFamily: dishFamily.key,
      metadata: { decision: repairedSteps.decision, reasons: repairedSteps.reasons, attempts: repairedSteps.attempts.length },
    });

    if (!repairedSteps.success || !repairedSteps.candidate || !repairedSteps.validation) {
      reasons.push(...repairedSteps.reasons);
      reasons.push("Step plan could not be repaired.");
      telemetry.log({ stage: "final_decision", status: "fallback", dishFamily: dishFamily.key, metadata: { status: "regenerate_from_ingredients", reasons } });
      return finalizeResult(telemetry, {
        success: false,
        status: "regenerate_from_ingredients",
        dishFamily,
        recipe: null,
        validation: EMPTY_VALIDATION,
        attempts,
        reasons,
      });
    }

    finalStepPlan = repairedSteps.candidate;
    finalStepValidation = repairedSteps.validation;
  } else {
    finalStepPlan = initialStepResult.candidate;
    finalStepValidation = initialStepResult.validation;
  }

  // ── 3. Full validation ──────────────────────────────────────────────────────

  const resolvedIngredients = await withTelemetryTiming(
    telemetry,
    { stage: "full_recipe_validation", dishFamily: dishFamily.key, metadata: { action: "resolve_ingredients" } },
    async () => resolveIfNeeded(finalIngredientPlan.ingredients, deps.resolveIngredients)
  );

  const structuralValidation = await withTelemetryTiming(
    telemetry,
    { stage: "full_recipe_validation", dishFamily: dishFamily.key, metadata: { action: "structural_validation" } },
    async () =>
      deps.validateRecipe({
        dishFamily,
        ingredients: resolvedIngredients,
        steps: finalStepPlan.steps,
        requiredNamedIngredients: input.requiredNamedIngredients ?? [],
        dietaryConstraints: normalizedDietaryConstraints,
      })
  );

  const ratioValidation = toValidationResult(
    validateRatios({ dishFamily, ingredients: resolvedIngredients })
  );

  const nutrition = calculateRecipeNutrition(
    resolvedIngredients.map((ing) => ({ name: ing.ingredientName })),
    input.servings ?? null
  );

  const macroValidation = validateMacroTargets({
    nutrition,
    targets: input.macroTargets ?? null,
    preferPerServing: true,
  });

  const validationPassed =
    structuralValidation.passed && ratioValidation.passed && macroValidation.passed;

  attempts.push({
    stage: "full_recipe_validation",
    success: validationPassed,
    details: {
      structuralScore: structuralValidation.score,
      ratioScore: ratioValidation.score,
      macroScore: macroValidation.score,
      nutritionConfidenceScore: nutrition.confidenceScore,
      structuralIssues: structuralValidation.issues,
      ratioIssues: ratioValidation.issues,
      macroIssues: macroValidation.issues,
    },
  });

  telemetry.log({
    stage: "full_recipe_validation",
    status: validationPassed ? "success" : "warning",
    dishFamily: dishFamily.key,
    score: Number(
      (structuralValidation.score * 0.5 + ratioValidation.score * 0.2 + macroValidation.score * 0.3).toFixed(2)
    ),
    issues: mergeIssues(structuralValidation, ratioValidation, macroValidation).map((i) => ({
      code: i.code,
      severity: i.severity,
      message: i.message,
    })),
    metadata: {
      structuralScore: structuralValidation.score,
      ratioScore: ratioValidation.score,
      macroScore: macroValidation.score,
      nutritionConfidenceScore: nutrition.confidenceScore,
      servingCount: nutrition.servingCount,
    },
  });

  const assembledRecipe: FinalRecipeDraft = {
    title: finalStepPlan.title ?? finalIngredientPlan.title ?? input.titleHint ?? null,
    ingredients: resolvedIngredients,
    steps: finalStepPlan.steps,
    notes: [...(finalIngredientPlan.notes ?? []), ...(finalStepPlan.notes ?? [])],
  };

  void finalIngredientValidation;
  void finalStepValidation;

  const validationSnapshot = {
    structural: structuralValidation,
    ratio: ratioValidation,
    macro: macroValidation,
    nutrition,
  };

  if (validationPassed) {
    const finalRecipe = deps.stripForPersistence
      ? deps.stripForPersistence(assembledRecipe)
      : assembledRecipe;

    reasons.push("Recipe passed ingredient, step, ratio, and macro validation.");
    telemetry.log({ stage: "final_decision", status: "accepted", dishFamily: dishFamily.key, metadata: { status: "accepted", reasons } });
    return finalizeResult(telemetry, {
      success: true,
      status: "accepted",
      dishFamily,
      recipe: finalRecipe,
      validation: validationSnapshot,
      attempts,
      reasons,
    });
  }

  // ── 4. Full recipe repair fallback ──────────────────────────────────────────

  const combinedIssues = mergeIssues(structuralValidation, ratioValidation);
  const combinedScore = Number(
    (structuralValidation.score * 0.75 + ratioValidation.score * 0.25).toFixed(2)
  );

  const repairResult = await withTelemetryTiming(
    telemetry,
    { stage: "full_recipe_repair", dishFamily: dishFamily.key },
    async () =>
      orchestrateRecipeRepair(
        {
          originalTitle: assembledRecipe.title ?? null,
          originalIngredients: assembledRecipe.ingredients,
          originalSteps: assembledRecipe.steps,
          originalValidation: { passed: structuralValidation.passed && ratioValidation.passed, score: combinedScore, issues: combinedIssues },
          originalResolvedIngredients: resolvedIngredients,
          dishFamily,
          requiredNamedIngredients: input.requiredNamedIngredients ?? [],
          dietaryConstraints: normalizedDietaryConstraints,
          macroTargets: input.macroTargets ?? null,
          userIntent: input.userIntent,
          maxRepairRetries: input.maxRecipeRepairRetries ?? 2,
        },
        {
          callRepairModel: deps.callRepairModel,
          validateRecipe: deps.validateRecipe,
          resolveIngredients: deps.resolveIngredients,
          stripForPersistence: deps.stripForPersistence,
        }
      )
  );

  attempts.push({
    stage: "full_recipe_repair",
    success: repairResult.success,
    details: { status: repairResult.final.status, reasons: repairResult.final.reasons, attempts: repairResult.attempts.length },
  });

  telemetry.log({
    stage: "full_recipe_repair",
    status: repairResult.success ? "success" : "fallback",
    dishFamily: dishFamily.key,
    metadata: { status: repairResult.final.status, reasons: repairResult.final.reasons, attempts: repairResult.attempts.length },
  });

  if (repairResult.success && repairResult.final.status === "accepted_repair") {
    reasons.push(...repairResult.final.reasons);
    telemetry.log({ stage: "final_decision", status: "accepted", dishFamily: dishFamily.key, metadata: { status: "accepted_after_recipe_repair", reasons } });
    return finalizeResult(telemetry, {
      success: true,
      status: "accepted_after_recipe_repair",
      dishFamily,
      recipe: repairResult.final.recipe,
      validation: validationSnapshot,
      attempts,
      reasons,
    });
  }

  if (repairResult.final.status === "kept_original") {
    reasons.push(...repairResult.final.reasons);
    const finalRecipe = deps.stripForPersistence
      ? deps.stripForPersistence(assembledRecipe)
      : assembledRecipe;

    telemetry.log({ stage: "final_decision", status: "fallback", dishFamily: dishFamily.key, metadata: { status: "kept_repaired_recipe", reasons } });
    return finalizeResult(telemetry, {
      success: true,
      status: "kept_repaired_recipe",
      dishFamily,
      recipe: finalRecipe,
      validation: validationSnapshot,
      attempts,
      reasons,
    });
  }

  reasons.push(...repairResult.final.reasons);
  reasons.push("Recipe generation failed after full repair fallback.");
  telemetry.log({ stage: "final_decision", status: "rejected", dishFamily: dishFamily.key, metadata: { status: "regenerate_from_ingredients", reasons } });
  return finalizeResult(telemetry, {
    success: false,
    status: "regenerate_from_ingredients",
    dishFamily,
    recipe: null,
    validation: validationSnapshot,
    attempts,
    reasons,
  });
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function orchestrateRecipeGeneration(
  input: RecipeGenerationInput,
  deps: RecipeGenerationDependencies
): Promise<RecipeGenerationResult> {
  const attempts: RecipeGenerationAttemptLog[] = [];
  const reasons: string[] = [];
  const telemetry = buildTelemetry(input.requestId);

  // Normalize freeform dietary tags once; reuse the typed array throughout.
  const normalizedDietaryConstraints: DietaryConstraint[] = normalizeDietaryTags(
    input.dietaryConstraints ?? []
  );

  // ── 0. Dish family selection (with intent-resolver fallback) ───────────────

  const familySelection = await withTelemetryTiming(
    telemetry,
    {
      stage: "dish_family_selection",
      dishFamily: null,
      metadata: { dishHint: input.dishHint ?? null, titleHint: input.titleHint ?? null },
    },
    async () => chooseDishFamily(input)
  );

  const allCandidates = familySelection.fallbackCandidates;
  const familyLimit = input.maxFallbackFamilies ?? allCandidates.length;
  const familiesToTry = allCandidates.slice(0, Math.max(1, familyLimit));

  attempts.push({
    stage: "dish_family_selection",
    success: familiesToTry.length > 0,
    details: {
      dishHint: input.dishHint ?? null,
      titleHint: input.titleHint ?? null,
      selected: familySelection.primary?.key ?? null,
      fallbackCandidates: familiesToTry.map((f) => f.key),
      reasoning: familySelection.reasoning,
    },
  });

  telemetry.log({
    stage: "dish_family_selection",
    status: familiesToTry.length > 0 ? "success" : "error",
    dishFamily: familySelection.primary?.key ?? null,
    metadata: {
      selected: familySelection.primary?.key ?? null,
      fallbackCandidates: familiesToTry.map((f) => f.key),
      reasoning: familySelection.reasoning,
      userIntent: input.userIntent,
    },
  });

  if (familiesToTry.length === 0) {
    reasons.push("Could not confidently determine dish family.");
    telemetry.log({
      stage: "final_decision",
      status: "rejected",
      dishFamily: null,
      issues: [{ code: "DISH_FAMILY_NOT_FOUND", severity: "error", message: "Could not confidently determine dish family." }],
      metadata: { status: "failed" },
    });
    return finalizeResult(telemetry, {
      success: false,
      status: "failed",
      dishFamily: null,
      recipe: null,
      validation: EMPTY_VALIDATION,
      attempts,
      reasons,
    });
  }

  // ── Try each candidate family in priority order ────────────────────────────
  // For explicit prompts: only one family in the list — behavior unchanged.
  // For vague/pantry/goal prompts: try candidates sequentially, return on first success.

  let lastResult: RecipeGenerationResult | null = null;

  for (let fi = 0; fi < familiesToTry.length; fi++) {
    const dishFamily = familiesToTry[fi]!;

    if (fi > 0) {
      telemetry.log({
        stage: "dish_family_selection",
        status: "retry",
        dishFamily: dishFamily.key,
        metadata: { fallbackAttempt: fi + 1, totalCandidates: familiesToTry.length },
      });
    }

    const result = await runGenerationForFamily({
      input,
      dishFamily,
      deps,
      telemetry,
      attempts,
      reasons,
      normalizedDietaryConstraints,
    });

    if (result.success) return result;
    lastResult = result;
  }

  // All families exhausted — return the last failure
  return lastResult!;
}

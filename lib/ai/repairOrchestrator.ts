import { buildRepairPrompt } from "./repairPromptBuilder";
import { buildMacroRepairHints } from "./macroRepairHints";
import { buildDishAwareRepairPlan, type DietaryConstraint } from "./dishAwareRepairPlanner";
import { buildConstraintAwareRepairHints } from "./constraintAwareRepairHints";
import { evaluateRepairDiff } from "./repairDiffEvaluator";
import { decideRepairAcceptance } from "./repairAcceptanceDecider";
import { calculateRecipeNutrition } from "./nutritionCalculator";
import { validateMacroTargets } from "./macroTargetValidator";
import { validateRatios } from "./ratioValidator";
import { normalizeAISteps } from "./normalizeAISteps";
import type { DishFamilyRule } from "./dishFamilyRules";

export type RepairableIngredient = {
  ingredientName: string;
  normalizedName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  grams?: number | null;
  densityGPerMl?: number | null;
  classes?: string[];
};

export type RepairableStep = {
  text: string;
  methodTag?: string | null;
  estimatedMinutes?: number | null;
  temperatureC?: number | null;
};

export type GenericIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  metadata?: Record<string, unknown>;
  ingredientName?: string;
  stepNumber?: number;
};

export type ValidationResult = {
  passed: boolean;
  score: number;
  issues: GenericIssue[];
};

export type MacroTargets = {
  caloriesMax?: number | null;
  caloriesMin?: number | null;
  proteinMinG?: number | null;
  proteinMaxG?: number | null;
  carbsMinG?: number | null;
  carbsMaxG?: number | null;
  fatMinG?: number | null;
  fatMaxG?: number | null;
  fiberMinG?: number | null;
  fiberMaxG?: number | null;
  sugarMaxG?: number | null;
  sodiumMaxMg?: number | null;
};

export type RepairDraft = {
  title?: string | null;
  ingredients: RepairableIngredient[];
  steps: RepairableStep[];
  notes?: string[] | null;
};

export type RepairOrchestratorInput = {
  originalTitle?: string | null;
  originalIngredients: RepairableIngredient[];
  originalSteps: RepairableStep[];
  originalValidation: ValidationResult;
  originalResolvedIngredients?: RepairableIngredient[];
  dishFamily: DishFamilyRule;
  dietaryConstraints?: DietaryConstraint[] | null;
  macroTargets?: MacroTargets | null;
  userIntent?: string | null;
  maxRepairRetries?: number;
};

export type RepairOrchestratorSuccess = {
  status: "accepted_repair" | "kept_original" | "regenerate_from_ingredients";
  recipe: RepairDraft;
  reasons: string[];
  metrics: Record<string, unknown>;
};

export type RepairOrchestratorResult = {
  success: boolean;
  final: RepairOrchestratorSuccess;
  attempts: Array<{
    attemptNumber: number;
    prompt: string;
    repairedDraft?: RepairDraft;
    repairedValidation?: ValidationResult;
    ratioValidation?: ValidationResult;
    nutritionConfidenceScore?: number;
    macroValidationPassed?: boolean;
    diffPassed?: boolean;
    acceptanceDecision?: string;
    reasons?: string[];
  }>;
};

export type RepairModelOutput = {
  title?: string | null;
  ingredients: Array<{
    ingredientName: string;
    quantity?: number | null;
    unit?: string | null;
    grams?: number | null;
    classes?: string[];
  }>;
  steps: Array<{
    text: string;
    methodTag?: string | null;
    estimatedMinutes?: number | null;
    temperatureC?: number | null;
  }>;
  notes?: string[] | null;
};

export type RepairOrchestratorDependencies = {
  /** Model call that takes the repair prompt and returns parsed JSON. */
  callRepairModel: (prompt: string) => Promise<RepairModelOutput>;

  /** Culinary/structural validator. */
  validateRecipe: (params: {
    dishFamily: DishFamilyRule;
    ingredients: RepairableIngredient[];
    steps: RepairableStep[];
    dietaryConstraints?: DietaryConstraint[] | null;
  }) => Promise<ValidationResult> | ValidationResult;

  /** Optional ingredient resolver. If omitted, ingredients are used as-is. */
  resolveIngredients?: (
    ingredients: RepairableIngredient[]
  ) => Promise<RepairableIngredient[]> | RepairableIngredient[];

  /** Strip AI-only metadata before persistence. Optional. */
  stripForPersistence?: (draft: RepairDraft) => RepairDraft;
};

// ── Internal helpers ─────────────────────────────────────────────────────────

function mergeIssues(
  ...groups: Array<{ issues?: GenericIssue[] } | null | undefined>
): GenericIssue[] {
  return groups.flatMap((group) => group?.issues ?? []);
}

function toValidationResult(result: {
  passed: boolean;
  score: number;
  issues: Array<{ code: string; severity: "warning" | "error"; message: string }>;
}): ValidationResult {
  return {
    passed: result.passed,
    score: result.score,
    issues: result.issues,
  };
}

function buildDraftFromModelOutput(output: RepairModelOutput): RepairDraft {
  return {
    title: output.title ?? null,
    ingredients: output.ingredients.map((ing) => ({
      ingredientName: ing.ingredientName,
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
      grams: ing.grams ?? null,
      classes: ing.classes ?? [],
    })),
    steps: normalizeAISteps(
      output.steps.map((step) => ({
        text: step.text,
        methodTag: step.methodTag ?? null,
        estimatedMinutes: step.estimatedMinutes ?? null,
        temperatureC: step.temperatureC ?? null,
      }))
    ),
    notes: output.notes ?? [],
  };
}

/** Convert RepairableIngredient[] to the { name: string }[] shape calculateRecipeNutrition expects. */
function toNutritionIngredients(
  ingredients: RepairableIngredient[]
): Array<{ name: string }> {
  return ingredients.map((ing) => ({
    name: ing.normalizedName || ing.ingredientName,
  }));
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export async function orchestrateRecipeRepair(
  input: RepairOrchestratorInput,
  deps: RepairOrchestratorDependencies
): Promise<RepairOrchestratorResult> {
  const {
    originalTitle = null,
    originalIngredients,
    originalSteps,
    originalValidation,
    originalResolvedIngredients,
    dishFamily,
    dietaryConstraints = [],
    macroTargets = null,
    userIntent = null,
    maxRepairRetries = 2,
  } = input;

  const attempts: RepairOrchestratorResult["attempts"] = [];

  const resolvedOriginalIngredients =
    originalResolvedIngredients ??
    (deps.resolveIngredients
      ? await deps.resolveIngredients(originalIngredients)
      : originalIngredients);

  const originalNutrition = calculateRecipeNutrition(
    toNutritionIngredients(resolvedOriginalIngredients),
    null
  );

  let latestMacroHints = buildMacroRepairHints({
    issues: [],
    nutrition: originalNutrition,
    targets: macroTargets,
  });

  let latestDishAwarePlan = buildDishAwareRepairPlan({
    dishFamily,
    macroHints: latestMacroHints.hints,
    ingredients: resolvedOriginalIngredients,
    dietaryConstraints: dietaryConstraints ?? [],
  });

  for (let retryCount = 0; retryCount <= maxRepairRetries; retryCount += 1) {
    const constraintHintsResult = buildConstraintAwareRepairHints({
      dietaryConstraints,
      issues: originalValidation.issues,
    });

    const prompt = buildRepairPrompt({
      dishFamily,
      title: originalTitle,
      ingredients: resolvedOriginalIngredients,
      steps: originalSteps,
      dietaryConstraints,
      macroIssues: null,
      macroHints: latestMacroHints.hints,
      dishAwareActions: latestDishAwarePlan.actions,
      validationIssues: originalValidation.issues,
      userIntent,
      constraintHints: constraintHintsResult.hints,
    });

    const modelOutput = await deps.callRepairModel(prompt);
    const repairedDraft = buildDraftFromModelOutput(modelOutput);

    const repairedResolvedIngredients = deps.resolveIngredients
      ? await deps.resolveIngredients(repairedDraft.ingredients)
      : repairedDraft.ingredients;

    const repairedValidation = await deps.validateRecipe({
      dishFamily,
      ingredients: repairedResolvedIngredients,
      steps: repairedDraft.steps,
      dietaryConstraints,
    });

    const ratioValidation = toValidationResult(
      validateRatios({ dishFamily, ingredients: repairedResolvedIngredients })
    );

    const nutritionResult = calculateRecipeNutrition(
      toNutritionIngredients(repairedResolvedIngredients),
      null
    );

    const macroTargetValidation = validateMacroTargets({
      nutrition: nutritionResult,
      targets: macroTargets,
      preferPerServing: true,
    });

    const macroRepairHints = buildMacroRepairHints({
      issues: macroTargetValidation.issues,
      nutrition: nutritionResult,
      targets: macroTargets,
    });

    const dishAwareRepairPlan = buildDishAwareRepairPlan({
      dishFamily,
      macroHints: macroRepairHints.hints,
      ingredients: repairedResolvedIngredients,
      dietaryConstraints: dietaryConstraints ?? [],
    });

    const combinedValidation: ValidationResult = {
      passed: repairedValidation.passed && ratioValidation.passed,
      score: Number(
        (repairedValidation.score * 0.75 + ratioValidation.score * 0.25).toFixed(2)
      ),
      issues: mergeIssues(repairedValidation, ratioValidation),
    };

    const repairDiff = evaluateRepairDiff({
      originalIngredients: resolvedOriginalIngredients,
      repairedIngredients: repairedResolvedIngredients,
      originalSteps,
      repairedSteps: repairedDraft.steps,
      dishFamily,
    });

    const acceptance = decideRepairAcceptance({
      repairedValidation: combinedValidation,
      macroTargetValidation,
      repairDiff,
      originalValidationScore: originalValidation.score,
      retryCount,
      maxRepairRetries,
    });

    attempts.push({
      attemptNumber: retryCount + 1,
      prompt,
      repairedDraft,
      repairedValidation: combinedValidation,
      ratioValidation,
      nutritionConfidenceScore: nutritionResult.confidenceScore,
      macroValidationPassed: macroTargetValidation.passed,
      diffPassed: repairDiff.passed,
      acceptanceDecision: acceptance.decision,
      reasons: acceptance.reasons,
    });

    if (acceptance.decision === "accept_repair") {
      const finalDraft = deps.stripForPersistence
        ? deps.stripForPersistence(repairedDraft)
        : repairedDraft;

      return {
        success: true,
        final: {
          status: "accepted_repair",
          recipe: finalDraft,
          reasons: acceptance.reasons,
          metrics: acceptance.metrics,
        },
        attempts,
      };
    }

    if (acceptance.decision === "keep_original") {
      const originalDraft: RepairDraft = {
        title: originalTitle,
        ingredients: originalIngredients,
        steps: originalSteps,
        notes: [],
      };
      return {
        success: true,
        final: {
          status: "kept_original",
          recipe: deps.stripForPersistence
            ? deps.stripForPersistence(originalDraft)
            : originalDraft,
          reasons: acceptance.reasons,
          metrics: acceptance.metrics,
        },
        attempts,
      };
    }

    if (acceptance.decision === "regenerate_from_ingredients") {
      const originalDraft: RepairDraft = {
        title: originalTitle,
        ingredients: originalIngredients,
        steps: originalSteps,
        notes: [],
      };
      return {
        success: false,
        final: {
          status: "regenerate_from_ingredients",
          recipe: originalDraft,
          reasons: acceptance.reasons,
          metrics: acceptance.metrics,
        },
        attempts,
      };
    }

    // retry_repair — feed updated hints into next loop
    latestMacroHints = macroRepairHints;
    latestDishAwarePlan = dishAwareRepairPlan;
  }

  // Loop exhausted
  const originalDraft: RepairDraft = {
    title: originalTitle,
    ingredients: originalIngredients,
    steps: originalSteps,
    notes: [],
  };

  return {
    success: false,
    final: {
      status: "kept_original",
      recipe: originalDraft,
      reasons: ["Repair loop exhausted without reaching an acceptable repaired recipe."],
      metrics: {},
    },
    attempts,
  };
}

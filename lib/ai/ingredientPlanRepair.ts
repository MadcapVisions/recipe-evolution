import {
  validateIngredientPlanCandidate,
  type IngredientPlanCandidate,
  type IngredientPlannerInput,
  type IngredientPlannerValidationResult,
  type IngredientPlannerDependencies,
} from "./ingredientPlanner";

export type IngredientPlanRepairAttempt = {
  attemptNumber: number;
  prompt: {
    systemPrompt: string;
    userPrompt: string;
  };
  candidate?: IngredientPlanCandidate;
  validation?: IngredientPlannerValidationResult;
  reasons?: string[];
};

export type IngredientPlanRepairDecision =
  | "accept_plan"
  | "retry_plan_repair"
  | "regenerate_plan";

export type IngredientPlanRepairResult = {
  success: boolean;
  decision: IngredientPlanRepairDecision;
  candidate: IngredientPlanCandidate | null;
  validation: IngredientPlannerValidationResult | null;
  reasons: string[];
  attempts: IngredientPlanRepairAttempt[];
};

type IngredientPlanRepairParams = {
  plannerInput: IngredientPlannerInput;
  failedCandidate: IngredientPlanCandidate;
  failedValidation: IngredientPlannerValidationResult;
  maxRepairRetries?: number;
};

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function summarizeIssues(validation: IngredientPlannerValidationResult): string[] {
  return validation.issues.map(
    (issue) => `- [${issue.severity}] ${issue.code}: ${issue.message}`
  );
}

function buildIngredientPlanRepairPrompt(params: {
  plannerInput: IngredientPlannerInput;
  failedCandidate: IngredientPlanCandidate;
  failedValidation: IngredientPlannerValidationResult;
}): { systemPrompt: string; userPrompt: string } {
  const { plannerInput, failedCandidate, failedValidation } = params;

  const systemPrompt = [
    "You are repairing an ingredient plan for a recipe.",
    "Do not write cooking steps.",
    "Do not rewrite the dish into something else.",
    "Keep changes minimal and targeted.",
    "Preserve dish family identity.",
    "",
    "You must obey these dish-family rules:",
    `Dish family: ${plannerInput.dishFamily.key} (${plannerInput.dishFamily.displayName})`,
    `Required class groups: ${safeJson(plannerInput.dishFamily.requiredClassGroups)}`,
    `Common classes: ${plannerInput.dishFamily.commonClasses.join(", ") || "(none)"}`,
    `Optional classes: ${plannerInput.dishFamily.optionalClasses.join(", ") || "(none)"}`,
    `Forbidden classes: ${plannerInput.dishFamily.forbiddenClasses.join(", ") || "(none)"}`,
    `Suspicious classes: ${plannerInput.dishFamily.suspiciousClasses.join(", ") || "(none)"}`,
    `Generation constraints: ${plannerInput.dishFamily.generationConstraints.join(" | ") || "(none)"}`,
    `Strictness: ${plannerInput.dishFamily.strictness ?? "medium"}`,
    `Max uncommon ingredients: ${plannerInput.dishFamily.maxUncommonIngredients ?? 0}`,
    "",
    "Return JSON only using this exact schema:",
    safeJson({
      title: "",
      ingredients: [{ ingredientName: "", quantity: 0, unit: "", grams: null, classes: [] }],
      notes: [],
    }),
  ].join("\n");

  const userPrompt = [
    plannerInput.userIntent
      ? `Original user intent: ${plannerInput.userIntent}`
      : "Original user intent: (not provided)",
    plannerInput.titleHint
      ? `Title hint: ${plannerInput.titleHint}`
      : "Title hint: (not provided)",
    plannerInput.servings != null
      ? `Servings: ${plannerInput.servings}`
      : "Servings: (not provided)",
    plannerInput.dietaryConstraints?.length
      ? `Dietary constraints: ${plannerInput.dietaryConstraints.join(", ")}`
      : "Dietary constraints: none",
    plannerInput.availableIngredients?.length
      ? `Available ingredients: ${plannerInput.availableIngredients.join(", ")}`
      : "Available ingredients: not restricted",
    plannerInput.preferredIngredients?.length
      ? `Preferred ingredients: ${plannerInput.preferredIngredients.join(", ")}`
      : "Preferred ingredients: none",
    plannerInput.forbiddenIngredients?.length
      ? `Forbidden ingredients by name: ${plannerInput.forbiddenIngredients.join(", ")}`
      : "Forbidden ingredients by name: none",
    plannerInput.macroTargets
      ? `Macro targets: ${safeJson(plannerInput.macroTargets)}`
      : "Macro targets: none",
    "",
    "Current failed ingredient plan:",
    safeJson(failedCandidate),
    "",
    "Validation issues to fix:",
    ...summarizeIssues(failedValidation),
    "",
    "Instructions:",
    "- Fix only the ingredient plan.",
    "- Do not write cooking steps.",
    "- Remove forbidden or suspicious ingredients if they caused failure.",
    "- Restore missing required classes.",
    "- Improve ratio and macro fit if possible without breaking dish identity.",
    "- Keep the changes as small as possible.",
  ].join("\n");

  return { systemPrompt, userPrompt };
}

function decideIngredientPlanAcceptance(params: {
  validation: IngredientPlannerValidationResult;
  retryCount: number;
  maxRepairRetries: number;
}): { decision: IngredientPlanRepairDecision; reasons: string[] } {
  const { validation, retryCount, maxRepairRetries } = params;

  const reasons: string[] = [];
  const errorCount = validation.issues.filter((i) => i.severity === "error").length;
  const warningCount = validation.issues.filter((i) => i.severity === "warning").length;

  if (validation.passed && validation.score >= 0.8) {
    reasons.push("Ingredient plan passed validation.");
    return { decision: "accept_plan", reasons };
  }

  if (errorCount > 0) {
    reasons.push("Ingredient plan still has hard validation errors.");
    return {
      decision: retryCount < maxRepairRetries ? "retry_plan_repair" : "regenerate_plan",
      reasons,
    };
  }

  if (warningCount > 4 || validation.score < 0.65) {
    reasons.push("Ingredient plan remains weak after repair.");
    return {
      decision: retryCount < maxRepairRetries ? "retry_plan_repair" : "regenerate_plan",
      reasons,
    };
  }

  reasons.push("Ingredient plan is acceptable but not perfect.");
  return { decision: "accept_plan", reasons };
}

export async function repairIngredientPlan(
  params: IngredientPlanRepairParams,
  deps: IngredientPlannerDependencies
): Promise<IngredientPlanRepairResult> {
  const { plannerInput, failedCandidate, failedValidation, maxRepairRetries = 2 } = params;

  const attempts: IngredientPlanRepairAttempt[] = [];
  let currentCandidate = failedCandidate;
  let currentValidation = failedValidation;

  for (let retryCount = 0; retryCount <= maxRepairRetries; retryCount += 1) {
    const prompt = buildIngredientPlanRepairPrompt({
      plannerInput,
      failedCandidate: currentCandidate,
      failedValidation: currentValidation,
    });

    const repairedCandidate = await deps.callPlannerModel(prompt);
    const repairedValidation = validateIngredientPlanCandidate(plannerInput, repairedCandidate);

    const acceptance = decideIngredientPlanAcceptance({
      validation: repairedValidation,
      retryCount,
      maxRepairRetries,
    });

    attempts.push({
      attemptNumber: retryCount + 1,
      prompt,
      candidate: repairedCandidate,
      validation: repairedValidation,
      reasons: acceptance.reasons,
    });

    if (acceptance.decision === "accept_plan") {
      return {
        success: true,
        decision: "accept_plan",
        candidate: repairedCandidate,
        validation: repairedValidation,
        reasons: acceptance.reasons,
        attempts,
      };
    }

    if (acceptance.decision === "regenerate_plan") {
      return {
        success: false,
        decision: "regenerate_plan",
        candidate: repairedCandidate,
        validation: repairedValidation,
        reasons: acceptance.reasons,
        attempts,
      };
    }

    currentCandidate = repairedCandidate;
    currentValidation = repairedValidation;
  }

  return {
    success: false,
    decision: "regenerate_plan",
    candidate: currentCandidate,
    validation: currentValidation,
    reasons: ["Ingredient plan repair loop exhausted."],
    attempts,
  };
}

import {
  runStepGenerator,
  buildStepGenerationPrompt,
  type StepGenerationCandidate,
  type StepGenerationInput,
  type StepGenerationPromptPayload,
  type StepGenerationValidationResult,
  type StepGeneratorDependencies,
} from "./stepGenerator";

export type StepPlanRepairAttempt = {
  attemptNumber: number;
  prompt: StepGenerationPromptPayload;
  candidate?: StepGenerationCandidate;
  validation?: StepGenerationValidationResult;
  reasons?: string[];
};

export type StepPlanRepairDecision =
  | "accept_steps"
  | "retry_step_repair"
  | "regenerate_steps"
  | "regenerate_from_ingredients";

export type StepPlanRepairResult = {
  success: boolean;
  decision: StepPlanRepairDecision;
  candidate: StepGenerationCandidate | null;
  validation: StepGenerationValidationResult | null;
  reasons: string[];
  attempts: StepPlanRepairAttempt[];
};

type StepPlanRepairParams = {
  stepInput: StepGenerationInput;
  failedCandidate: StepGenerationCandidate;
  failedValidation: StepGenerationValidationResult;
  maxRepairRetries?: number;
};

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function summarizeIssues(validation: StepGenerationValidationResult): string[] {
  return validation.issues.map(
    (issue) => `- [${issue.severity}] ${issue.code}: ${issue.message}`
  );
}

function buildStepRepairPrompt(params: {
  stepInput: StepGenerationInput;
  failedCandidate: StepGenerationCandidate;
  failedValidation: StepGenerationValidationResult;
}): StepGenerationPromptPayload {
  const { stepInput, failedCandidate, failedValidation } = params;

  // When there are no steps at all, repair is impossible — switch to fresh generation.
  // The model sees empty steps as "nothing to fix" and loops back to empty output.
  if (!failedCandidate.steps.length) {
    const base = buildStepGenerationPrompt(stepInput);
    return {
      systemPrompt:
        base.systemPrompt +
        "\n\nCRITICAL OVERRIDE: A previous generation attempt returned ZERO steps. " +
        "This is unacceptable. You MUST return a complete set of cooking steps now. " +
        "Do not return an empty steps array. Minimum 4 detailed steps are required.",
      userPrompt: base.userPrompt,
    };
  }

  const systemPrompt = [
    "You are repairing a cooking step plan for a recipe.",
    "Do not change the approved ingredient list.",
    "Do not add new ingredients.",
    "Do not rewrite the dish into something else.",
    "Keep changes minimal and targeted.",
    "",
    "You must obey these dish-family constraints:",
    `Dish family: ${stepInput.dishFamily.key} (${stepInput.dishFamily.displayName})`,
    `Required methods: ${(stepInput.dishFamily.requiredMethods ?? []).join(", ") || "(none)"}`,
    `Optional methods: ${(stepInput.dishFamily.optionalMethods ?? []).join(", ") || "(none)"}`,
    `Generation constraints: ${stepInput.dishFamily.generationConstraints.join(" | ") || "(none)"}`,
    "",
    "Return JSON only using this exact schema:",
    safeJson({
      title: stepInput.title ?? "",
      steps: [{ text: "", methodTag: "", estimatedMinutes: null, temperatureC: null }],
      notes: [],
    }),
    "",
    "Hard rules:",
    "- Use only the approved ingredients already provided.",
    "- Do not mention undeclared ingredients.",
    "- Preserve dish identity.",
    "- Keep methodTag filled for every step.",
    "- Keep the number of changes as small as possible.",
  ].join("\n");

  const userPrompt = [
    stepInput.userIntent
      ? `Original user intent: ${stepInput.userIntent}`
      : "Original user intent: (not provided)",
    stepInput.title ? `Title: ${stepInput.title}` : "Title: (not provided)",
    stepInput.servings != null
      ? `Servings: ${stepInput.servings}`
      : "Servings: (not provided)",
    stepInput.dietaryConstraints?.length
      ? `Dietary constraints: ${stepInput.dietaryConstraints.join(", ")}`
      : "Dietary constraints: none",
    "",
    "Approved ingredients:",
    safeJson(stepInput.ingredients),
    "",
    "Current failed step plan:",
    safeJson(failedCandidate),
    "",
    "Validation issues to fix:",
    ...summarizeIssues(failedValidation),
    "",
    "Instructions:",
    "- Fix only the steps.",
    "- Do not change ingredients.",
    "- Remove undeclared ingredient mentions.",
    "- Restore missing required methods if possible.",
    "- Make the steps clearer and more realistic.",
    "- Keep timing and temperatures plausible.",
  ].join("\n");

  return { systemPrompt, userPrompt };
}

function decideStepPlanAcceptance(params: {
  validation: StepGenerationValidationResult;
  retryCount: number;
  maxRepairRetries: number;
}): { decision: StepPlanRepairDecision; reasons: string[] } {
  const { validation, retryCount, maxRepairRetries } = params;

  const reasons: string[] = [];
  const errorCount = validation.issues.filter((i) => i.severity === "error").length;
  const warningCount = validation.issues.filter((i) => i.severity === "warning").length;

  const hasHallucinatedIngredients = validation.issues.some(
    (i) => i.code === "STEPGEN_HALLUCINATED_INGREDIENT"
  );
  const missingRequiredMethods = validation.issues.some(
    (i) => i.code === "STEPGEN_MISSING_REQUIRED_METHOD"
  );

  if (validation.passed && validation.score >= 0.8) {
    reasons.push("Step plan passed validation.");
    return { decision: "accept_steps", reasons };
  }

  if (hasHallucinatedIngredients && retryCount >= maxRepairRetries) {
    reasons.push("Step plan continues to hallucinate undeclared ingredients.");
    reasons.push("Escalate instead of looping indefinitely.");
    return { decision: "regenerate_from_ingredients", reasons };
  }

  if (errorCount > 0) {
    reasons.push("Step plan still has hard validation errors.");
    return {
      decision:
        retryCount < maxRepairRetries
          ? "retry_step_repair"
          : missingRequiredMethods
          ? "regenerate_steps"
          : "regenerate_from_ingredients",
      reasons,
    };
  }

  if (warningCount > 4 || validation.score < 0.65) {
    reasons.push("Step plan remains weak after repair.");
    return {
      decision: retryCount < maxRepairRetries ? "retry_step_repair" : "regenerate_steps",
      reasons,
    };
  }

  reasons.push("Step plan is acceptable but not perfect.");
  return { decision: "accept_steps", reasons };
}

export async function repairStepPlan(
  params: StepPlanRepairParams,
  deps: StepGeneratorDependencies
): Promise<StepPlanRepairResult> {
  const { stepInput, failedCandidate, failedValidation, maxRepairRetries = 2 } = params;

  const attempts: StepPlanRepairAttempt[] = [];
  let currentCandidate = failedCandidate;
  let currentValidation = failedValidation;

  for (let retryCount = 0; retryCount <= maxRepairRetries; retryCount += 1) {
    const prompt = buildStepRepairPrompt({
      stepInput,
      failedCandidate: currentCandidate,
      failedValidation: currentValidation,
    });

    const repairedCandidate = await deps.callStepModel(prompt);

    const rerun = await runStepGenerator(
      { ...stepInput, title: repairedCandidate.title ?? stepInput.title },
      { callStepModel: async () => repairedCandidate }
    );

    const repairedValidation = rerun.validation;

    const acceptance = decideStepPlanAcceptance({
      validation: repairedValidation,
      retryCount,
      maxRepairRetries,
    });

    attempts.push({
      attemptNumber: retryCount + 1,
      prompt,
      candidate: rerun.candidate,
      validation: repairedValidation,
      reasons: acceptance.reasons,
    });

    if (acceptance.decision === "accept_steps") {
      return {
        success: true,
        decision: "accept_steps",
        candidate: rerun.candidate,
        validation: repairedValidation,
        reasons: acceptance.reasons,
        attempts,
      };
    }

    if (
      acceptance.decision === "regenerate_steps" ||
      acceptance.decision === "regenerate_from_ingredients"
    ) {
      return {
        success: false,
        decision: acceptance.decision,
        candidate: rerun.candidate,
        validation: repairedValidation,
        reasons: acceptance.reasons,
        attempts,
      };
    }

    currentCandidate = rerun.candidate;
    currentValidation = repairedValidation;
  }

  return {
    success: false,
    decision: "regenerate_steps",
    candidate: currentCandidate,
    validation: currentValidation,
    reasons: ["Step repair loop exhausted."],
    attempts,
  };
}

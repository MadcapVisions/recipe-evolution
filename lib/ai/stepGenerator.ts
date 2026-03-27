import { normalizeAISteps } from "./normalizeAISteps";
import type { DishFamilyRule } from "./dishFamilyRules";
import type { RequiredNamedIngredient } from "./requiredNamedIngredient";
import { ingredientMentionedInSteps } from "./requiredNamedIngredient";
import { stepSatisfiesMethod } from "./methodRegistry";

export type StepGenerationIngredient = {
  ingredientName: string;
  normalizedName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  grams?: number | null;
  classes?: string[];
};

export type GeneratedStep = {
  text: string;
  methodTag?: string | null;
  estimatedMinutes?: number | null;
  temperatureC?: number | null;
};

export type StepGenerationCandidate = {
  title?: string | null;
  steps: GeneratedStep[];
  notes?: string[] | null;
};

export type StepGenerationInput = {
  userIntent?: string | null;
  title?: string | null;
  dishFamily: DishFamilyRule;
  ingredients: StepGenerationIngredient[];
  requiredNamedIngredients?: RequiredNamedIngredient[] | null;
  dietaryConstraints?: string[] | null;
  servings?: number | null;
};

export type StepGenerationIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  metadata?: Record<string, unknown>;
};

export type StepGenerationValidationResult = {
  passed: boolean;
  score: number;
  issues: StepGenerationIssue[];
};

export type StepGenerationPromptPayload = {
  systemPrompt: string;
  userPrompt: string;
};

export type StepGeneratorDependencies = {
  callStepModel: (payload: StepGenerationPromptPayload) => Promise<StepGenerationCandidate>;
};

// ── Internal helpers ─────────────────────────────────────────────────────────

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ingredientNamesForPrompt(ingredients: StepGenerationIngredient[]): string[] {
  return ingredients.map((i) => i.ingredientName);
}

function ingredientNamesForMatching(ingredients: StepGenerationIngredient[]): string[] {
  return ingredients.flatMap((i) =>
    [i.ingredientName, i.normalizedName].filter(Boolean) as string[]
  );
}

function textMentionsAny(text: string, candidates: string[]): boolean {
  const t = normalizeText(text);
  return candidates.some((candidate) => {
    const c = normalizeText(candidate);
    return c.length > 0 && (t.includes(c) || c.includes(t));
  });
}

// Common kitchen ingredients that would be suspicious if undeclared
const SUSPICIOUS_TOKENS = [
  "carrot", "beef", "chicken", "spinach", "soy sauce", "broth",
  "cream cheese", "flour", "sugar", "butter", "milk", "egg", "eggs",
  "rice", "pasta", "tomato", "garlic", "onion", "shrimp", "tofu",
];

function detectHallucinatedIngredients(
  steps: GeneratedStep[],
  ingredients: StepGenerationIngredient[]
): Array<{ stepIndex: number; token: string }> {
  const knownIngredients = ingredientNamesForMatching(ingredients);
  const hits: Array<{ stepIndex: number; token: string }> = [];

  steps.forEach((step, index) => {
    const t = normalizeText(step.text);
    for (const token of SUSPICIOUS_TOKENS) {
      const tokenNorm = normalizeText(token);
      if (!t.includes(tokenNorm)) continue;

      const declared = knownIngredients.some((known) => {
        const k = normalizeText(known);
        return k.includes(tokenNorm) || tokenNorm.includes(k);
      });

      if (!declared) hits.push({ stepIndex: index, token });
    }
  });

  return hits;
}

function validateRequiredMethods(
  dishFamily: DishFamilyRule,
  steps: GeneratedStep[]
): StepGenerationIssue[] {
  const issues: StepGenerationIssue[] = [];

  for (const method of dishFamily.requiredMethods ?? []) {
    const found = steps.some((step) => stepSatisfiesMethod(step, method));

    if (!found) {
      issues.push({
        code: "STEPGEN_MISSING_REQUIRED_METHOD",
        severity: "warning",
        message: `Missing required method "${method}" for dish family "${dishFamily.key}".`,
        metadata: { method },
      });
    }
  }

  return issues;
}

function validateBasicStepStructure(
  candidate: StepGenerationCandidate,
  input: StepGenerationInput
): StepGenerationValidationResult {
  const issues: StepGenerationIssue[] = [];
  const steps = normalizeAISteps(candidate.steps ?? []);

  if (!steps.length) {
    return {
      passed: false,
      score: 0,
      issues: [{ code: "STEPGEN_NO_STEPS", severity: "error", message: "No steps were generated." }],
    };
  }

  if (steps.length < 2) {
    issues.push({
      code: "STEPGEN_TOO_FEW_STEPS",
      severity: "warning",
      message: "Very few steps were generated. This may be under-specified.",
    });
  }

  // Hallucinated ingredients
  const hallucinated = detectHallucinatedIngredients(steps, input.ingredients);
  for (const hit of hallucinated) {
    issues.push({
      code: "STEPGEN_HALLUCINATED_INGREDIENT",
      severity: "error",
      message: `Step ${hit.stepIndex + 1} mentions undeclared ingredient "${hit.token}".`,
      metadata: { stepIndex: hit.stepIndex, token: hit.token },
    });
  }

  // Required methods
  issues.push(...validateRequiredMethods(input.dishFamily, steps));

  // Per-step checks
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];

    if (!step.text || normalizeText(step.text).length < 8) {
      issues.push({
        code: "STEPGEN_WEAK_STEP_TEXT",
        severity: "warning",
        message: `Step ${i + 1} text is too short or vague.`,
        metadata: { stepIndex: i },
      });
    }

    if (
      step.estimatedMinutes != null &&
      (step.estimatedMinutes < 0 || step.estimatedMinutes > 240)
    ) {
      issues.push({
        code: "STEPGEN_IMPLAUSIBLE_STEP_DURATION",
        severity: "warning",
        message: `Step ${i + 1} has implausible duration ${step.estimatedMinutes}.`,
        metadata: { stepIndex: i, estimatedMinutes: step.estimatedMinutes },
      });
    }

    if (step.temperatureC != null && (step.temperatureC < 20 || step.temperatureC > 300)) {
      issues.push({
        code: "STEPGEN_IMPLAUSIBLE_TEMPERATURE",
        severity: "warning",
        message: `Step ${i + 1} has implausible temperature ${step.temperatureC}C.`,
        metadata: { stepIndex: i, temperatureC: step.temperatureC },
      });
    }

    if (!step.methodTag) {
      issues.push({
        code: "STEPGEN_MISSING_METHOD_TAG",
        severity: "warning",
        message: `Step ${i + 1} is missing methodTag.`,
        metadata: { stepIndex: i },
      });
    }
  }

  // At least one step should ground to an ingredient by name
  const knownIngredients = ingredientNamesForPrompt(input.ingredients);
  const someStepGrounded = steps.some((step) => textMentionsAny(step.text, knownIngredients));

  if (!someStepGrounded) {
    issues.push({
      code: "STEPGEN_UNGROUNDED_STEPS",
      severity: "warning",
      message: "Generated steps do not clearly reference the approved ingredients.",
    });
  }

  for (const req of input.requiredNamedIngredients ?? []) {
    if (req.requiredStrength !== "hard") continue;
    if (!ingredientMentionedInSteps(req, steps)) {
      issues.push({
        code: "STEP_MISSING_REQUIRED_INGREDIENT_USAGE",
        severity: "error",
        message: `Required ingredient "${req.normalizedName}" is not used in any step.`,
        metadata: { normalizedName: req.normalizedName },
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  let score = 1;
  score -= errorCount * 0.22;
  score -= warningCount * 0.06;
  score -= infoCount * 0.02;
  score = Math.max(0, Math.min(1, score));

  return { passed: errorCount === 0, score: Number(score.toFixed(2)), issues };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Optional canonical step-sequence hints for dish families that the model
 * tends to fumble. These anchor the generation without over-constraining it.
 */
const FAMILY_SEQUENCE_HINTS: Partial<Record<string, string>> = {
  custard_flan: [
    "Canonical flan sequence:",
    "1. Prepare caramel: dissolve sugar in a dry pan until amber, pour into mold(s), let harden.",
    "2. Mix custard base: whisk eggs, milk/cream, sugar, and flavoring until smooth.",
    "3. Strain custard through a fine-mesh sieve into the mold.",
    "4. Bake in a water bath (bain-marie) at low temperature until just set (slight jiggle in center).",
    "5. Cool completely, then refrigerate at least 2 hours.",
    "6. Unmold onto a serving plate just before serving.",
  ].join("\n"),

  bread_pudding: [
    "Canonical bread pudding sequence:",
    "1. Tear or slice bread into pieces; arrange in greased baking dish or slow cooker.",
    "2. Whisk custard base: eggs, milk or cream, sugar, vanilla, and spices until smooth.",
    "3. Pour custard evenly over bread; press down so all pieces are soaked.",
    "4. Rest at least 20–30 minutes (or refrigerate overnight) so bread absorbs the custard fully.",
    "5. Bake at moderate heat until custard is set and top is golden, or slow-cook on low until just set.",
    "6. Serve warm with sauce, caramel, or cream if desired.",
  ].join("\n"),

  brownie: [
    "Canonical brownie sequence:",
    "1. Melt fat and chocolate/cocoa together.",
    "2. Whisk in sugar, then eggs and vanilla.",
    "3. Fold in dry ingredients (flour, salt) until just combined.",
    "4. Spread into prepared pan.",
    "5. Bake until edges set and toothpick comes out with moist crumbs.",
    "6. Cool completely before cutting.",
  ].join("\n"),
};

export function buildStepGenerationPrompt(
  input: StepGenerationInput
): StepGenerationPromptPayload {
  const ingredientNames = ingredientNamesForPrompt(input.ingredients);
  const sequenceHint = FAMILY_SEQUENCE_HINTS[input.dishFamily.key];

  const systemPrompt = [
    "You are generating cooking steps for an already-approved ingredient plan.",
    "You must use the approved ingredients only.",
    "Do not add new ingredients.",
    "Do not invent garnish, topping, sauce, or seasoning unless it is already in the ingredient list.",
    "Do not rewrite the dish into something else.",
    "Respect dish-family identity and required methods.",
    "",
    `Dish family: ${input.dishFamily.key} (${input.dishFamily.displayName})`,
    `Required methods: ${(input.dishFamily.requiredMethods ?? []).join(", ") || "(none)"}`,
    `Optional methods: ${(input.dishFamily.optionalMethods ?? []).join(", ") || "(none)"}`,
    `Generation constraints: ${input.dishFamily.generationConstraints.join(" | ") || "(none)"}`,
    ...(sequenceHint ? ["", sequenceHint, "Follow this sequence closely unless the ingredients clearly call for a variation."] : []),
    "",
    "Return JSON only using this exact schema:",
    JSON.stringify(
      {
        title: input.title ?? "",
        steps: [{ text: "", methodTag: "", estimatedMinutes: null, temperatureC: null }],
        notes: [],
      },
      null,
      2
    ),
    "",
    "Each step MUST include:",
    "- text",
    "- methodTag",
    "- estimatedMinutes if possible",
    "- temperatureC only if relevant",
    "",
    "Do not invent new methodTag values casually. Keep them practical and simple.",
  ].join("\n");

  const userPrompt = [
    input.userIntent
      ? `Original user intent: ${input.userIntent}`
      : "Original user intent: (not provided)",
    input.title ? `Title: ${input.title}` : "Title: (not provided)",
    input.servings != null ? `Servings: ${input.servings}` : "Servings: (not provided)",
    input.dietaryConstraints?.length
      ? `Dietary constraints: ${input.dietaryConstraints.join(", ")}`
      : "Dietary constraints: none",
    "",
    "Approved ingredients:",
    JSON.stringify(input.ingredients, null, 2),
    "",
    "Hard requirements:",
    "- Use only the approved ingredients.",
    "- Do not mention undeclared ingredients.",
    "- Make the method sequence fit the dish family.",
    "- Keep the steps clear and realistic.",
    "- Preserve dish identity.",
    "",
    `Ingredient names you may reference: ${ingredientNames.join(", ")}`,
  ].join("\n");

  return { systemPrompt, userPrompt };
}

function buildStepGenerationRetryPrompt(
  input: StepGenerationInput
): StepGenerationPromptPayload {
  const base = buildStepGenerationPrompt(input);
  return {
    systemPrompt:
      base.systemPrompt +
      "\n\nCRITICAL: The previous attempt returned zero steps. You MUST return at least 3 complete cooking steps. An empty steps array is NEVER acceptable.",
    userPrompt: base.userPrompt,
  };
}

export async function runStepGenerator(
  input: StepGenerationInput,
  deps: StepGeneratorDependencies
): Promise<{
  candidate: StepGenerationCandidate;
  validation: StepGenerationValidationResult;
  prompt: StepGenerationPromptPayload;
}> {
  const prompt = buildStepGenerationPrompt(input);
  const rawCandidate = await deps.callStepModel(prompt);

  const candidate: StepGenerationCandidate = {
    ...rawCandidate,
    steps: normalizeAISteps(rawCandidate.steps ?? []),
  };

  const validation = validateBasicStepStructure(candidate, input);

  // If the model returned no steps, retry once with an explicit demand before
  // handing off to the repair path (which struggles with empty candidates).
  if (
    !validation.passed &&
    validation.issues.some((i) => i.code === "STEPGEN_NO_STEPS")
  ) {
    const retryPrompt = buildStepGenerationRetryPrompt(input);
    const retryRaw = await deps.callStepModel(retryPrompt);
    const retryCandidate: StepGenerationCandidate = {
      ...retryRaw,
      steps: normalizeAISteps(retryRaw.steps ?? []),
    };
    const retryValidation = validateBasicStepStructure(retryCandidate, input);
    if (retryCandidate.steps.length > 0) {
      return { candidate: retryCandidate, validation: retryValidation, prompt: retryPrompt };
    }
  }

  return { candidate, validation, prompt };
}

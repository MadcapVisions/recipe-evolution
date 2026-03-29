import { callAIForJson } from "./jsonResponse";
import type { AIMessage } from "./chatPromptBuilder";
import type { CookingBrief } from "./contracts/cookingBrief";
import type { VerificationResult, VerificationRetryStrategy } from "./contracts/verificationResult";
import type { LockedDirectionSelected } from "./contracts/lockedDirectionSession";
import type { AiTaskSettingRecord } from "./taskSettings";
import { sanitizeCookingBriefIngredients } from "./briefSanitization";

export type FailureAdjudicationDecision =
  | "keep_failure"
  | "sanitize_constraints"
  | "return_structured_recipe"
  | "clarify_intent";

export type FailureAdjudication = {
  adjudicatorSource: "heuristic" | "ai" | "default";
  decision: FailureAdjudicationDecision;
  confidence: number;
  summary: string;
  retryStrategy: VerificationRetryStrategy;
  modelUsed?: string | null;
  providerUsed?: string | null;
  escalated?: boolean;
  escalationReason?: string | null;
  dropRequiredNamedIngredients: string[];
  dropRequiredIngredients: string[];
  correctedStructuredRecipe: Record<string, unknown> | null;
};

type FailureAdjudicationInput = {
  flow: "home_create" | "recipe_improve" | "recipe_import";
  taskSetting?: AiTaskSettingRecord | null;
  failureKind: string;
  userMessage?: string | null;
  instruction?: string | null;
  rawRecipeText?: string | null;
  conversationHistory?: AIMessage[] | null;
  selectedDirection?: LockedDirectionSelected | null;
  cookingBrief?: CookingBrief | null;
  recipeCandidate?: unknown;
  verification?: VerificationResult | null;
  reasons?: string[] | null;
  rawModelOutput?: unknown;
};

const ACKNOWLEDGEMENT_NOISE = new Set([
  "ok",
  "okay",
  "sure",
  "yeah",
  "yep",
  "yes",
  "sounds good",
  "that works",
  "looks good",
  "fine",
  "cool",
]);

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

function defaultAdjudication(): FailureAdjudication {
  return {
    adjudicatorSource: "default",
    decision: "keep_failure",
    confidence: 0.2,
    summary: "The failure should stand.",
    retryStrategy: "ask_user",
    modelUsed: null,
    providerUsed: null,
    escalated: false,
    escalationReason: null,
    dropRequiredNamedIngredients: [],
    dropRequiredIngredients: [],
    correctedStructuredRecipe: null,
  };
}

function heuristicAdjudication(input: FailureAdjudicationInput): FailureAdjudication | null {
  const brief = input.cookingBrief;
  const issueReasons = input.reasons ?? input.verification?.reasons ?? [];
  const onlyRequiredIngredientFailure =
    issueReasons.length > 0 &&
    issueReasons.every(
      (reason) =>
        /required ingredient/i.test(reason) &&
        /(missing from the final recipe|not used in any step)/i.test(reason)
    );

  if (!brief || !onlyRequiredIngredientFailure) {
    return null;
  }

  const noisyNames = unique(
    (brief.ingredients.requiredNamedIngredients ?? [])
      .map((item) => item.normalizedName)
      .filter((name) => ACKNOWLEDGEMENT_NOISE.has(normalizeText(name)))
  );

  if (noisyNames.length === 0) {
    return null;
  }

  return {
    adjudicatorSource: "heuristic",
    decision: "sanitize_constraints",
    confidence: 0.99,
    summary: `Dropped conversational filler from required ingredients: ${noisyNames.join(", ")}.`,
    retryStrategy: "regenerate_stricter",
    modelUsed: null,
    providerUsed: null,
    escalated: false,
    escalationReason: null,
    dropRequiredNamedIngredients: noisyNames,
    dropRequiredIngredients: noisyNames,
    correctedStructuredRecipe: null,
  };
}

function normalizeAdjudication(parsed: unknown): FailureAdjudication | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const raw = parsed as Record<string, unknown>;
  const decision = raw.decision;
  if (
    decision !== "keep_failure" &&
    decision !== "sanitize_constraints" &&
    decision !== "return_structured_recipe" &&
    decision !== "clarify_intent"
  ) {
    return null;
  }

  const retryStrategy = raw.retryStrategy;
  const safeRetryStrategy: VerificationRetryStrategy =
    retryStrategy === "none" ||
    retryStrategy === "regenerate_same_model" ||
    retryStrategy === "regenerate_stricter" ||
    retryStrategy === "upgrade_model" ||
    retryStrategy === "try_fallback_model" ||
    retryStrategy === "ask_user"
      ? retryStrategy
      : decision === "clarify_intent"
      ? "ask_user"
      : "regenerate_stricter";

  return {
    adjudicatorSource: "ai",
    decision,
    confidence:
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0.5,
    summary: typeof raw.summary === "string" && raw.summary.trim().length > 0 ? raw.summary.trim() : "AI adjudication completed.",
    retryStrategy: safeRetryStrategy,
    modelUsed: typeof raw.modelUsed === "string" ? raw.modelUsed : null,
    providerUsed: typeof raw.providerUsed === "string" ? raw.providerUsed : null,
    escalated: raw.escalated === true,
    escalationReason: typeof raw.escalationReason === "string" ? raw.escalationReason : null,
    dropRequiredNamedIngredients: unique(
      Array.isArray(raw.dropRequiredNamedIngredients)
        ? raw.dropRequiredNamedIngredients.filter((value): value is string => typeof value === "string").map(normalizeText)
        : []
    ),
    dropRequiredIngredients: unique(
      Array.isArray(raw.dropRequiredIngredients)
        ? raw.dropRequiredIngredients.filter((value): value is string => typeof value === "string").map(normalizeText)
        : []
    ),
    correctedStructuredRecipe:
      raw.correctedStructuredRecipe && typeof raw.correctedStructuredRecipe === "object" && !Array.isArray(raw.correctedStructuredRecipe)
        ? (raw.correctedStructuredRecipe as Record<string, unknown>)
        : null,
  };
}

function hasSuspiciousConstraintSignal(input: FailureAdjudicationInput) {
  const requiredProvenance = input.cookingBrief?.ingredients.provenance?.required ?? [];
  const suspiciousSource = requiredProvenance.some(
    (item) => item.sourceType === "assistant_text" || item.sourceType === "unknown"
  );
  const suspiciousShortRequired = (input.cookingBrief?.ingredients.required ?? []).some((item) => normalizeText(item).length <= 3);
  return suspiciousSource || suspiciousShortRequired;
}

function shouldEscalateAdjudication(input: FailureAdjudicationInput, adjudication: FailureAdjudication, hasFallbackModel: boolean) {
  if (!hasFallbackModel || adjudication.adjudicatorSource !== "ai") {
    return false;
  }

  if (adjudication.confidence < 0.72) {
    return true;
  }

  if (adjudication.decision === "keep_failure" && hasSuspiciousConstraintSignal(input)) {
    return true;
  }

  if (adjudication.decision === "clarify_intent" && input.flow !== "recipe_import") {
    return true;
  }

  return false;
}

export function buildCiaConstraintProvenance(input: FailureAdjudicationInput) {
  return {
    sourceTurnIds: input.cookingBrief?.source_turn_ids ?? [],
    compilerNotes: input.cookingBrief?.compiler_notes ?? [],
    requiredIngredients: (input.cookingBrief?.ingredients.required ?? []).map((name) => ({
      name,
      kind: "required",
    })),
    requiredNamedIngredients: (input.cookingBrief?.ingredients.requiredNamedIngredients ?? []).map((item) => ({
      rawText: item.rawText,
      normalizedName: item.normalizedName,
      aliases: item.aliases,
      source: item.source,
      requiredStrength: item.requiredStrength,
      provenance: item.provenance ?? null,
    })),
    ingredientProvenance: input.cookingBrief?.ingredients.provenance ?? {
      required: [],
      preferred: [],
      forbidden: [],
    },
    forbiddenIngredients: input.cookingBrief?.ingredients.forbidden ?? [],
    preferredIngredients: input.cookingBrief?.ingredients.preferred ?? [],
  };
}

function buildAdjudicatorPrompt(input: FailureAdjudicationInput) {
  return JSON.stringify(
    {
      flow: input.flow,
      failureKind: input.failureKind,
      userMessage: input.userMessage ?? null,
      instruction: input.instruction ?? null,
      rawRecipeText: input.rawRecipeText ?? null,
      conversationHistory: input.conversationHistory ?? [],
      selectedDirection: input.selectedDirection ?? null,
      cookingBrief: input.cookingBrief ?? null,
      recipeCandidate: input.recipeCandidate ?? null,
      verification: input.verification ?? null,
      reasons: input.reasons ?? null,
      rawModelOutput: input.rawModelOutput ?? null,
    },
    null,
    2
  );
}

async function callAdjudicatorModel(
  input: FailureAdjudicationInput,
  options: {
    model: string;
    escalationContext?: FailureAdjudication | null;
  }
) {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are a recipe failure adjudicator.
Review the full creation context and decide whether the failure is real, whether noisy constraints should be removed, or whether a structured recipe can be salvaged.

Return only valid JSON:
{
  "decision": "keep_failure" | "sanitize_constraints" | "return_structured_recipe" | "clarify_intent",
  "confidence": number,
  "summary": string,
  "retryStrategy": "none" | "regenerate_same_model" | "regenerate_stricter" | "upgrade_model" | "try_fallback_model" | "ask_user",
  "dropRequiredNamedIngredients": string[],
  "dropRequiredIngredients": string[],
  "correctedStructuredRecipe": object | null
}

Rules:
- If the failure is caused by casual acknowledgements, filler, or obvious non-ingredient noise like "ok", remove only those constraints.
- Do not remove a real ingredient unless the full context makes it clearly non-semantic noise.
- Prefer "sanitize_constraints" when a noisy constraint poisoned the brief.
- Prefer "clarify_intent" when the conversation itself is genuinely ambiguous.
- For recipe import failures, use "return_structured_recipe" only if you can recover a complete structured recipe with ingredient quantities.
- correctedStructuredRecipe must be null unless decision = "return_structured_recipe".
- Be conservative: keep real failures, but do not let obvious parser junk cause them.`,
    },
    {
      role: "user",
      content: buildAdjudicatorPrompt(input),
    },
  ];

  if (options.escalationContext) {
    messages.push({
      role: "user",
      content: JSON.stringify(
        {
          escalation: "review_previous_low_confidence_adjudication",
          previousAdjudication: options.escalationContext,
          instruction:
            "Re-evaluate conservatively. Override the prior result only if the packet shows a likely false failure, poisoned constraint, or salvageable import.",
        },
        null,
        2
      ),
    });
  }

  return callAIForJson(messages, {
    model: options.model,
    fallback_models: [],
    strict_model: true,
    temperature: 0.1,
    max_tokens: Math.min(input.taskSetting?.maxTokens ?? 900, 900),
  });
}

export async function adjudicateRecipeFailure(input: FailureAdjudicationInput): Promise<FailureAdjudication> {
  const heuristic = heuristicAdjudication(input);
  if (heuristic) {
    return heuristic;
  }

  if (!input.taskSetting?.enabled) {
    return defaultAdjudication();
  }

  try {
    const primaryResult = await callAdjudicatorModel(input, {
      model: input.taskSetting.primaryModel,
    });
    const primaryAdjudication = normalizeAdjudication(primaryResult.parsed) ?? defaultAdjudication();
    primaryAdjudication.modelUsed = primaryResult.model ?? input.taskSetting.primaryModel;
    primaryAdjudication.providerUsed = primaryResult.provider;

    const fallbackModel = input.taskSetting.fallbackModel?.trim() || null;
    if (shouldEscalateAdjudication(input, primaryAdjudication, Boolean(fallbackModel && fallbackModel !== input.taskSetting.primaryModel))) {
      const escalationModel = fallbackModel;
      if (escalationModel) {
        const escalatedResult = await callAdjudicatorModel(input, {
          model: escalationModel,
          escalationContext: primaryAdjudication,
        });
        const escalatedAdjudication = normalizeAdjudication(escalatedResult.parsed) ?? primaryAdjudication;
        escalatedAdjudication.modelUsed = escalatedResult.model ?? escalationModel;
        escalatedAdjudication.providerUsed = escalatedResult.provider;
        escalatedAdjudication.escalated = true;
        escalatedAdjudication.escalationReason =
          primaryAdjudication.confidence < 0.72
            ? "primary_low_confidence"
            : primaryAdjudication.decision === "keep_failure"
            ? "suspicious_constraint_signal"
            : "clarify_requires_second_opinion";
        return escalatedAdjudication;
      }
    }

    return primaryAdjudication;
  } catch {
    return defaultAdjudication();
  }
}

export function applyFailureAdjudicationToBrief(brief: CookingBrief, adjudication: FailureAdjudication): CookingBrief {
  if (adjudication.decision !== "sanitize_constraints") {
    return brief;
  }

  const dropNamed = new Set(adjudication.dropRequiredNamedIngredients.map(normalizeText));
  const dropRequired = new Set(adjudication.dropRequiredIngredients.map(normalizeText));

  return sanitizeCookingBriefIngredients({
    ...brief,
    ingredients: {
      ...brief.ingredients,
      required: brief.ingredients.required.filter((name) => !dropRequired.has(normalizeText(name))),
      requiredNamedIngredients: (brief.ingredients.requiredNamedIngredients ?? []).filter(
        (item) => !dropNamed.has(normalizeText(item.normalizedName))
      ),
    },
    compiler_notes: [
      ...brief.compiler_notes,
      `Failure adjudicator sanitized required ingredients: ${unique([
        ...adjudication.dropRequiredIngredients,
        ...adjudication.dropRequiredNamedIngredients,
      ]).join(", ") || "none"}.`,
    ],
  });
}

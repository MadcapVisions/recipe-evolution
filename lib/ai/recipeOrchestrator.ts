import type { CookingBrief } from "./contracts/cookingBrief";
import type {
  AttemptOrchestrationState,
  PreviousAttemptSnapshot,
  RecipeWorkflowFlow,
} from "./contracts/orchestrationState";
import { summarizeBriefConstraints } from "./contracts/orchestrationState";
import type { VerificationRetryStrategy } from "./contracts/verificationResult";

export type RecipeTurnIntent =
  | "options_request"
  | "edit_request"
  | "question"
  | "save_request"
  | "clarify";

export type RecipeTurnAction =
  | "provide_options"
  | "suggest_recipe_update"
  | "reply_only"
  | "ask_clarifying_question";

export type RecipeTurnAnalysis = {
  intent: RecipeTurnIntent;
  action: RecipeTurnAction;
  normalizedRecipeInstruction: string | null;
  shouldIncludeSuggestion: boolean;
  canBuildLatestRequest: boolean;
  reason: string | null;
};

export type HomeBuildAnalysis = {
  intent: "build_recipe";
  action: "build_recipe";
  canBuild: boolean;
  normalizedBuildPrompt: string;
  requestModeHint: "generate" | "locked" | "revise";
  reason: string | null;
};

const OPTION_REQUEST_PATTERN =
  /\b(?:options?|ideas?|directions?|variations?|alternatives?|choices?)\b/i;
const EXPLICIT_OPTION_REQUEST_PATTERN =
  /\b(?:show|give)\s+me\b.+\b(?:options?|ideas?|directions?|variations?|alternatives?|choices?)\b/i;
const NUMERIC_OPTION_REQUEST_PATTERN =
  /\b(?:2|3)\s+(?:options?|ideas?|directions?|variations?|alternatives?|choices?)\b/i;
const QUESTION_PREFIX_PATTERN =
  /^(?:can|could|would|should|is|are|what|how|do|does|will)\b/i;
const ACTIONABLE_METHOD_QUESTION_PATTERN =
  /^(?:can|could|would|should)\s+(?:i|you|we)\s+(?:roast|bake|broil|grill|sear|saute|sauté|fry|toast|chill|marinate|glaze|season|top|finish|fold in|mix in|stir in|add|remove|swap|replace|increase|reduce|make)\b/i;
const DIRECT_EDIT_PATTERN =
  /^(?:add|remove|swap|replace|use|make|omit|fold in|mix in|increase|reduce|cut|double|halve|turn|convert|change)\b/i;
const SAVE_REQUEST_PATTERN =
  /\b(?:save|build|update|apply|make)\b.+\b(?:recipe|version|change)\b/i;
const CONTEXTUAL_EDIT_FRAGMENT_PATTERN =
  /^(?:with(?:out)?|plus|minus|more|less|extra|no|omit|instead of|swap in|swap out|replace with|add|remove|use|make it|turn it|convert it)\b/i;
const SIMPLE_COMPOUND_EDIT_PATTERN =
  /^(?:more|less|extra|add|remove|without|with)\s+[a-z0-9][a-z0-9\s,'/-]*(?:\s+(?:and|or)\s+[a-z0-9][a-z0-9\s,'/-]*)*$/i;

export function wantsRecipeDirectionOptions(message: string) {
  return (
    OPTION_REQUEST_PATTERN.test(message) ||
    EXPLICIT_OPTION_REQUEST_PATTERN.test(message) ||
    NUMERIC_OPTION_REQUEST_PATTERN.test(message)
  );
}

export function analyzeHomeBuildRequest(input: {
  ideaTitle: string;
  prompt?: string | null;
  selectedDirectionLocked?: boolean;
  retryMode?: string | null;
}): HomeBuildAnalysis {
  const trimmedPrompt = input.prompt?.trim() ?? "";
  const normalizedPrompt = trimmedPrompt || input.ideaTitle.trim();
  const promptTurnAnalysis = trimmedPrompt
    ? analyzeRecipeTurn({
        userMessage: trimmedPrompt,
        selectedDirectionLocked: input.selectedDirectionLocked,
        hasRecipeContext: input.selectedDirectionLocked,
      })
    : null;
  const canBuild = normalizedPrompt.length > 0 && (trimmedPrompt ? promptTurnAnalysis?.canBuildLatestRequest !== false : true);

  return {
    intent: "build_recipe",
    action: "build_recipe",
    canBuild,
    normalizedBuildPrompt: normalizedPrompt,
    requestModeHint: input.selectedDirectionLocked
      ? input.retryMode
        ? "revise"
        : "locked"
      : "generate",
    reason:
      normalizedPrompt.length === 0
        ? "A recipe build needs a dish title or prompt."
        : !canBuild && trimmedPrompt
        ? promptTurnAnalysis?.reason ?? "This looks like a recipe question, not a build instruction."
        : null,
  };
}

export function normalizeRecipeEditInstruction(instruction: string): string {
  const trimmed = instruction.trim();
  if (!trimmed) return trimmed;

  const directRewritePatterns: Array<[RegExp, string]> = [
    [/^(?:can|could|would)\s+(?:i|you|we)\s+add\s+(.+?)(?:\s+to\s+this)?\??$/i, "Add $1 to the recipe."],
    [/^(?:can|could|would)\s+(?:i|you|we)\s+use\s+(.+?)(?:\s+instead(?:\s+of\s+.+?)?)?\??$/i, "Update the recipe to use $1."],
    [/^(?:can|could|would)\s+(?:i|you|we)\s+swap\s+(.+?)\??$/i, "Swap $1 in the recipe."],
    [/^(?:can|could|would)\s+(?:i|you|we)\s+replace\s+(.+?)\??$/i, "Replace $1 in the recipe."],
    [/^(?:can|could|would)\s+(?:i|you|we)\s+make\s+it\s+(.+?)\??$/i, "Make the recipe $1."],
    [/^(?:can|could|would)\s+(?:i|you|we)\s+remove\s+(.+?)\??$/i, "Remove $1 from the recipe."],
    [/^(?:can|could|would)\s+(?:i|you|we)\s+increase\s+(.+?)\??$/i, "Increase $1 in the recipe."],
    [/^(?:can|could|would)\s+(?:i|you|we)\s+reduce\s+(.+?)\??$/i, "Reduce $1 in the recipe."],
    [/^(?:can|could|would|should)\s+(?:i|you|we)\s+roast\s+(.+?)\??$/i, "Roast $1 in the recipe."],
  ];

  for (const [pattern, replacement] of directRewritePatterns) {
    if (pattern.test(trimmed)) {
      return trimmed.replace(pattern, replacement).replace(/\s+/g, " ").trim();
    }
  }

  if (/^(?:is|are)\s+there\b/i.test(trimmed) || /^(?:what|how)\s+(?:if|about)\b/i.test(trimmed)) {
    return `${trimmed.replace(/\?+$/, "")}. Update the recipe accordingly and return the full edited recipe.`;
  }

  return trimmed;
}

export function analyzeRecipeTurn(input: {
  userMessage: string;
  selectedDirectionLocked?: boolean;
  hasRecipeContext?: boolean;
}): RecipeTurnAnalysis {
  const message = input.userMessage.trim();
  if (!message) {
    return {
      intent: "clarify",
      action: "ask_clarifying_question",
      normalizedRecipeInstruction: null,
      shouldIncludeSuggestion: false,
      canBuildLatestRequest: false,
      reason: "Ask for a concrete change before building a new version.",
    };
  }

  if (wantsRecipeDirectionOptions(message) && !input.selectedDirectionLocked) {
    return {
      intent: "options_request",
      action: "provide_options",
      normalizedRecipeInstruction: null,
      shouldIncludeSuggestion: false,
      canBuildLatestRequest: false,
      reason: "Choose a direction before building a recipe update.",
    };
  }

  const normalizedInstruction = normalizeRecipeEditInstruction(message);
  const normalizedDiffers = normalizedInstruction !== message;

  if (
    normalizedDiffers ||
    DIRECT_EDIT_PATTERN.test(message) ||
    SAVE_REQUEST_PATTERN.test(message) ||
    (input.hasRecipeContext && ACTIONABLE_METHOD_QUESTION_PATTERN.test(message))
  ) {
    return {
      intent: SAVE_REQUEST_PATTERN.test(message) ? "save_request" : "edit_request",
      action: "suggest_recipe_update",
      normalizedRecipeInstruction: normalizedInstruction,
      shouldIncludeSuggestion: true,
      canBuildLatestRequest: true,
      reason: null,
    };
  }

  if (
    input.hasRecipeContext &&
    !QUESTION_PREFIX_PATTERN.test(message) &&
    (CONTEXTUAL_EDIT_FRAGMENT_PATTERN.test(message) || SIMPLE_COMPOUND_EDIT_PATTERN.test(message))
  ) {
    return {
      intent: "edit_request",
      action: "suggest_recipe_update",
      normalizedRecipeInstruction: normalizeRecipeEditInstruction(message),
      shouldIncludeSuggestion: true,
      canBuildLatestRequest: true,
      reason: null,
    };
  }

  if (
    !input.hasRecipeContext &&
    (CONTEXTUAL_EDIT_FRAGMENT_PATTERN.test(message) || SIMPLE_COMPOUND_EDIT_PATTERN.test(message))
  ) {
    return {
      intent: "clarify",
      action: "ask_clarifying_question",
      normalizedRecipeInstruction: null,
      shouldIncludeSuggestion: false,
      canBuildLatestRequest: false,
      reason: "Name the recipe or describe the dish before asking for a change.",
    };
  }

  if (QUESTION_PREFIX_PATTERN.test(message)) {
    return {
      intent: "question",
      action: "reply_only",
      normalizedRecipeInstruction: null,
      shouldIncludeSuggestion: false,
      canBuildLatestRequest: false,
      reason: "This looks like a recipe question, not a request to build a new version.",
    };
  }

  if (message.split(/\s+/).length <= 3 && !input.hasRecipeContext) {
    return {
      intent: "clarify",
      action: "ask_clarifying_question",
      normalizedRecipeInstruction: null,
      shouldIncludeSuggestion: false,
      canBuildLatestRequest: false,
      reason: "Add a little more detail about the recipe change you want.",
    };
  }

  return {
    intent: "edit_request",
    action: "suggest_recipe_update",
    normalizedRecipeInstruction: normalizedInstruction,
    shouldIncludeSuggestion: true,
    canBuildLatestRequest: true,
    reason: null,
  };
}

export function buildAttemptOrchestrationState(input: {
  flow: RecipeWorkflowFlow;
  action: AttemptOrchestrationState["action"];
  intent?: string | null;
  buildable: boolean;
  conversationKey?: string | null;
  recipeId?: string | null;
  versionId?: string | null;
  attemptNumber: number;
  requestMode?: string | null;
  normalizedInstruction?: string | null;
  stateBefore?: string | null;
  stateAfter?: string | null;
  usedSessionRecovery?: boolean;
  usedFallbackModel?: boolean;
  failureStage?: string | null;
  retryStrategy?: VerificationRetryStrategy | "none" | null;
  recoveryActions?: string[];
  reason?: string | null;
  reasonCodes?: string[];
  model?: string | null;
  previousAttempt?: PreviousAttemptSnapshot;
  brief?: CookingBrief | null;
}): AttemptOrchestrationState {
  return {
    flow: input.flow,
    action: input.action,
    intent: input.intent ?? null,
    buildable: input.buildable,
    conversationKey: input.conversationKey ?? null,
    recipeId: input.recipeId ?? null,
    versionId: input.versionId ?? null,
    attemptNumber: input.attemptNumber,
    requestMode: input.requestMode ?? null,
    normalizedInstruction: input.normalizedInstruction ?? null,
    stateBefore: input.stateBefore ?? null,
    stateAfter: input.stateAfter ?? null,
    usedSessionRecovery: input.usedSessionRecovery === true,
    usedFallbackModel: input.usedFallbackModel === true,
    failureStage: input.failureStage ?? null,
    retryStrategy: input.retryStrategy ?? "none",
    recoveryActions: input.recoveryActions ?? [],
    reason: input.reason ?? null,
    reasonCodes: input.reasonCodes ?? [],
    model: input.model ?? null,
    previousAttempt: input.previousAttempt ?? null,
    sessionConstraintSummary: summarizeBriefConstraints(input.brief),
  };
}

import type { AIMessage } from "./chatPromptBuilder";
import type { LockedDirectionSession } from "./contracts/lockedDirectionSession";
import type { CookingBriefRequestMode } from "./contracts/cookingBrief";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

const PIVOT_PATTERNS = [
  /\bnever mind\b/,
  /\bstart over\b/,
  /\bscratch that\b/,
  /\bforget that\b/,
  /\bsomething (?:completely|totally|entirely) different\b/,
  /\blet'?s try something (?:completely|totally) different\b/,
  /\ba different (?:dish|recipe|meal)\b/,
  /\bactually\b.+\b(?:want|give me|show me)\b/,
  /\b(?:actually\s+)?(?:make|cook|give me)\b.+\binstead\b/,
  /\btotally different\b/,
];

const COMPARE_PATTERNS = [
  /\bideas?\b/,
  /\boptions?\b/,
  /\balternatives?\b/,
  /\bvariations?\b/,
  /\bshow me\b/,
  /\bgive me\b/,
];

const REVISE_PATTERNS = [
  /\bmake (?:it|this)\b/,
  /\bkeep\b/,
  /\bwithout\b/,
  /\bremove\b/,
  /\bskip\b/,
  /\bleave out\b/,
  /\badd\b/,
  /\bswap\b/,
  /\buse\b.+\binstead of\b/,
  /\bmore\b/,
  /\bless\b/,
];

const OPTION_REJECTION_PATTERNS = [
  /\bnone of these\b/,
  /\bnot quite right\b/,
  /\bnot these\b/,
  /\bother options\b/,
  /\bdifferent options\b/,
];

function isLockedSessionState(state: LockedDirectionSession["state"] | null | undefined) {
  return state === "direction_locked" || state === "ready_to_build" || state === "building" || state === "built";
}

export function looksLikePivotRequest(message: string) {
  const normalized = normalizeText(message);
  return PIVOT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function deriveBriefRequestMode(input: {
  latestUserMessage: string;
  conversationHistory?: AIMessage[];
  lockedSessionState?: LockedDirectionSession["state"] | null;
  latestAssistantMode?: "options" | "refine" | null;
  hasDishSignal?: boolean;
  hasConstraintSignal?: boolean;
}): CookingBriefRequestMode {
  const latestUser = normalizeText(input.latestUserMessage);
  const historyLength = input.conversationHistory?.length ?? 0;
  const sessionLocked = isLockedSessionState(input.lockedSessionState);
  const hasDishSignal = input.hasDishSignal ?? false;
  const hasConstraintSignal = input.hasConstraintSignal ?? false;

  if (looksLikePivotRequest(latestUser)) {
    return "explore";
  }

  if (input.latestAssistantMode === "options" && OPTION_REJECTION_PATTERNS.some((pattern) => pattern.test(latestUser))) {
    return "compare";
  }

  if (sessionLocked) {
    return REVISE_PATTERNS.some((pattern) => pattern.test(latestUser)) ? "revise" : "locked";
  }

  if (input.latestAssistantMode === "options") {
    return "compare";
  }

  if (REVISE_PATTERNS.some((pattern) => pattern.test(latestUser))) {
    return historyLength > 0 || hasDishSignal ? "revise" : "explore";
  }

  if (COMPARE_PATTERNS.some((pattern) => pattern.test(latestUser))) {
    return "compare";
  }

  if (hasDishSignal && (historyLength === 0 || hasConstraintSignal)) {
    return "locked";
  }

  if (historyLength > 0) {
    return hasDishSignal ? "locked" : "explore";
  }

  return hasDishSignal ? "locked" : "explore";
}

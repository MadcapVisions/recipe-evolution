import {
  detectRequestedDishFamily,
  DISH_FAMILIES,
  type DishFamily,
} from "../homeRecipeAlignment";
import { callAIForJson } from "../jsonResponse";
import type { AIMessage } from "../chatPromptBuilder";

// These families must never be returned as uncertainty fallbacks.
// If heuristics suggest one of these for an unknown dish, return null instead.
const FORBIDDEN_UNCERTAINTY_FAMILIES = new Set<string>([
  "beverage",
  "preserve",
  "sauce_condiment",
  "pickled_fermented",
]);

const DISH_FAMILY_SET = new Set<string>(DISH_FAMILIES);

export type DishFamilyClassificationInput = {
  dishName: string | null;
  userMessage: string;
  conversationContext?: string | null;
  currentFamily?: string | null;
  taskSettingModel?: string | null;
};

export type DishFamilyClassificationResult = {
  family: DishFamily | null;
  confidence: number;
  source: "heuristic" | "ai" | "unchanged" | "null_low_confidence";
  reasoning: string;
};

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidFamily(value: string | null): value is DishFamily {
  return value !== null && DISH_FAMILY_SET.has(value);
}

// Bread name patterns that homeRecipeAlignment misses when the word "bread" is absent.
const BREAD_NAME_SIGNALS = [
  "sourdough",
  "baguette",
  "focaccia",
  "ciabatta",
  "brioche",
  "challah",
  "pretzel",
  "bagel",
];

// Candy/confection name patterns — homeRecipeAlignment doesn't catch brand-name
// candy bars like "100 Grand Bars" or "Reese's Cups". Catch them by name shape.
const CANDY_NAME_SIGNALS = [
  "candy bar",
  "grand bar",
  "grand bars",
  "peanut butter cup",
  "peanut butter cups",
  "chocolate bark",
  "toffee",
  "fudge",
  "brittle",
  "praline",
  "nougat",
  "truffle",
  "caramel candy",
  "confection",
  "marshmallow",
  "marzipan",
];

function preClassifyByDishName(dishName: string): DishFamily | null {
  const norm = normalizeText(dishName);

  // Check for bread patterns that homeRecipeAlignment misses (sourdough, etc.)
  if (BREAD_NAME_SIGNALS.some((s) => norm.includes(s))) {
    return "bread";
  }

  // Check for candy/confection patterns that homeRecipeAlignment misses
  if (CANDY_NAME_SIGNALS.some((s) => norm.includes(s))) {
    // Exclude if it's clearly a baked good (brownies/cookies dominate)
    if (
      !norm.includes("brownie") &&
      !norm.includes("cookie") &&
      !norm.includes("cake")
    ) {
      return "candy_confection";
    }
  }

  return null;
}

/**
 * Pure synchronous heuristic classification. Safe to call in unit tests.
 * Uses homeRecipeAlignment only as advisory input — never as final authority
 * when it would produce a forbidden uncertainty bucket.
 */
export function classifyDishFamilyHeuristic(
  input: DishFamilyClassificationInput
): DishFamilyClassificationResult {
  // 1. Pre-classify by dish name for patterns homeRecipeAlignment misses
  if (input.dishName) {
    const preClassified = preClassifyByDishName(input.dishName);
    if (preClassified) {
      return {
        family: preClassified,
        confidence: 0.75,
        source: "heuristic",
        reasoning: `Pre-classified "${input.dishName}" as ${preClassified} by name pattern.`,
      };
    }
  }

  // 2. Trust currentFamily if it's valid and not a forbidden bucket
  if (
    input.currentFamily &&
    isValidFamily(input.currentFamily) &&
    !FORBIDDEN_UNCERTAINTY_FAMILIES.has(input.currentFamily)
  ) {
    return {
      family: input.currentFamily,
      confidence: 0.85,
      source: "unchanged",
      reasoning: `Current family "${input.currentFamily}" is valid and not a forbidden fallback bucket.`,
    };
  }

  // 3. Use homeRecipeAlignment as advisory — accepts or rejects its output.
  // Cross-check: strip dish name tokens from the full context before running
  // the advisory. This prevents spurious substring matches (e.g. "phon" in
  // "Xzyphon" triggering "pho" → noodle_soup) from polluting the result.
  const fullContext = [input.dishName, input.userMessage, input.conversationContext]
    .filter(Boolean)
    .join(" ");

  // Build a sanitized context with dish name words removed so the advisory
  // cannot be triggered by dish name substrings alone.
  const dishNameTokens = input.dishName
    ? new Set(normalizeText(input.dishName).split(/\s+/).filter((t) => t.length > 1))
    : new Set<string>();

  const sanitizedContext = normalizeText(fullContext)
    .split(/\s+/)
    .filter((token) => !dishNameTokens.has(token))
    .join(" ");

  const advisoryFamily = detectRequestedDishFamily(sanitizedContext);

  if (
    isValidFamily(advisoryFamily) &&
    !FORBIDDEN_UNCERTAINTY_FAMILIES.has(advisoryFamily)
  ) {
    return {
      family: advisoryFamily,
      confidence: 0.7,
      source: "heuristic",
      reasoning: `Advisory heuristic detected family: ${advisoryFamily}.`,
    };
  }

  // 4. Low confidence or forbidden bucket — return null
  return {
    family: null,
    confidence: 0.3,
    source: "null_low_confidence",
    reasoning: advisoryFamily
      ? `Advisory heuristic suggested "${advisoryFamily}" which is a forbidden uncertainty bucket. Returning null.`
      : "No heuristic match found with sufficient confidence.",
  };
}

/**
 * Full classifier — calls AI when heuristic confidence is too low.
 * Pass `{ disableAI: true }` in tests or when no model is available.
 */
export async function classifyDishFamily(
  input: DishFamilyClassificationInput,
  options?: { disableAI?: boolean }
): Promise<DishFamilyClassificationResult> {
  const heuristic = classifyDishFamilyHeuristic(input);

  // High-confidence heuristic — no AI needed
  if (heuristic.confidence >= 0.7) {
    return heuristic;
  }

  // No model or AI disabled
  if (options?.disableAI || !input.taskSettingModel) {
    return heuristic;
  }

  // Escalate to AI
  try {
    const messages: AIMessage[] = [
      {
        role: "system",
        content: `You are a dish family classifier for a recipe application.
Given a dish name and context, identify the most specific dish family from the canonical list below.
Return only valid JSON: {"family": string | null, "confidence": number, "reasoning": string}
Rules:
- family must be exactly one of these values, or null: ${DISH_FAMILIES.join(", ")}
- Never return beverage, preserve, sauce_condiment, or pickled_fermented for an uncertain dish — return null instead.
- confidence is a number from 0 to 1.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          dishName: input.dishName,
          userMessage: input.userMessage,
          context: input.conversationContext ?? null,
        }),
      },
    ];

    const result = await callAIForJson(messages, {
      model: input.taskSettingModel,
      fallback_models: [],
      strict_model: false,
      temperature: 0.1,
      max_tokens: 200,
    });

    if (result.parsed && typeof result.parsed === "object") {
      const raw = result.parsed as Record<string, unknown>;
      const rawFamily = raw.family;
      const family: DishFamily | null =
        typeof rawFamily === "string" &&
        isValidFamily(rawFamily) &&
        !FORBIDDEN_UNCERTAINTY_FAMILIES.has(rawFamily)
          ? rawFamily
          : null;
      const confidence =
        typeof raw.confidence === "number"
          ? Math.max(0, Math.min(1, raw.confidence))
          : 0.5;
      const reasoning =
        typeof raw.reasoning === "string" ? raw.reasoning : "AI classification.";

      return { family, confidence, source: "ai", reasoning };
    }
  } catch {
    // AI call failed — fall through to heuristic result
  }

  return heuristic;
}

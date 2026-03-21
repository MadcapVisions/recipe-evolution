import type { BriefFieldState } from "./contracts/cookingBrief";
import type { LockedDirectionRefinement } from "./contracts/lockedDirectionSession";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

const STOP_INGREDIENT_TOKENS = new Set([
  "the protein",
  "protein",
  "dish",
  "recipe",
  "meal",
  "it",
  "this",
  "that",
  "more",
  "less",
  "bit",
  "to go lighter",
  "go lighter",
  "depth of flavor",
]);

function extractDelimitedIngredients(text: string) {
  return text
    .split(/,|\band\b/gi)
    .map((item) =>
      item
        .trim()
        .replace(/^with\s+/i, "")
        .replace(/^(?:chopped|diced|sliced|minced|fresh|extra|more)\s+/i, "")
    )
    .filter((item) => item.length > 0)
    .filter((item) => item.split(/\s+/).length <= 4);
}

function cleanIngredientCandidate(value: string) {
  const cleaned = value
    .trim()
    .replace(/^(?:some|extra|more|a bit of|a little|just)\s+/i, "")
    .replace(/\bplease\b/gi, "")
    .replace(/\b(?:for me|for us)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  const normalized = normalizeText(cleaned);
  if (STOP_INGREDIENT_TOKENS.has(normalized)) {
    return null;
  }

  return cleaned;
}

function normalizeIngredientList(values: string[]) {
  return unique(
    values
      .flatMap((value) => extractDelimitedIngredients(value))
      .map((value) => cleanIngredientCandidate(value))
      .filter((value): value is string => Boolean(value))
  );
}

function extractSwapIngredients(text: string) {
  const normalized = normalizeText(text);
  const required: string[] = [];
  const forbidden: string[] = [];

  for (const match of normalized.matchAll(/\buse\s+([\p{L}][\p{L}\s-]{1,40}?)\s+instead of\s+([\p{L}][\p{L}\s-]{1,40}?)(?=(?:[.!?]|$))/gu)) {
    required.push(match[1] ?? "");
    forbidden.push(match[2] ?? "");
  }

  for (const match of normalized.matchAll(/\bswap\s+(?:the\s+)?(?:protein|meat|main ingredient)?\s*(?:for|to)\s+([\p{L}][\p{L}\s-]{1,40}?)(?=(?:[.!?]|$))/gu)) {
    required.push(match[1] ?? "");
  }

  for (const match of normalized.matchAll(/\bswap\s+([\p{L}][\p{L}\s-]{1,40}?)\s+for\s+([\p{L}][\p{L}\s-]{1,40}?)(?=(?:[.!?]|$))/gu)) {
    forbidden.push(match[1] ?? "");
    required.push(match[2] ?? "");
  }

  return {
    required: normalizeIngredientList(required),
    forbidden: normalizeIngredientList(forbidden),
  };
}

function extractRequiredIngredients(text: string) {
  const normalized = normalizeText(text);
  const matches = Array.from(
    normalized.matchAll(/\b(?:add|include|make sure (?:it|this|the dish|the recipe) has)\s+([\p{L}][\p{L}\s-]{1,60}?)(?=(?:[.!?]|$))/gu)
  );
  const longingMatches = Array.from(
    normalized.matchAll(/\b(?:i(?:'d| would)?\s+love|need|craving)\s+(?:some\s+)?([\p{L}][\p{L}\s-]{1,40}?)(?=(?:[.!?]|$))/gu)
  );
  return normalizeIngredientList([
    ...matches.map((match) => match[1] ?? ""),
    ...longingMatches.map((match) => match[1] ?? ""),
  ]);
}

function extractForbiddenIngredients(text: string) {
  const normalized = normalizeText(text);
  const matches = Array.from(normalized.matchAll(/\b(?:no|without|skip|leave out|remove)\s+([\p{L}][\p{L}\s-]{1,60}?)(?=(?:[.!?]|$))/gu));
  return normalizeIngredientList(matches.map((match) => match[1] ?? ""));
}

function extractPreferredIngredients(text: string) {
  const normalized = normalizeText(text);
  const matches = Array.from(normalized.matchAll(/\b(?:top with|finish with|serve with|garnish with)\s+([\p{L}][\p{L}\s-]{1,60}?)(?=(?:[.!?]|$))/gu));
  const emphasisMatches = Array.from(
    normalized.matchAll(/\b(?:more|extra)\s+([\p{L}][\p{L}\s-]{1,24}?)(?=(?:\s+please|[.!?]|$))/gu)
  );
  return normalizeIngredientList([
    ...matches.map((match) => match[1] ?? ""),
    ...emphasisMatches.map((match) => match[1] ?? ""),
  ]);
}

function extractStyleTags(text: string) {
  const normalized = normalizeText(text);
  const tags = [
    "spicy",
    "bright",
    "crispy",
    "crunchy",
    "creamy",
    "traditional",
    "authentic",
    "quick",
    "weeknight",
    "lighter",
    "richer",
    "heartier",
    "italian",
  ];
  return tags.filter((tag) => new RegExp(`\\b${tag}\\b`, "i").test(normalized));
}

function deriveIngredientsFieldState(input: {
  requiredIngredients: string[];
  preferredIngredients: string[];
  forbiddenIngredients: string[];
}): BriefFieldState {
  return input.requiredIngredients.length > 0 || input.preferredIngredients.length > 0 || input.forbiddenIngredients.length > 0
    ? "inferred"
    : "unknown";
}

function inferConfidence(input: {
  userText: string;
  requiredIngredients: string[];
  preferredIngredients: string[];
  forbiddenIngredients: string[];
  styleTags: string[];
}) {
  const normalized = normalizeText(input.userText);
  if (input.requiredIngredients.length > 0 || input.forbiddenIngredients.length > 0) {
    return 0.88;
  }
  if (input.preferredIngredients.length > 0 || input.styleTags.length > 0) {
    return 0.74;
  }
  if (/\b(make|keep|more|less|better|different|change)\b/.test(normalized)) {
    return 0.42;
  }
  return 0.55;
}

function inferAmbiguityReason(input: {
  confidence: number;
  requiredIngredients: string[];
  preferredIngredients: string[];
  forbiddenIngredients: string[];
  styleTags: string[];
  userText: string;
}) {
  if (input.confidence >= 0.7) {
    return null;
  }
  if (
    input.requiredIngredients.length === 0 &&
    input.preferredIngredients.length === 0 &&
    input.forbiddenIngredients.length === 0 &&
    input.styleTags.length === 0
  ) {
    return "Refinement was too vague to convert into structured constraints.";
  }
  if (/\binstead\b/.test(normalizeText(input.userText))) {
    return "Refinement suggests a swap, but the replacement target was not explicit enough.";
  }
  return "Refinement was only partially structured.";
}

export function extractRefinementDelta(input: {
  userText: string;
  assistantText: string | null;
}): LockedDirectionRefinement {
  const combined = `${input.userText} ${input.assistantText ?? ""}`;
  const swapIngredients = extractSwapIngredients(input.userText);
  const requiredIngredients = unique([
    ...swapIngredients.required,
    ...extractRequiredIngredients(input.userText),
  ]);
  const preferredIngredients = unique(extractPreferredIngredients(combined));
  const forbiddenIngredients = unique([
    ...swapIngredients.forbidden,
    ...extractForbiddenIngredients(input.userText),
  ]);
  const styleTags = unique(
    extractStyleTags(combined).map((tag) => (tag === "authentic" ? "traditional" : tag === "heartier" ? "richer" : tag))
  );
  const confidence = inferConfidence({
    userText: input.userText,
    requiredIngredients,
    preferredIngredients,
    forbiddenIngredients,
    styleTags,
  });

  return {
    user_text: input.userText.trim(),
    assistant_text: input.assistantText?.trim() || null,
    confidence,
    ambiguity_reason: inferAmbiguityReason({
      confidence,
      requiredIngredients,
      preferredIngredients,
      forbiddenIngredients,
      styleTags,
      userText: input.userText,
    }),
    extracted_changes: {
      required_ingredients: requiredIngredients,
      preferred_ingredients: preferredIngredients,
      forbidden_ingredients: forbiddenIngredients,
      style_tags: styleTags,
      notes: unique([input.userText.trim()]),
    },
    field_state: {
      ingredients: deriveIngredientsFieldState({
        requiredIngredients,
        preferredIngredients,
        forbiddenIngredients,
      }),
      style: styleTags.length > 0 ? "inferred" : "unknown",
      notes: input.userText.trim().length > 0 ? "locked" : "unknown",
    },
  };
}

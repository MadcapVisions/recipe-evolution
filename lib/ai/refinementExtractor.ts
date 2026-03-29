import type { BriefFieldState } from "./contracts/cookingBrief";
import type { LockedDirectionRefinement } from "./contracts/lockedDirectionSession";
import type { ResolvedIngredientIntent } from "./ingredientResolutionTypes";
import type { IngredientConstraintProvenance } from "./requiredNamedIngredient";
import { buildDistilledIngredientIntent } from "./ingredientCanonicalization";
import { isQuestionLikeIngredientCandidate } from "./ingredientConstraintGuard";
import { parseIngredientPhrase } from "./ingredientParsing";
import { resolveIngredientPhrase } from "./ingredientResolver";
import { isHardConstraintConfident, isSoftPreferenceConfident } from "./ingredientResolutionPolicy";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

function uniqueProvenance(values: IngredientConstraintProvenance[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = [
      value.phrase.toLowerCase(),
      value.sourceType,
      value.sourceRole ?? "",
      value.sourceText ?? "",
      value.sourceStart ?? "",
      value.sourceEnd ?? "",
      value.extractionMethod ?? "",
    ].join("::");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findPhraseSpan(text: string | null, phrase: string) {
  if (!text || !phrase) {
    return null;
  }

  const directMatch = new RegExp(escapeRegExp(phrase), "iu").exec(text);
  if (directMatch && typeof directMatch.index === "number") {
    const start = directMatch.index;
    const end = start + directMatch[0].length;
    return {
      start,
      end,
      sourceText: text.slice(start, end),
      sourceSnippet: text.slice(Math.max(0, start - 24), Math.min(text.length, end + 24)).trim(),
    };
  }

  const normalizedIndex = normalizeText(text).indexOf(normalizeText(phrase));
  if (normalizedIndex < 0) {
    return null;
  }

  const end = Math.min(text.length, normalizedIndex + phrase.length);
  return {
    start: normalizedIndex,
    end,
    sourceText: text.slice(normalizedIndex, end) || phrase,
    sourceSnippet: text.slice(Math.max(0, normalizedIndex - 24), Math.min(text.length, end + 24)).trim(),
  };
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
  if (isQuestionLikeIngredientCandidate(value)) {
    return null;
  }

  const cleaned = parseIngredientPhrase(value);
  if (!cleaned) {
    return null;
  }

  if (isQuestionLikeIngredientCandidate(cleaned)) {
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

function extractDirectIngredientFragment(text: string) {
  const normalized = normalizeText(text);
  const acknowledgementPrefix = /^(?:(?:ok|okay|sure|yeah|yep|yes|sounds good|that works)[,\s]+)+/u;
  const withoutAcknowledgement = normalized.replace(acknowledgementPrefix, "").trim();

  if (!/^(?:(?:ok|okay|sure|yeah|yep|yes|sounds good|that works)[,\s]+)?[\p{L}][\p{L}\s,-]{1,40}$/u.test(normalized)) {
    return [];
  }

  if (
    /^(?:i\b|we\b|make\b|can\b|could\b|would\b|use\b|using\b|want\b|need\b|include\b|add\b|how\b|what\b|let\b|please\b)/u.test(
      withoutAcknowledgement
    )
  ) {
    return [];
  }

  const candidate = cleanIngredientCandidate(text);
  return candidate ? [candidate] : [];
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
    normalized.matchAll(
      /\b(?:add|include|make sure (?:it|this|the dish|the recipe) has)\s+([\p{L}][\p{L}\s-]{1,60}?)(?=(?:\s+and\s+(?:skip|leave out|remove|without|no)\b|[.!?,]|$))/gu
    )
  );
  const longingMatches = Array.from(
    normalized.matchAll(/\b(?:i(?:'d| would)?\s+love|need|craving)\s+(?:some\s+)?([\p{L}][\p{L}\s-]{1,40}?)(?=(?:[.!?,]|$))/gu)
  );
  const howAboutMatches = Array.from(
    normalized.matchAll(/\b(?:how about|what about)\s+(?:some\s+|a\s+)?([\p{L}][\p{L}\s-]{1,60}?)(?=(?:[.!?,]|$))/gu)
  );
  const useMatches = Array.from(
    normalized.matchAll(/\buse (?:some |up (?:some |the |my )?|a bit of |a little |the |my )?([\p{L}][\p{L}\s-]{1,40}?)(?=\s+(?:in|for|to|when|if|as|with|and|or|while|into|over|at)\b|[.,!?]|$)/gu)
  );
  const usingMatches = Array.from(
    normalized.matchAll(/\busing (?:some |the |my )?([\p{L}][\p{L}\s-]{1,40}?)(?=\s+(?:in|for|to|when|if|as|with|and|or|while|into|over|at)\b|[.,!?]|$)/gu)
  );
  const wantToUseMatches = Array.from(
    normalized.matchAll(/\bwant(?:ing)? to use (?:some |the |my )?([\p{L}][\p{L}\s-]{1,40}?)(?=\s+(?:in|for|to|when|if|as|with|and|or|while|into|over|at)\b|[.,!?]|$)/gu)
  );
  return normalizeIngredientList([
    ...matches.map((match) => match[1] ?? ""),
    ...longingMatches.map((match) => match[1] ?? ""),
    ...howAboutMatches.map((match) => match[1] ?? ""),
    ...useMatches.map((match) => match[1] ?? ""),
    ...usingMatches.map((match) => match[1] ?? ""),
    ...wantToUseMatches.map((match) => match[1] ?? ""),
    ...extractDirectIngredientFragment(text),
  ]);
}

function extractForbiddenIngredients(text: string) {
  const normalized = normalizeText(text);
  const matches = Array.from(
    normalized.matchAll(
      /\b(?:no|without|skip|leave out|remove)\s+([\p{L}][\p{L}\s-]{1,60}?)(?=(?:\s*(?:,|\band\b)\s+(?:no|without|skip|leave out|remove)\b|[.!?,]|$))/gu
    )
  );
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

function buildResolvedIngredientIntents(phrases: string[]): ResolvedIngredientIntent[] {
  return phrases
    .map((phrase) => {
      const resolved = resolveIngredientPhrase(phrase);
      return {
        raw_phrase: phrase,
        label: resolved.display_label ?? resolved.core_phrase ?? phrase,
        canonical_key: resolved.canonical_key,
        canonical_id: resolved.canonical_id,
        family_key: resolved.family_key,
        confidence: resolved.confidence,
        resolution_method: resolved.resolution_method,
      } satisfies ResolvedIngredientIntent;
    })
    .filter((intent) => isHardConstraintConfident(intent.confidence) || isSoftPreferenceConfident(intent.confidence));
}

function buildAmbiguousNoteFromLowConfidence(phrases: string[]): string[] {
  return phrases
    .map((phrase) => {
      const resolved = resolveIngredientPhrase(phrase);
      if (resolved.confidence < 0.75) {
        const method = resolved.resolution_method;
        const candidate = resolved.display_label ?? resolved.core_phrase ?? phrase;
        return `low-confidence ingredient: "${phrase}" → "${candidate}" (${method}, confidence ${resolved.confidence.toFixed(2)})`;
      }
      return null;
    })
    .filter((note): note is string => note !== null);
}

function buildIngredientProvenance(params: {
  phrases: string[];
  userText: string;
  assistantText: string | null;
  extractionMethod: string;
  allowAssistant?: boolean;
}): IngredientConstraintProvenance[] {
  return uniqueProvenance(
    params.phrases.map((phrase) => {
      const userSpan = findPhraseSpan(params.userText, phrase);
      const assistantSpan = findPhraseSpan(params.assistantText, phrase);

      if (userSpan) {
        return {
          phrase,
          sourceType: "user_message",
          sourceRole: "user",
          sourceText: userSpan.sourceText,
          sourceStart: userSpan.start,
          sourceEnd: userSpan.end,
          sourceSnippet: userSpan.sourceSnippet,
          extractionMethod: params.extractionMethod,
        } satisfies IngredientConstraintProvenance;
      }

      if (params.allowAssistant && params.assistantText && assistantSpan) {
        return {
          phrase,
          sourceType: "assistant_text",
          sourceRole: "assistant",
          sourceText: assistantSpan.sourceText,
          sourceStart: assistantSpan.start,
          sourceEnd: assistantSpan.end,
          sourceSnippet: assistantSpan.sourceSnippet,
          extractionMethod: params.extractionMethod,
        } satisfies IngredientConstraintProvenance;
      }

      return {
        phrase,
        sourceType: "unknown",
        sourceRole: null,
        sourceText: phrase,
        sourceStart: null,
        sourceEnd: null,
        sourceSnippet: phrase,
        extractionMethod: params.extractionMethod,
      } satisfies IngredientConstraintProvenance;
    })
  );
}

function sanitizeLowConfidenceRefinement(refinement: LockedDirectionRefinement): LockedDirectionRefinement {
  if (refinement.confidence >= 0.7) {
    return refinement;
  }

  return {
    ...refinement,
    ambiguous_notes: unique([
      ...(refinement.ambiguous_notes ?? []),
      refinement.user_text,
      ...(refinement.assistant_text ? [refinement.assistant_text] : []),
    ]),
    extracted_changes: {
      ...refinement.extracted_changes,
      required_ingredients: [],
      preferred_ingredients: [],
      forbidden_ingredients: [],
      style_tags: [],
      ingredient_provenance: {
        required: [],
        preferred: [],
        forbidden: [],
      },
    },
    resolved_ingredient_intents: {
      required: [],
      preferred: [],
      forbidden: [],
    },
    field_state: {
      ...refinement.field_state,
      ingredients: "unknown",
      style: "unknown",
    },
  };
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

  // Resolve each extracted phrase and collect ambiguous notes for low-confidence ones
  const resolvedRequired = buildResolvedIngredientIntents(requiredIngredients);
  const resolvedPreferred = buildResolvedIngredientIntents(preferredIngredients);
  const resolvedForbidden = buildResolvedIngredientIntents(forbiddenIngredients);
  const lowConfidenceNotes = [
    ...buildAmbiguousNoteFromLowConfidence(requiredIngredients),
    ...buildAmbiguousNoteFromLowConfidence(preferredIngredients),
    ...buildAmbiguousNoteFromLowConfidence(forbiddenIngredients),
  ];

  return sanitizeLowConfidenceRefinement({
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
    ambiguous_notes: lowConfidenceNotes,
    distilled_intents: {
      ingredient_additions: requiredIngredients
        .map((value) => buildDistilledIngredientIntent(value))
        .filter((value): value is NonNullable<LockedDirectionRefinement["distilled_intents"]>["ingredient_additions"][number] => Boolean(value)),
      ingredient_preferences: preferredIngredients
        .map((value) => buildDistilledIngredientIntent(value))
        .filter((value): value is NonNullable<LockedDirectionRefinement["distilled_intents"]>["ingredient_preferences"][number] => Boolean(value)),
      ingredient_removals: forbiddenIngredients
        .map((value) => buildDistilledIngredientIntent(value))
        .filter((value): value is NonNullable<LockedDirectionRefinement["distilled_intents"]>["ingredient_removals"][number] => Boolean(value)),
    },
    resolved_ingredient_intents: {
      required: resolvedRequired,
      preferred: resolvedPreferred,
      forbidden: resolvedForbidden,
    },
    extracted_changes: {
      required_ingredients: requiredIngredients,
      preferred_ingredients: preferredIngredients,
      forbidden_ingredients: forbiddenIngredients,
      style_tags: styleTags,
      notes: unique([input.userText.trim()]),
      ingredient_provenance: {
        required: buildIngredientProvenance({
          phrases: requiredIngredients,
          userText: input.userText,
          assistantText: input.assistantText,
          extractionMethod: "refinement_required",
        }),
        preferred: buildIngredientProvenance({
          phrases: preferredIngredients,
          userText: input.userText,
          assistantText: input.assistantText,
          extractionMethod: "refinement_preferred",
          allowAssistant: true,
        }),
        forbidden: buildIngredientProvenance({
          phrases: forbiddenIngredients,
          userText: input.userText,
          assistantText: input.assistantText,
          extractionMethod: "refinement_forbidden",
        }),
      },
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
  });
}

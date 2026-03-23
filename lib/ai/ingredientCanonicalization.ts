import { resolveIngredientPhrase } from "./ingredientResolver";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const LEADING_FILLER_PATTERN =
  /^(?:some|extra|more|a bit of|a little|just|maybe|perhaps|can we add|can we use|lets add|let's add|add|include)\s+/i;

const TRAILING_CONTEXT_PATTERN =
  /\b(?:to|for|in|into|on)\s+(?:this|it|that|there|here|the dish|the recipe|the pasta|the tacos|the sauce)\b.*$/i;

const TRAILING_POLITE_PATTERN =
  /\b(?:please|if you can|if possible|or whatever)\b.*$/i;

const TOKEN_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "fresh",
  "extra",
  "into",
  "in",
  "it",
  "of",
  "on",
  "or",
  "some",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

const INVALID_FULL_PHRASES = new Set([
  "something",
  "something creamy",
  "something spicy",
  "anything",
  "anything else",
  "make it",
  "make it nice",
  "make it spicy",
  "keep it spicy",
  "spicy",
  "bright",
  "crispy",
  "crunchy",
  "creamy",
  "lighter",
  "richer",
  "traditional",
  "more flavor",
  "more depth of flavor",
  "depth of flavor",
]);

type CanonicalIngredientEntry = {
  canonical_key: string;
  canonical_label: string;
  aliases: string[];
};

const CANONICAL_INGREDIENT_REGISTRY: CanonicalIngredientEntry[] = [
  {
    canonical_key: "white_bean",
    canonical_label: "white beans",
    aliases: ["white bean", "white beans", "cannellini bean", "cannellini beans", "great northern bean", "great northern beans"],
  },
  {
    canonical_key: "garbanzo_bean",
    canonical_label: "chickpeas",
    aliases: ["garbanzo bean", "garbanzo beans", "chickpea", "chickpeas"],
  },
  {
    canonical_key: "scallion",
    canonical_label: "scallions",
    aliases: ["scallion", "scallions", "green onion", "green onions", "spring onion", "spring onions"],
  },
  {
    canonical_key: "bell_pepper",
    canonical_label: "bell peppers",
    aliases: ["bell pepper", "bell peppers", "sweet pepper", "sweet peppers"],
  },
  {
    canonical_key: "cilantro",
    canonical_label: "cilantro",
    aliases: ["cilantro", "coriander leaves"],
  },
];

function singularizeToken(token: string) {
  if (token.length > 4 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.length > 4 && token.endsWith("es")) {
    return token.slice(0, -2);
  }
  if (token.length > 3 && token.endsWith("s")) {
    return token.slice(0, -1);
  }
  return token;
}

function normalizeLookupText(value: string) {
  return normalizeWhitespace(value.toLowerCase().replace(/[^\p{L}\p{N}\s-]+/gu, " "));
}

function normalizeAlias(value: string) {
  return normalizeLookupText(value)
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => singularizeToken(token))
    .join(" ");
}

const CANONICAL_ALIAS_LOOKUP = new Map(
  CANONICAL_INGREDIENT_REGISTRY.flatMap((entry) =>
    entry.aliases.map((alias) => [
      normalizeAlias(alias),
      { canonical_key: entry.canonical_key, canonical_label: entry.canonical_label },
    ] as const)
  )
);

export function normalizeIngredientPhrase(value: string): string | null {
  // Delegate to the new resolver for authoritative canonical label.
  // The resolver applies comprehensive parsing (quantities, units, prep words, filler)
  // and returns the canonical display label when resolved with sufficient confidence.
  const resolved = resolveIngredientPhrase(value);
  if (resolved.resolution_method !== "unresolved" && resolved.display_label && resolved.confidence >= 0.75) {
    return resolved.display_label;
  }

  // Fallback: legacy cleaning for unresolved phrases, preserving existing behavior.
  const cleaned = normalizeWhitespace(
    value
      .replace(LEADING_FILLER_PATTERN, "")
      .replace(/\b(?:for me|for us)\b/gi, "")
      .replace(TRAILING_CONTEXT_PATTERN, "")
      .replace(TRAILING_POLITE_PATTERN, "")
      .replace(/[.?!,;:]+$/g, "")
  );

  if (!cleaned) {
    return null;
  }

  const lowered = cleaned.toLowerCase();
  if (/^(?:make|keep)\s+it\b/.test(lowered)) {
    return null;
  }
  if (INVALID_FULL_PHRASES.has(lowered)) {
    return null;
  }

  // Try the legacy small registry as last resort before returning raw cleaned text
  const legacyResolved = resolveCanonicalIngredient(cleaned);
  return legacyResolved?.canonical_label ?? lowered;
}

export function resolveCanonicalIngredient(value: string) {
  const normalized = normalizeLookupText(value);
  if (!normalized) {
    return null;
  }

  const direct = CANONICAL_ALIAS_LOOKUP.get(normalizeAlias(normalized));
  if (direct) {
    return direct;
  }

  return null;
}

export function ingredientMatchTokens(value: string): string[] {
  const resolved = resolveCanonicalIngredient(value);
  if (resolved) {
    return resolved.canonical_key.split("_");
  }

  const normalized = normalizeIngredientPhrase(value);
  if (!normalized) {
    return [];
  }

  return normalizeWhitespace(normalized)
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9-]/gi, ""))
    .filter((token) => token.length > 0)
    .filter((token) => !TOKEN_STOP_WORDS.has(token))
    .map((token) => singularizeToken(token))
    .filter((token) => token.length > 1);
}

export function ingredientPhraseMatches(requiredIngredient: string, candidateIngredient: string) {
  // Fast path: token overlap (existing behavior preserved for callers that haven't migrated)
  const requiredTokens = ingredientMatchTokens(requiredIngredient);
  if (requiredTokens.length === 0) {
    return false;
  }

  const candidateTokens = new Set(ingredientMatchTokens(candidateIngredient));
  return requiredTokens.every((token) => candidateTokens.has(token));
}

export function ingredientCanonicalKey(value: string): string | null {
  const resolved = resolveIngredientPhrase(value);
  if (resolved.canonical_key) {
    return resolved.canonical_key;
  }

  const legacyResolved = resolveCanonicalIngredient(value);
  if (legacyResolved) {
    return legacyResolved.canonical_key;
  }

  const tokens = ingredientMatchTokens(value);
  return tokens.length > 0 ? tokens.join("_") : null;
}

export function buildDistilledIngredientIntent(value: string) {
  const label = normalizeIngredientPhrase(value);
  const canonicalKey = label ? ingredientCanonicalKey(label) : null;
  if (!label || !canonicalKey) {
    return null;
  }

  return {
    label,
    canonical_key: canonicalKey,
  };
}

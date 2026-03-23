import type { ResolvedIngredient, IngredientCatalogEntry } from "./ingredientResolutionTypes";
import { parseIngredientPhrase } from "./ingredientParsing";
import {
  ALIAS_TO_ENTRY,
  INGREDIENT_CATALOG,
  INGREDIENT_FAMILIES,
  normalizeAliasKey,
} from "./ingredientCatalog";

// ---- Internal helpers ----

function singularizeToken(token: string): string {
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

function phraseTokens(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter((t) => t.length > 0)
    .map(singularizeToken);
}

function entryToResult(
  raw_phrase: string,
  core_phrase: string,
  entry: IngredientCatalogEntry,
  confidence: number,
  resolution_method: ResolvedIngredient["resolution_method"],
  aliases_matched: string[]
): ResolvedIngredient {
  return {
    raw_phrase,
    core_phrase,
    display_label: entry.display_label,
    canonical_id: entry.canonical_id,
    canonical_key: entry.canonical_key,
    family_id: entry.family_id,
    family_key: entry.family_key,
    aliases_matched,
    confidence,
    resolution_method,
  };
}

function unresolvedResult(raw_phrase: string, core_phrase: string | null): ResolvedIngredient {
  return {
    raw_phrase,
    core_phrase,
    display_label: null,
    canonical_id: null,
    canonical_key: null,
    family_id: null,
    family_key: null,
    aliases_matched: [],
    confidence: 0.3,
    resolution_method: "unresolved",
  };
}

// ---- Resolution steps (run in order) ----

/** Step 1: Exact lowercase match against the alias index. */
function exactAliasMatch(core_phrase: string): { entry: IngredientCatalogEntry; alias: string } | null {
  const entry = ALIAS_TO_ENTRY.get(core_phrase);
  if (!entry) {
    return null;
  }
  // Check blockers — e.g. "basil" entry blocks on "thai basil"
  if (entry.blockers?.some((b) => core_phrase.includes(b.toLowerCase()))) {
    return null;
  }
  return { entry, alias: core_phrase };
}

/** Step 2: Normalized alias match (singularize tokens then lookup). */
function normalizedAliasMatch(core_phrase: string): { entry: IngredientCatalogEntry; alias: string } | null {
  const normalized = normalizeAliasKey(core_phrase);
  if (normalized === core_phrase) {
    return null; // Already tried this in exactAliasMatch
  }
  const entry = ALIAS_TO_ENTRY.get(normalized);
  if (!entry) {
    return null;
  }
  if (entry.blockers?.some((b) => core_phrase.includes(b.toLowerCase()))) {
    return null;
  }
  return { entry, alias: normalized };
}

/** Step 3: Fuzzy alias match using token subset coverage. */
function fuzzyAliasMatch(
  core_phrase: string
): { entry: IngredientCatalogEntry; alias: string; confidence: number } | null {
  const phraseTokenSet = new Set(phraseTokens(core_phrase));
  if (phraseTokenSet.size === 0) {
    return null;
  }

  let bestEntry: IngredientCatalogEntry | null = null;
  let bestAlias = "";
  let bestScore = 0;

  for (const entry of INGREDIENT_CATALOG) {
    // Skip entries where the core_phrase matches a blocker
    if (entry.blockers?.some((b) => core_phrase.includes(b.toLowerCase()))) {
      continue;
    }

    for (const alias of entry.aliases) {
      const aliasTokens = phraseTokens(alias);
      if (aliasTokens.length === 0) {
        continue;
      }
      // A single-token phrase (e.g. "breasts") must not fuzzy-match a multi-token alias
      // (e.g. "chicken breast"). Only exact/normalized alias lookup handles single tokens.
      if (phraseTokenSet.size === 1 && aliasTokens.length > 1) {
        continue;
      }
      const aliasTokenSet = new Set(aliasTokens);

      // Case A: all phrase tokens appear in this alias
      const phraseInAlias = [...phraseTokenSet].every((t) => aliasTokenSet.has(t));
      if (phraseInAlias) {
        // Coverage = how much of the alias is accounted for by the phrase
        const coverage = phraseTokenSet.size / aliasTokenSet.size;
        // Full coverage (phrase == alias tokens) would have been caught by normalized match; this is partial
        const score = 0.70 + 0.22 * coverage;
        if (score > bestScore) {
          bestScore = score;
          bestEntry = entry;
          bestAlias = alias;
        }
      }

      // Case B: all alias tokens appear in the phrase (alias is a subset of the phrase)
      const aliasInPhrase = aliasTokens.every((t) => phraseTokenSet.has(t));
      if (aliasInPhrase && !phraseInAlias) {
        const coverage = aliasTokens.length / phraseTokenSet.size;
        const score = 0.70 + 0.22 * coverage;
        if (score > bestScore) {
          bestScore = score;
          bestEntry = entry;
          bestAlias = alias;
        }
      }
    }
  }

  if (bestEntry && bestScore >= 0.72) {
    return { entry: bestEntry, alias: bestAlias, confidence: Math.min(bestScore, 0.92) };
  }

  return null;
}

/** Step 4: Family inference — if any token is a known family key. */
function familyInferenceMatch(core_phrase: string): { family_key: string; family_id: string } | null {
  const tokens = phraseTokens(core_phrase);

  for (const token of tokens) {
    const family = INGREDIENT_FAMILIES[token];
    if (family) {
      return { family_key: token, family_id: family.id };
    }
  }

  // Also check pluralized family keys (e.g. "beans" → "bean")
  for (const token of tokens) {
    const singular = singularizeToken(token);
    if (singular !== token) {
      const family = INGREDIENT_FAMILIES[singular];
      if (family) {
        return { family_key: singular, family_id: family.id };
      }
    }
  }

  return null;
}

// ---- Main export ----

/**
 * Resolve a raw ingredient phrase into a structured canonical entity.
 * Resolution order: parse → exact → normalized → fuzzy → family → unresolved.
 */
export function resolveIngredientPhrase(raw: string): ResolvedIngredient {
  const core_phrase = parseIngredientPhrase(raw);

  if (!core_phrase) {
    return unresolvedResult(raw, null);
  }

  // Step 1: exact alias
  const exact = exactAliasMatch(core_phrase);
  if (exact) {
    return entryToResult(raw, core_phrase, exact.entry, 0.97, "exact_alias", [exact.alias]);
  }

  // Step 2: normalized alias (singularization)
  const normalized = normalizedAliasMatch(core_phrase);
  if (normalized) {
    return entryToResult(raw, core_phrase, normalized.entry, 0.92, "normalized_alias", [normalized.alias]);
  }

  // Step 3: fuzzy alias (token subset)
  const fuzzy = fuzzyAliasMatch(core_phrase);
  if (fuzzy) {
    return entryToResult(raw, core_phrase, fuzzy.entry, fuzzy.confidence, "fuzzy_alias", [fuzzy.alias]);
  }

  // Step 4: family inference
  const family = familyInferenceMatch(core_phrase);
  if (family) {
    return {
      raw_phrase: raw,
      core_phrase,
      display_label: core_phrase, // Use the phrase itself as display when no canonical entry
      canonical_id: null,
      canonical_key: null,
      family_id: family.family_id,
      family_key: family.family_key,
      aliases_matched: [],
      confidence: 0.75,
      resolution_method: "family_inference",
    };
  }

  // Step 5: unresolved — keep the core phrase as the display label
  return {
    ...unresolvedResult(raw, core_phrase),
    display_label: core_phrase,
  };
}

/**
 * Cache-aware resolver for use in hot paths (e.g. verification).
 * Returns a resolver function backed by a per-call Map.
 */
export function createCachedResolver(): (raw: string) => ResolvedIngredient {
  const cache = new Map<string, ResolvedIngredient>();
  return (raw: string) => {
    const existing = cache.get(raw);
    if (existing) {
      return existing;
    }
    const result = resolveIngredientPhrase(raw);
    cache.set(raw, result);
    return result;
  };
}

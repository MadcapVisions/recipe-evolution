import type { ResolvedIngredient, ResolvedIngredientIntent, IngredientMatchPolicy } from "./ingredientResolutionTypes";

// ---- Token-based fallback (preserves legacy behavior for soft/planning policies) ----

function singularizeToken(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

const TOKEN_STOP_WORDS = new Set([
  "a", "an", "and", "for", "fresh", "extra", "into", "in", "it",
  "of", "on", "or", "some", "that", "the", "this", "to", "with",
]);

function matchTokens(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9-]/g, ""))
    .filter((t) => t.length > 0 && !TOKEN_STOP_WORDS.has(t))
    .map(singularizeToken)
    .filter((t) => t.length > 1);
}

function tokenOverlapMatch(required: string | null, candidate: string | null): boolean {
  if (!required || !candidate) return false;
  const requiredTokens = matchTokens(required);
  if (requiredTokens.length === 0) return false;
  const candidateTokenSet = new Set(matchTokens(candidate));
  return requiredTokens.every((t) => candidateTokenSet.has(t));
}

// ---- Policy implementations ----

/**
 * Compare two resolved ingredients under the given policy.
 *
 * strict_canonical:
 *   canonical_id equality only; no family fallback; never match unresolved.
 *
 * canonical_with_family_fallback:
 *   canonical_id equality, OR same family_key when both are resolved at family level.
 *
 * soft_preference:
 *   canonical_id equality, OR family_key equality, OR token-overlap as last resort.
 *
 * planning:
 *   family_key equality, OR token-overlap.
 */
export function ingredientsMatch(
  required: ResolvedIngredient,
  candidate: ResolvedIngredient,
  policy: IngredientMatchPolicy
): boolean {
  switch (policy) {
    case "strict_canonical": {
      if (!required.canonical_id || !candidate.canonical_id) return false;
      return required.canonical_id === candidate.canonical_id;
    }

    case "canonical_with_family_fallback": {
      // Constraint has a specific canonical — only canonical_id equality satisfies it
      if (required.canonical_id) {
        return required.canonical_id === candidate.canonical_id;
      }
      // Constraint is family-level (e.g. user said "a bean" or "some mushroom") — any member of
      // that family satisfies it
      if (required.resolution_method === "family_inference" && required.family_key && candidate.family_key) {
        return required.family_key === candidate.family_key;
      }
      return false;
    }

    case "soft_preference": {
      if (required.canonical_id && candidate.canonical_id && required.canonical_id === candidate.canonical_id) {
        return true;
      }
      if (required.family_key && candidate.family_key && required.family_key === candidate.family_key) {
        return true;
      }
      return tokenOverlapMatch(required.core_phrase ?? required.display_label, candidate.core_phrase ?? candidate.display_label);
    }

    case "planning": {
      if (required.family_key && candidate.family_key && required.family_key === candidate.family_key) {
        return true;
      }
      return tokenOverlapMatch(required.core_phrase ?? required.display_label, candidate.core_phrase ?? candidate.display_label);
    }
  }
}

/**
 * Check whether a candidate resolved ingredient satisfies a constraint (expressed as a ResolvedIngredientIntent).
 */
export function ingredientSatisfiesConstraint(
  constraint: ResolvedIngredientIntent,
  candidate: ResolvedIngredient,
  policy: IngredientMatchPolicy
): boolean {
  // Build a minimal ResolvedIngredient from the intent for comparison
  const constraintResolved: ResolvedIngredient = {
    raw_phrase: constraint.raw_phrase,
    core_phrase: constraint.label,
    display_label: constraint.label,
    canonical_id: constraint.canonical_id,
    canonical_key: constraint.canonical_key,
    family_id: null,
    family_key: constraint.family_key,
    aliases_matched: [],
    confidence: constraint.confidence,
    resolution_method: constraint.resolution_method,
  };
  return ingredientsMatch(constraintResolved, candidate, policy);
}

/**
 * Legacy string-based ingredient matching for backward compatibility.
 * Used when resolved forms are not available.
 */
export function ingredientPhraseMatchesLegacy(requiredPhrase: string, candidatePhrase: string): boolean {
  return tokenOverlapMatch(requiredPhrase, candidatePhrase);
}

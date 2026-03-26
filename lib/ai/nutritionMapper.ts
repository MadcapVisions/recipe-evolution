/**
 * Nutrition mapper
 *
 * Matches an ingredient name to its closest catalog entry using
 * token-based similarity. Designed to be conservative: returns
 * a low-confidence result rather than a bad match.
 */

import { NUTRITION_CATALOG } from "./nutritionCatalog";
import type { NutritionCatalogEntry } from "./nutritionTypes";

// ── Text normalization ───────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/-/g, " ")          // "all-purpose" → "all purpose"
    .replace(/[^a-z0-9\s]/g, "") // strip punctuation
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

// ── Stop words to ignore when scoring ───────────────────────────────────────

const STOP_WORDS = new Set([
  "fresh", "dried", "cooked", "raw", "canned", "frozen", "organic",
  "large", "small", "medium", "chopped", "sliced", "diced", "minced",
  "peeled", "boneless", "skinless", "plain", "unsalted", "salted",
  "low", "fat", "full", "light", "reduced", "sodium",
]);

function contentTokens(tokens: string[]): string[] {
  return tokens.filter((t) => !STOP_WORDS.has(t) && t.length > 1);
}

// ── Similarity scoring ───────────────────────────────────────────────────────

function tokenSimilarity(a: string, b: string): number {
  const tokensA = contentTokens(tokenize(a));
  const tokensB = contentTokens(tokenize(b));
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  const matches = tokensA.filter((t) => setB.has(t)).length;
  // Jaccard-like: intersection / union
  const union = new Set([...tokensA, ...tokensB]).size;
  return matches / union;
}

/**
 * Returns true if the normalized form of `candidate` contains
 * the normalized form of `query` as a substring, or vice versa.
 * Catches cases like "whole milk" ↔ "milk".
 */
function substringMatch(query: string, candidate: string): boolean {
  const nq = normalize(query);
  const nc = normalize(candidate);
  return nc.includes(nq) || nq.includes(nc);
}

// ── Main match function ──────────────────────────────────────────────────────

export type NutritionMatchResult = {
  entry: NutritionCatalogEntry | null;
  confidence: number; // 0–1
};

/**
 * Find the best catalog entry for an ingredient name.
 * Returns null entry when no match exceeds the confidence floor.
 */
export function findNutritionMatch(
  ingredientName: string,
  confidenceFloor = 0.3
): NutritionMatchResult {
  const normalizedQuery = normalize(ingredientName);
  let best: NutritionCatalogEntry | null = null;
  let bestScore = 0;

  for (const entry of NUTRITION_CATALOG) {
    // Check against the key, display name, and all aliases
    const candidates = [
      entry.key.replace(/_/g, " "),
      entry.displayName,
      ...entry.aliases,
    ];

    for (const candidate of candidates) {
      // Exact normalized match → perfect score
      if (normalize(candidate) === normalizedQuery) {
        return { entry, confidence: 1.0 };
      }

      // Token similarity
      let score = tokenSimilarity(ingredientName, candidate);

      // Boost for substring containment
      if (score < 0.8 && substringMatch(ingredientName, candidate)) {
        score = Math.max(score, 0.7);
      }

      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
  }

  if (bestScore < confidenceFloor) {
    return { entry: null, confidence: bestScore };
  }

  return { entry: best, confidence: bestScore };
}

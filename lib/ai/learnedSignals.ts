import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyDecay,
  getOverallConfidenceLevel,
  type TasteModel,
  type TasteScore,
} from "@/lib/ai/tasteModel";

// ── Public types ──────────────────────────────────────────────────────────────

export type LearnedPattern = {
  /** Machine-readable key — stable across deploys, used by consumers for filtering */
  key: string;
  /** Human-readable label — safe to show users when personalization is visible */
  label: string;
  confidence: "low" | "medium" | "high";
  direction: "positive" | "negative";
};

export type LearnedSignals = {
  patterns: LearnedPattern[];
  overallConfidence: "low" | "medium" | "high";
  generatedAt: string;
};

// ── Freshness model: in-process TTL cache with explicit invalidation ──────────
//
// Delivery model: cached-summary-with-invalidation (same pattern as user_taste_profiles).
// TTL: 5 minutes. Invalidated explicitly when postcook feedback updates taste scores.
// Cross-isolate consistency: eventual (max 5 min staleness) — same tradeoff as taste profiles.

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { signals: LearnedSignals; cachedAt: number }>();

/** Call after updating user_taste_scores to keep the signal cache fresh. */
export function invalidateLearnedSignalsCache(ownerId: string): void {
  cache.delete(ownerId);
}

/**
 * Get learned patterns for a user.
 * Reads from user_taste_scores, applies lazy decay, derives patterns, and caches.
 * Returns empty patterns gracefully for new users with no cook history.
 */
export async function getLearnedSignals(
  supabase: SupabaseClient,
  ownerId: string
): Promise<LearnedSignals> {
  const cached = cache.get(ownerId);
  if (cached && Date.now() - cached.cachedAt < TTL_MS) {
    return cached.signals;
  }

  const { data: row } = await supabase
    .from("user_taste_scores")
    .select("scores_json, updated_at")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const raw = (row?.scores_json as TasteModel | null) ?? null;
  const daysSince = row?.updated_at
    ? (Date.now() - new Date(row.updated_at as string).getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const model = raw ? applyDecay(raw, daysSince) : null;

  const signals = deriveLearnedPatterns(model);
  cache.set(ownerId, { signals, cachedAt: Date.now() });
  return signals;
}

// ── Pattern derivation (pure — safe to call in tests) ─────────────────────────

const MIN_SCORE = 0.35;
const MIN_CONF = 0.25;

function meets(s: TasteScore | null | undefined, direction: "positive" | "negative"): boolean {
  if (!s || s.confidence < MIN_CONF) return false;
  return direction === "positive" ? s.score >= MIN_SCORE : s.score <= -MIN_SCORE;
}

/**
 * Derive labeled learned patterns from a TasteModel snapshot.
 * Pure function — no I/O. Exported for tests and for summarizeLearnedScores.
 *
 * These are descriptive ranking signals, not hard user facts.
 * Downstream consumers use `key` for filtering and `label` for display.
 */
export function deriveLearnedPatterns(model: TasteModel | null): LearnedSignals {
  const generatedAt = new Date().toISOString();

  if (!model) {
    return { patterns: [], overallConfidence: "low", generatedAt };
  }

  const overallConfidence = getOverallConfidenceLevel(model);
  const patterns: LearnedPattern[] = [];

  function add(key: string, label: string, direction: "positive" | "negative") {
    patterns.push({ key, label, confidence: overallConfidence, direction });
  }

  // Spice tolerance
  if (meets(model.spiceTolerance, "negative")) {
    add("prefers_low_spice", "Tends to prefer lower spice levels", "negative");
  } else if (meets(model.spiceTolerance, "positive")) {
    add("enjoys_spicy", "Tends to enjoy spicier dishes", "positive");
  }

  // Richness preference
  if (meets(model.richnessPreference, "negative")) {
    add("prefers_lighter_dishes", "Often avoids overly heavy dishes", "negative");
  } else if (meets(model.richnessPreference, "positive")) {
    add("enjoys_rich_dishes", "Tends to enjoy richer, creamier dishes", "positive");
  }

  // Complexity tolerance
  if (meets(model.complexityTolerance, "negative")) {
    add("prefers_simpler_recipes", "Repeatedly improves for less complexity", "negative");
  }

  // Flavor intensity
  if (meets(model.flavorIntensityPreference, "positive")) {
    add("prefers_bold_flavors", "Often wants bolder, well-seasoned dishes", "positive");
  } else if (meets(model.flavorIntensityPreference, "negative")) {
    add("prefers_light_seasoning", "Often prefers more restrained seasoning", "negative");
  }

  // Top cuisine preferences (up to 2, positive only)
  const topCuisines = Object.entries(model.cuisines)
    .filter(([, s]) => s.score >= MIN_SCORE && s.confidence >= MIN_CONF)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 2);
  for (const [cuisine] of topCuisines) {
    add(`prefers_${cuisine}`, `Responds well to ${cuisine}-style cooking`, "positive");
  }

  // Top protein preference (up to 1, positive only)
  const topProteins = Object.entries(model.proteins)
    .filter(([, s]) => s.score >= MIN_SCORE && s.confidence >= MIN_CONF)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 1);
  for (const [protein] of topProteins) {
    add(`prefers_${protein}`, `Responds well to ${protein}-based dinners`, "positive");
  }

  return { patterns, overallConfidence, generatedAt };
}

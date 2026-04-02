import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLearnedSignals } from "@/lib/ai/learnedSignals";
import type { LearnedPattern } from "@/lib/ai/learnedSignals";

const PATTERN_SUGGESTIONS: Record<string, string> = {
  prefers_low_spice: "Mild & gentle flavors",
  enjoys_spicy: "Bold & spicy",
  prefers_lighter_dishes: "Light & fresh",
  enjoys_rich_dishes: "Rich & hearty",
  prefers_simpler_recipes: "Quick & simple",
  prefers_bold_flavors: "Big, bold flavors",
  prefers_light_seasoning: "Delicately seasoned",
};

// Keys that are handled by the static map (exclude from dynamic cuisine/protein matching)
const STATIC_SUFFIXES = new Set([
  "low_spice",
  "lighter_dishes",
  "simpler_recipes",
  "bold_flavors",
  "light_seasoning",
]);

/**
 * Maps learned patterns to suggestion chip labels.
 * Pure function — safe to call in tests.
 */
export function mapPatternsToSuggestions(patterns: LearnedPattern[]): string[] {
  const suggestions: string[] = [];

  for (const pattern of patterns) {
    if (suggestions.length >= 5) break;

    // Static lookup first
    if (PATTERN_SUGGESTIONS[pattern.key]) {
      suggestions.push(PATTERN_SUGGESTIONS[pattern.key]!);
      continue;
    }

    // Dynamic cuisine/protein patterns: prefers_italian → "Italian-style"
    if (pattern.key.startsWith("prefers_") && pattern.direction === "positive") {
      const suffix = pattern.key.slice("prefers_".length);
      if (suffix && !STATIC_SUFFIXES.has(suffix)) {
        const capitalized = suffix.charAt(0).toUpperCase() + suffix.slice(1);
        suggestions.push(`${capitalized}-style`);
      }
    }
  }

  return suggestions;
}

/**
 * Fetches learned signals for a user and returns personalized suggestion chip labels.
 * Returns empty array for new users with no cook history (overallConfidence === "low").
 */
export async function buildCreateSuggestions(
  supabase: SupabaseClient,
  ownerId: string
): Promise<string[]> {
  const signals = await getLearnedSignals(supabase, ownerId);
  if (signals.overallConfidence === "low") return [];
  return mapPatternsToSuggestions(signals.patterns);
}

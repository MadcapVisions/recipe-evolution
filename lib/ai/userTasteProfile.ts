import type { SupabaseClient } from "@supabase/supabase-js";
import { getOverallConfidenceLevel, applyDecay, type TasteModel } from "@/lib/ai/tasteModel";

type SupabaseLike = SupabaseClient;

type ExplicitPreferencesRow = {
  preferred_units?: string | null;
  common_diet_tags?: string[] | null;
  disliked_ingredients?: string[] | null;
  cooking_skill_level?: string | null;
  favorite_cuisines?: string[] | null;
  favorite_proteins?: string[] | null;
  preferred_flavors?: string[] | null;
  pantry_staples?: string[] | null;
  spice_tolerance?: string | null;
  health_goals?: string[] | null;
  taste_notes?: string | null;
};

const CUISINE_KEYWORDS = ["italian", "mexican", "asian", "mediterranean", "comfort", "healthy", "seafood", "dessert"];
const PROTEIN_KEYWORDS = ["chicken", "beef", "pork", "fish", "salmon", "shrimp", "tofu", "beans", "eggs", "turkey", "chickpeas"];
const FLAVOR_KEYWORDS = ["spicy", "bright", "creamy", "fresh", "herby", "smoky", "savory", "crispy", "lemon", "lime", "garlic"];

type ProductEventRow = {
  event_name?: string | null;
  metadata_json?: Record<string, unknown> | null;
};

type ConversationTurnRow = {
  message?: string | null;
  scope?: string | null;
  role?: string | null;
};

type RecipeRow = {
  id?: string | number | null;
  title?: string | null;
  tags?: string[] | null;
  is_favorite?: boolean | null;
};

type RecipeVersionRow = {
  recipe_id?: string | null;
  ingredients_json?: Array<{ name?: string }> | null;
};

function normalizeList(values: string[] | null | undefined) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function extractKeywordCounts(values: string[], keywords: string[]) {
  const counts = new Map<string, number>();
  const haystack = values.join(" ").toLowerCase();
  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
    }
  }
  return counts;
}

function topKeywords(counts: Map<string, number>, max = 3) {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([keyword]) => keyword);
}

function summarizeExplicit(preferences: ExplicitPreferencesRow | null) {
  if (!preferences) {
    return "";
  }

  const parts: string[] = [];
  const cuisines = normalizeList(preferences.favorite_cuisines);
  const proteins = normalizeList(preferences.favorite_proteins);
  const flavors = normalizeList(preferences.preferred_flavors);
  const dietTags = normalizeList(preferences.common_diet_tags);
  const pantry = normalizeList(preferences.pantry_staples);
  const healthGoals = normalizeList(preferences.health_goals);
  const dislikes = normalizeList(preferences.disliked_ingredients);

  if (cuisines.length > 0) {
    parts.push(`Prefers ${cuisines.join(", ")} styles.`);
  }
  if (proteins.length > 0) {
    parts.push(`Often wants ${proteins.join(", ")}.`);
  }
  if (flavors.length > 0) {
    parts.push(`Likes ${flavors.join(", ")} flavors.`);
  }
  if (dietTags.length > 0) {
    parts.push(`Diet goals: ${dietTags.join(", ")}.`);
  }
  if (healthGoals.length > 0) {
    parts.push(`Health goals: ${healthGoals.join(", ")}.`);
  }
  if (preferences.spice_tolerance?.trim()) {
    parts.push(`Spice tolerance: ${preferences.spice_tolerance.trim()}.`);
  }
  if (dislikes.length > 0) {
    parts.push(`Avoid ${dislikes.join(", ")}.`);
  }
  if (pantry.length > 0) {
    parts.push(`Common pantry staples include ${pantry.join(", ")}.`);
  }
  if (preferences.cooking_skill_level?.trim()) {
    parts.push(`Cooking skill: ${preferences.cooking_skill_level.trim()}.`);
  }
  if (preferences.taste_notes?.trim()) {
    parts.push(preferences.taste_notes.trim());
  }

  return parts.join(" ");
}

function summarizeInferred(input: { recipeTitles: string[]; recipeTags: string[]; ingredientNames: string[] }) {
  const cuisineCounts = extractKeywordCounts([...input.recipeTitles, ...input.recipeTags], CUISINE_KEYWORDS);
  const proteinCounts = extractKeywordCounts([...input.recipeTitles, ...input.ingredientNames], PROTEIN_KEYWORDS);
  const flavorCounts = extractKeywordCounts([...input.recipeTitles, ...input.ingredientNames], FLAVOR_KEYWORDS);

  const cuisines = topKeywords(cuisineCounts);
  const proteins = topKeywords(proteinCounts);
  const flavors = topKeywords(flavorCounts);

  const parts: string[] = [];
  if (cuisines.length > 0) {
    parts.push(`Recent behavior leans toward ${cuisines.join(", ")} dishes.`);
  }
  if (proteins.length > 0) {
    parts.push(`Frequently chosen ingredients include ${proteins.join(", ")}.`);
  }
  if (flavors.length > 0) {
    parts.push(`Observed taste signals suggest ${flavors.join(", ")} preferences.`);
  }

  return {
    summary: parts.join(" "),
    signals: {
      cuisines,
      proteins,
      flavors,
    },
  };
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStrings(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => collectStrings(item));
  }

  return [];
}

function extractTextFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) {
    return [];
  }

  const keys = [
    "title",
    "description",
    "prompt",
    "instruction",
    "recipeTitle",
    "ideaTitle",
    "selectedIdeaTitle",
    "conversation",
    "versionLabel",
  ] as const;

  const values: string[] = [];

  for (const key of keys) {
    values.push(...collectStrings(metadata[key]));
  }

  return values;
}

function repeatValues(values: string[], count: number) {
  return values.flatMap((value) => Array.from({ length: count }, () => value));
}

/**
 * Derive a human-readable summary from structured learned taste scores.
 * Returns empty string when evidence is too sparse (confidence === "low").
 * Uses hedged language at "medium" confidence, direct language at "high".
 */
export function summarizeLearnedScores(
  model: TasteModel | null,
  confidence: "low" | "medium" | "high"
): string {
  if (!model || confidence === "low") return "";

  const hedged = confidence === "medium";
  const MIN_SCORE = 0.35;
  const MIN_CONF = 0.25;
  const parts: string[] = [];

  if (model.spiceTolerance && model.spiceTolerance.confidence >= MIN_CONF) {
    if (model.spiceTolerance.score <= -MIN_SCORE) {
      parts.push(hedged ? "Tends to prefer lower spice levels." : "Consistently prefers low spice.");
    } else if (model.spiceTolerance.score >= MIN_SCORE) {
      parts.push(hedged ? "Seems to enjoy spicier dishes." : "Consistently enjoys spicy dishes.");
    }
  }

  if (model.richnessPreference && model.richnessPreference.confidence >= MIN_CONF) {
    if (model.richnessPreference.score <= -MIN_SCORE) {
      parts.push(hedged ? "Often finds heavy dishes too much." : "Consistently prefers lighter meals.");
    } else if (model.richnessPreference.score >= MIN_SCORE) {
      parts.push(hedged ? "Seems to enjoy richer, creamier dishes." : "Consistently enjoys rich flavors.");
    }
  }

  if (
    model.complexityTolerance &&
    model.complexityTolerance.confidence >= MIN_CONF &&
    model.complexityTolerance.score <= -MIN_SCORE
  ) {
    parts.push(hedged ? "Tends to prefer simpler recipes." : "Consistently prefers lower-step recipes.");
  }

  if (model.flavorIntensityPreference && model.flavorIntensityPreference.confidence >= MIN_CONF) {
    if (model.flavorIntensityPreference.score >= MIN_SCORE) {
      parts.push(hedged ? "Often wants bolder seasoning." : "Consistently prefers boldly seasoned dishes.");
    } else if (model.flavorIntensityPreference.score <= -MIN_SCORE) {
      parts.push(hedged ? "Often prefers restrained seasoning." : "Consistently prefers lightly seasoned dishes.");
    }
  }

  if (parts.length === 0) return "";
  return "Based on cooking outcomes: " + parts.join(" ");
}

const TASTE_PROFILE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Fast path: return the persisted combined_summary if it was built recently.
// Falls back to a full rebuild (which also refreshes the persisted profile).
export async function getCachedUserTasteSummary(supabase: SupabaseLike, ownerId: string): Promise<string> {
  const { data } = await supabase
    .from("user_taste_profiles")
    .select("combined_summary, updated_at")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (data?.combined_summary) {
    const ageMs = Date.now() - new Date(data.updated_at as string).getTime();
    if (ageMs < TASTE_PROFILE_TTL_MS) {
      return data.combined_summary as string;
    }
  }

  return buildUserTasteSummary(supabase, ownerId);
}

export async function buildUserTasteSummary(supabase: SupabaseLike, ownerId: string): Promise<string> {
  const preferencesQuery = supabase
    .from("user_preferences")
    .select(
      "preferred_units, common_diet_tags, disliked_ingredients, cooking_skill_level, favorite_cuisines, favorite_proteins, preferred_flavors, pantry_staples, spice_tolerance, health_goals, taste_notes"
    )
    .eq("owner_id", ownerId)
    .maybeSingle?.();

  const recipesQuery = supabase
    .from("recipes")
    .select("id, title, tags, is_favorite")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(20);

  const eventsQuery = supabase
    .from("product_events")
    .select("event_name, metadata_json")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(80);
  const conversationQuery = supabase
    .from("ai_conversation_turns")
    .select("message, scope, role")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(80);

  const tasteScoresQuery = supabase
    .from("user_taste_scores")
    .select("scores_json, updated_at")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const [preferencesResult, recipesResult, eventsResult, conversationResult, tasteScoresResult] =
    await Promise.all([
      preferencesQuery ?? Promise.resolve({ data: null, error: null }),
      recipesQuery ?? Promise.resolve({ data: [], error: null }),
      eventsQuery ?? Promise.resolve({ data: [], error: null }),
      conversationQuery ?? Promise.resolve({ data: [], error: null }),
      tasteScoresQuery,
    ]);

  const preferences = (preferencesResult as { data?: ExplicitPreferencesRow | null })?.data ?? null;
  const recipesData = (recipesResult as { data?: unknown[] | null })?.data;
  const recipes: RecipeRow[] = Array.isArray(recipesData) ? (recipesData as RecipeRow[]) : [];
  const eventsData = (eventsResult as { data?: unknown[] | null })?.data;
  const events: ProductEventRow[] = Array.isArray(eventsData) ? (eventsData as ProductEventRow[]) : [];
  const conversationData = (conversationResult as { data?: unknown[] | null })?.data;
  const conversationTurns: ConversationTurnRow[] = Array.isArray(conversationData) ? (conversationData as ConversationTurnRow[]) : [];

  const recipeIds = recipes.map((recipe) => String(recipe?.id ?? "")).filter(Boolean);
  const versionsResult =
    recipeIds.length > 0
      ? await supabase
          .from("recipe_versions")
          .select("ingredients_json, recipe_id")
          .in("recipe_id", recipeIds)
          .order("created_at", { ascending: false })
          .limit(24)
      : { data: [], error: null };
  const versionsData = (versionsResult as { data?: unknown[] | null })?.data;
  const versions: RecipeVersionRow[] = Array.isArray(versionsData) ? (versionsData as RecipeVersionRow[]) : [];

  const favoriteRecipes = recipes.filter((recipe) => recipe?.is_favorite);
  const titlePool = [...repeatValues(favoriteRecipes.map((recipe) => String(recipe?.title ?? "").trim()).filter(Boolean), 2)]
    .concat(recipes.map((recipe) => String(recipe?.title ?? "").trim()).filter(Boolean));
  const tagPool = [...favoriteRecipes, ...recipes]
    .flatMap((recipe) => (Array.isArray(recipe?.tags) ? recipe.tags : []))
    .map((tag: string) => String(tag).trim())
    .filter(Boolean);
  const ingredientPool = versions
    .flatMap((version) => (Array.isArray(version?.ingredients_json) ? version.ingredients_json : []))
    .map((item) => String(item?.name ?? "").trim())
    .filter(Boolean);
  const behaviorTextPool = events.flatMap((event) => {
    const baseTexts = extractTextFromMetadata(event.metadata_json);
    if (event.event_name === "recipe_favorited") {
      return repeatValues(baseTexts, 2);
    }
    if (event.event_name === "recipe_created" || event.event_name === "recipe_improved" || event.event_name === "recipe_remixed") {
      return repeatValues(baseTexts, 2);
    }
    return baseTexts;
  });
  const conversationTextPool = conversationTurns.flatMap((turn) => {
    const message = typeof turn.message === "string" ? turn.message.trim() : "";
    if (!message) {
      return [];
    }
    if (turn.role === "user") {
      return repeatValues([message], 2);
    }
    return [message];
  });

  const explicitSummary = summarizeExplicit(preferences);
  const inferred = summarizeInferred({
    recipeTitles: [...titlePool, ...behaviorTextPool, ...conversationTextPool],
    recipeTags: tagPool,
    ingredientNames: [...ingredientPool, ...behaviorTextPool, ...conversationTextPool],
  });

  const tasteScoresRow = (tasteScoresResult as { data?: { scores_json?: unknown; updated_at?: string } | null })?.data;
  const rawModel = tasteScoresRow?.scores_json as TasteModel | null ?? null;
  const daysSinceScoreUpdate = tasteScoresRow?.updated_at
    ? (Date.now() - new Date(tasteScoresRow.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const tasteModel = rawModel ? applyDecay(rawModel, daysSinceScoreUpdate) : null;
  const tasteConfidence = getOverallConfidenceLevel(tasteModel);
  const learnedSummary = summarizeLearnedScores(tasteModel, tasteConfidence);

  const combinedSummary = [explicitSummary, inferred.summary, learnedSummary].filter(Boolean).join(" ");

  if (combinedSummary) {
    void (async () => {
      const { error } = await supabase
        .from("user_taste_profiles")
        .upsert(
          {
            owner_id: ownerId,
            explicit_summary: explicitSummary || null,
            inferred_summary: inferred.summary || null,
            combined_summary: combinedSummary,
            inferred_signals_json: inferred.signals,
          },
          { onConflict: "owner_id" }
        );
      if (error) console.warn("Failed to update user taste profile", error.message);
    })();
  }

  return combinedSummary;
}

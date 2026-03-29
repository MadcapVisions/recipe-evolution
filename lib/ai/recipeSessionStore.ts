import type { SupabaseClient } from "@supabase/supabase-js";
import { compileCookingBrief } from "./briefCompiler";
import { createEmptyCookingBrief, type CookingBrief } from "./contracts/cookingBrief";
import { getCookingBrief, upsertCookingBrief, type AiConversationScope } from "./briefStore";
import { readCanonicalIngredients, readCanonicalSteps } from "../recipes/canonicalRecipe";

export type RecipeSessionSeed = {
  sourceConversationKey?: string | null;
  sourceScope?: AiConversationScope | null;
  instruction?: string | null;
};

type RecipeDraftLike = {
  title: string;
  description?: string | null;
  servings?: number | null;
  prep_time_min?: number | null;
  cook_time_min?: number | null;
  difficulty?: string | null;
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
};

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

function uniqueByKey<T>(values: T[], toKey: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = toKey(value);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function mergeCookingBriefs(base: CookingBrief, update: CookingBrief): CookingBrief {
  return {
    ...base,
    request_mode:
      update.request_mode !== "explore" || base.request_mode === "explore"
        ? update.request_mode
        : base.request_mode,
    confidence: Math.max(base.confidence ?? 0, update.confidence ?? 0),
    ambiguity_reason: update.ambiguity_reason ?? base.ambiguity_reason,
    dish: {
      raw_user_phrase: update.dish.raw_user_phrase ?? base.dish.raw_user_phrase,
      normalized_name: update.dish.normalized_name ?? base.dish.normalized_name,
      dish_family: update.dish.dish_family ?? base.dish.dish_family,
      cuisine: update.dish.cuisine ?? base.dish.cuisine,
      course: update.dish.course ?? base.dish.course,
      authenticity_target: update.dish.authenticity_target ?? base.dish.authenticity_target,
    },
    style: {
      tags: unique([...base.style.tags, ...update.style.tags]),
      texture_tags: unique([...base.style.texture_tags, ...update.style.texture_tags]),
      format_tags: unique([...base.style.format_tags, ...update.style.format_tags]),
    },
    ingredients: {
      required: unique([...base.ingredients.required, ...update.ingredients.required]),
      preferred: unique([...base.ingredients.preferred, ...update.ingredients.preferred]),
      forbidden: unique([...base.ingredients.forbidden, ...update.ingredients.forbidden]),
      centerpiece: update.ingredients.centerpiece ?? base.ingredients.centerpiece,
      provenance: {
        required: uniqueByKey(
          [...(base.ingredients.provenance?.required ?? []), ...(update.ingredients.provenance?.required ?? [])],
          (item) => `${item.phrase}::${item.sourceType}::${item.sourceText ?? ""}::${item.extractionMethod ?? ""}`
        ),
        preferred: uniqueByKey(
          [...(base.ingredients.provenance?.preferred ?? []), ...(update.ingredients.provenance?.preferred ?? [])],
          (item) => `${item.phrase}::${item.sourceType}::${item.sourceText ?? ""}::${item.extractionMethod ?? ""}`
        ),
        forbidden: uniqueByKey(
          [...(base.ingredients.provenance?.forbidden ?? []), ...(update.ingredients.provenance?.forbidden ?? [])],
          (item) => `${item.phrase}::${item.sourceType}::${item.sourceText ?? ""}::${item.extractionMethod ?? ""}`
        ),
      },
      requiredNamedIngredients: [
        ...(base.ingredients.requiredNamedIngredients ?? []),
        ...(update.ingredients.requiredNamedIngredients ?? []),
      ],
    },
    constraints: {
      servings: update.constraints.servings ?? base.constraints.servings,
      time_max_minutes: update.constraints.time_max_minutes ?? base.constraints.time_max_minutes,
      difficulty_target: update.constraints.difficulty_target ?? base.constraints.difficulty_target,
      dietary_tags: unique([...base.constraints.dietary_tags, ...update.constraints.dietary_tags]),
      equipment_limits: unique([...base.constraints.equipment_limits, ...update.constraints.equipment_limits]),
      macroTargets: update.constraints.macroTargets ?? base.constraints.macroTargets ?? null,
    },
    directives: {
      must_have: unique([...base.directives.must_have, ...update.directives.must_have]),
      nice_to_have: unique([...base.directives.nice_to_have, ...update.directives.nice_to_have]),
      must_not_have: unique([...base.directives.must_not_have, ...update.directives.must_not_have]),
      required_techniques: unique([
        ...base.directives.required_techniques,
        ...update.directives.required_techniques,
      ]),
    },
    field_state: {
      dish_family:
        update.field_state.dish_family !== "unknown"
          ? update.field_state.dish_family
          : base.field_state.dish_family,
      normalized_name:
        update.field_state.normalized_name !== "unknown"
          ? update.field_state.normalized_name
          : base.field_state.normalized_name,
      cuisine:
        update.field_state.cuisine !== "unknown"
          ? update.field_state.cuisine
          : base.field_state.cuisine,
      ingredients:
        update.field_state.ingredients !== "unknown"
          ? update.field_state.ingredients
          : base.field_state.ingredients,
      constraints:
        update.field_state.constraints !== "unknown"
          ? update.field_state.constraints
          : base.field_state.constraints,
    },
    source_turn_ids: unique([...base.source_turn_ids, ...update.source_turn_ids]),
    compiler_notes: unique([...base.compiler_notes, ...update.compiler_notes]),
  };
}

function buildRecipeContextFromDraft(draft: RecipeDraftLike) {
  return {
    title: draft.title,
    ingredients: draft.ingredients.map((item) => item.name),
    steps: draft.steps.map((item) => item.text),
  };
}

function buildDraftDerivedBrief(input: {
  draft: RecipeDraftLike;
  instruction?: string | null;
}): CookingBrief {
  return compileCookingBrief({
    userMessage: input.instruction?.trim() || input.draft.title,
    recipeContext: buildRecipeContextFromDraft(input.draft),
    conversationHistory: [],
  });
}

export function getRecipeSessionConversationKey(recipeId: string) {
  return `recipe-session:${recipeId}`;
}

export async function getRecipeSessionBrief(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    recipeId: string;
  }
) {
  return getCookingBrief(supabase, {
    ownerId: input.ownerId,
    conversationKey: getRecipeSessionConversationKey(input.recipeId),
    scope: "recipe_detail",
  });
}

export async function upsertRecipeSessionBrief(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    recipeId: string;
    versionId?: string | null;
    brief: CookingBrief;
  }
) {
  return upsertCookingBrief(supabase, {
    ownerId: input.ownerId,
    conversationKey: getRecipeSessionConversationKey(input.recipeId),
    scope: "recipe_detail",
    recipeId: input.recipeId,
    versionId: input.versionId ?? null,
    brief: input.brief,
    confidence: input.brief.confidence ?? null,
    isLocked: false,
  });
}

export async function seedRecipeSessionFromSavedRecipe(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    recipeId: string;
    versionId?: string | null;
    draft: RecipeDraftLike;
    seed?: RecipeSessionSeed | null;
    inheritFromRecipeId?: string | null;
  }
) {
  let inheritedBrief: CookingBrief | null = null;

  const sourceConversationKey = input.seed?.sourceConversationKey?.trim();
  const sourceScope = input.seed?.sourceScope ?? null;
  if (sourceConversationKey && sourceScope) {
    inheritedBrief =
      (await getCookingBrief(supabase, {
        ownerId: input.ownerId,
        conversationKey: sourceConversationKey,
        scope: sourceScope,
      }))?.brief_json ?? null;
  }

  if (!inheritedBrief && input.inheritFromRecipeId) {
    inheritedBrief =
      (await getRecipeSessionBrief(supabase, {
        ownerId: input.ownerId,
        recipeId: input.inheritFromRecipeId,
      }))?.brief_json ?? null;
  }

  const draftBrief = buildDraftDerivedBrief({
    draft: input.draft,
    instruction: input.seed?.instruction ?? null,
  });

  const finalBrief = inheritedBrief
    ? mergeCookingBriefs(
        mergeCookingBriefs(createEmptyCookingBrief(), inheritedBrief),
        draftBrief
      )
    : draftBrief;

  finalBrief.compiler_notes = unique([
    ...finalBrief.compiler_notes,
    inheritedBrief ? "Recipe session seeded from prior flow context." : "Recipe session seeded from saved recipe content.",
  ]);

  await upsertRecipeSessionBrief(supabase, {
    ownerId: input.ownerId,
    recipeId: input.recipeId,
    versionId: input.versionId ?? null,
    brief: finalBrief,
  });

  return finalBrief;
}

export async function resolveRecipeSessionBrief(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    recipeId: string;
    versionId?: string | null;
  }
) {
  const existing = await getRecipeSessionBrief(supabase, {
    ownerId: input.ownerId,
    recipeId: input.recipeId,
  });

  if (existing?.brief_json) {
    return existing.brief_json;
  }

  const recipeQuery = supabase
    .from("recipes")
    .select("id, title")
    .eq("id", input.recipeId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();

  const versionQuery = input.versionId
    ? supabase
        .from("recipe_versions")
        .select("id, ingredients_json, steps_json, servings, prep_time_min, cook_time_min, difficulty")
        .eq("id", input.versionId)
        .eq("recipe_id", input.recipeId)
        .maybeSingle()
    : supabase
        .from("recipe_versions")
        .select("id, ingredients_json, steps_json, servings, prep_time_min, cook_time_min, difficulty")
        .eq("recipe_id", input.recipeId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

  const [{ data: recipeRow }, { data: versionRow }] = await Promise.all([recipeQuery, versionQuery]);
  if (!recipeRow || !versionRow) {
    return null;
  }

  return seedRecipeSessionFromSavedRecipe(supabase, {
    ownerId: input.ownerId,
    recipeId: input.recipeId,
    versionId: versionRow.id,
    draft: {
      title: typeof recipeRow.title === "string" && recipeRow.title.trim().length > 0 ? recipeRow.title : "Recipe",
      servings: typeof versionRow.servings === "number" ? versionRow.servings : null,
      prep_time_min: typeof versionRow.prep_time_min === "number" ? versionRow.prep_time_min : null,
      cook_time_min: typeof versionRow.cook_time_min === "number" ? versionRow.cook_time_min : null,
      difficulty: typeof versionRow.difficulty === "string" ? versionRow.difficulty : null,
      ingredients: readCanonicalIngredients(versionRow.ingredients_json ?? null),
      steps: readCanonicalSteps(versionRow.steps_json ?? null),
    },
  });
}

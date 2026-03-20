import { normalizeRecipeDraft, repairRecipeDraftIngredientLines, type RecipeDraft } from "@/lib/recipes/recipeDraft";

export class LimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitExceededError";
  }
}

export function getCreatedRecipeHref(input: { recipeId: string; versionId: string }) {
  return `/recipes/${input.recipeId}/versions/${input.versionId}`;
}

export async function createRecipeVersionViaApi(
  recipeId: string,
  input: {
    version_label?: string | null;
    change_summary?: string | null;
    servings?: number | null;
    prep_time_min?: number | null;
    cook_time_min?: number | null;
    difficulty?: string | null;
    ingredients: Array<{ name: string }>;
    steps: Array<{ text: string }>;
    notes?: string | null;
    change_log?: string | null;
    ai_metadata_json?: unknown;
  }
) {
  const response = await fetch(`/api/recipes/${recipeId}/versions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as {
    error?: boolean;
    message?: string;
    version?: {
      id: string;
      recipe_id: string;
      version_number: number;
      version_label: string | null;
      change_summary: string | null;
      servings: number | null;
      prep_time_min: number | null;
      cook_time_min: number | null;
      difficulty: string | null;
      ingredients_json: unknown;
      steps_json: unknown;
      created_at: string;
    };
  };

  if (!response.ok || data.error || !data.version) {
    throw new Error(data.message || "Failed to create version.");
  }

  return data.version;
}

export function mapVersionToCanonicalVersion(version: {
  id: string;
  recipe_id: string;
  version_number: number;
  version_label: string | null;
  change_summary: string | null;
  notes?: string | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  ingredients_json: unknown;
  steps_json: unknown;
  created_at: string;
}) {
  return {
    ...version,
    notes: version.notes ?? null,
    canonical_ingredients: version.ingredients_json,
    canonical_steps: version.steps_json,
  };
}

export async function createRecipeFromDraft(input: {
  draft: RecipeDraft;
}) {
  let draft: RecipeDraft;
  try {
    draft = normalizeRecipeDraft(input.draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("Each ingredient needs a quantity")) {
      throw error;
    }

    draft = normalizeRecipeDraft({
      ...input.draft,
      ingredients: repairRecipeDraftIngredientLines(input.draft.ingredients),
    });
  }
  const response = await fetch("/api/recipes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ draft }),
  });

  const data = (await response.json()) as {
    error?: boolean;
    message?: string;
    code?: string | null;
    recipeId?: string;
    versionId?: string;
    versionNumber?: number;
  };

  if (data.code === "recipe_limit_exceeded") {
    throw new LimitExceededError(data.message || "Free tier limit reached: you can create up to 50 recipes.");
  }

  if (!response.ok || data.error || !data.recipeId || !data.versionId || typeof data.versionNumber !== "number") {
    throw new Error(data.message || "Could not save recipe.");
  }

  return {
    recipeId: data.recipeId,
    versionId: data.versionId,
    versionNumber: data.versionNumber,
  };
}

import { normalizeRecipeDraft, type RecipeDraft } from "../recipes/recipeDraft";

export type AiRecipePurpose = "structure" | "home_recipe" | "refine";
export type AiRecipeSource = "ai" | "cache" | "fallback";

export type AiRecipeMeta = {
  purpose: AiRecipePurpose;
  source: AiRecipeSource;
  provider: string | null;
  model: string | null;
  cached: boolean;
  input_hash: string | null;
  created_at: string | null;
};

export type AiRecipeResult = {
  recipe: RecipeDraft;
  explanation: string | null;
  meta: AiRecipeMeta;
};

export function createAiRecipeResult(input: {
  purpose: AiRecipePurpose;
  source: AiRecipeSource;
  provider?: string | null;
  model?: string | null;
  cached?: boolean;
  inputHash?: string | null;
  createdAt?: string | null;
  explanation?: string | null;
  recipe: RecipeDraft;
}): AiRecipeResult {
  return {
    recipe: normalizeRecipeDraft(input.recipe),
    explanation: input.explanation?.trim() || null,
    meta: {
      purpose: input.purpose,
      source: input.source,
      provider: input.provider ?? null,
      model: input.model ?? null,
      cached: input.cached ?? input.source === "cache",
      input_hash: input.inputHash ?? null,
      created_at: input.createdAt ?? null,
    },
  };
}

export function parseAiRecipeResult(value: unknown): AiRecipeResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (!raw.recipe || typeof raw.meta !== "object" || raw.meta === null) {
    return null;
  }

  try {
    const recipe = normalizeRecipeDraft(raw.recipe);
    const metaRaw = raw.meta as Record<string, unknown>;

    return {
      recipe,
      explanation: typeof raw.explanation === "string" && raw.explanation.trim().length > 0 ? raw.explanation.trim() : null,
      meta: {
        purpose:
          metaRaw.purpose === "structure" || metaRaw.purpose === "home_recipe" || metaRaw.purpose === "refine"
            ? metaRaw.purpose
            : "home_recipe",
        source: metaRaw.source === "cache" || metaRaw.source === "fallback" ? metaRaw.source : "ai",
        provider: typeof metaRaw.provider === "string" ? metaRaw.provider : null,
        model: typeof metaRaw.model === "string" ? metaRaw.model : null,
        cached: metaRaw.cached === true,
        input_hash: typeof metaRaw.input_hash === "string" ? metaRaw.input_hash : null,
        created_at: typeof metaRaw.created_at === "string" ? metaRaw.created_at : null,
      },
    };
  } catch {
    return null;
  }
}

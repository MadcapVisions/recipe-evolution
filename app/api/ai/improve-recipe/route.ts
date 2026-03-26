import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { improveRecipe } from "@/lib/ai/improveRecipe";
import { classifyImproveRecipeError } from "@/lib/ai/improveRecipeError";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { getCachedUserTasteSummary } from "@/lib/ai/userTasteProfile";
import { trackServerEvent } from "@/lib/trackServerEvent";
import { initAiUsageContext } from "@/lib/ai/usageLogger";
import { readCanonicalIngredients, readCanonicalSteps } from "@/lib/recipes/canonicalRecipe";

const improveRecipeRequestSchema = z.object({
  recipeId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  instruction: z.string().trim().min(1).max(2000),
  recipe: z.object({
    title: z.string().trim().min(1),
    servings: z.number().nullable().optional(),
    prep_time_min: z.number().nullable().optional(),
    cook_time_min: z.number().nullable().optional(),
    difficulty: z.string().nullable().optional(),
    ingredients: z.array(z.object({ name: z.string().optional() })),
    steps: z.array(z.object({ text: z.string().optional() })),
  }),
});

export async function POST(request: Request) {
  let trackedAccess: Awaited<ReturnType<typeof requireAuthenticatedAiAccess>> | null = null;
  try {
    const access = await requireAuthenticatedAiAccess({
      route: "improve-recipe",
      maxRequests: 10,
      windowMs: 5 * 60 * 1000,
    });

    if (access.errorResponse) {
      return access.errorResponse;
    }
    trackedAccess = access;
    initAiUsageContext({ userId: access.userId, route: "improve-recipe" });

    let body;
    try {
      body = improveRecipeRequestSchema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: true, message: "recipe context is required" }, { status: 400 });
    }

    const { recipeId, versionId, instruction, recipe } = body;

    const [
      { data: ownedRecipe, error: recipeError },
      { data: ownedVersion, error: versionError },
      userTasteSummary,
    ] = await Promise.all([
      access.supabase
        .from("recipes")
        .select("id")
        .eq("id", recipeId)
        .eq("owner_id", access.userId)
        .maybeSingle(),
      access.supabase
        .from("recipe_versions")
        .select("id, ingredients_json, steps_json, servings, prep_time_min, cook_time_min, difficulty")
        .eq("id", versionId)
        .eq("recipe_id", recipeId)
        .maybeSingle(),
      getCachedUserTasteSummary(access.supabase as SupabaseClient, access.userId),
    ]);

    if (recipeError || versionError || !ownedRecipe || !ownedVersion) {
      return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
    }

    const requestIngredients = recipe.ingredients
      .map((item) => ({ name: typeof item.name === "string" ? item.name.trim() : "" }))
      .filter((item) => item.name.length > 0);
    const requestSteps = recipe.steps
      .map((item) => ({ text: typeof item.text === "string" ? item.text.trim() : "" }))
      .filter((item) => item.text.length > 0);
    const persistedIngredients = readCanonicalIngredients(
      (ownedVersion as { ingredients_json?: unknown } | null)?.ingredients_json ?? null
    );
    const persistedSteps = readCanonicalSteps(
      (ownedVersion as { steps_json?: unknown } | null)?.steps_json ?? null
    );
    const effectiveIngredients = requestIngredients.length > 0 ? requestIngredients : persistedIngredients;
    const effectiveSteps = requestSteps.length > 0 ? requestSteps : persistedSteps;

    if (effectiveIngredients.length === 0 || effectiveSteps.length === 0) {
      return NextResponse.json(
        {
          error: true,
          message: "Recipe update needs a saved recipe with ingredients and steps before AI can modify it.",
        },
        { status: 422 }
      );
    }

    const result = await improveRecipe({
      instruction,
      userTasteSummary,
      recipe: {
        title: recipe.title,
        servings:
          typeof recipe.servings === "number"
            ? recipe.servings
            : typeof (ownedVersion as { servings?: unknown } | null)?.servings === "number"
            ? ((ownedVersion as { servings?: number }).servings ?? null)
            : null,
        prep_time_min:
          typeof recipe.prep_time_min === "number"
            ? recipe.prep_time_min
            : typeof (ownedVersion as { prep_time_min?: unknown } | null)?.prep_time_min === "number"
            ? ((ownedVersion as { prep_time_min?: number }).prep_time_min ?? null)
            : null,
        cook_time_min:
          typeof recipe.cook_time_min === "number"
            ? recipe.cook_time_min
            : typeof (ownedVersion as { cook_time_min?: unknown } | null)?.cook_time_min === "number"
            ? ((ownedVersion as { cook_time_min?: number }).cook_time_min ?? null)
            : null,
        difficulty:
          typeof recipe.difficulty === "string"
            ? recipe.difficulty
            : typeof (ownedVersion as { difficulty?: unknown } | null)?.difficulty === "string"
            ? ((ownedVersion as { difficulty?: string }).difficulty ?? null)
            : null,
        ingredients: effectiveIngredients,
        steps: effectiveSteps,
      },
    }, {
      supabase: access.supabase as SupabaseClient,
      userId: access.userId,
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Improve recipe route failed", error);
    const classified = classifyImproveRecipeError(error);
    if (trackedAccess) {
      await trackServerEvent(trackedAccess.supabase, trackedAccess.userId, "ai_route_failed", {
        route: "improve-recipe",
        message: error instanceof Error ? error.message : "Unknown error",
        status: classified.status,
        user_message: classified.message,
      });
    }
    return NextResponse.json(
      {
        error: true,
        message: classified.message,
      },
      { status: classified.status }
    );
  }
}

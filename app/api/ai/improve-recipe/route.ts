import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { improveRecipe } from "@/lib/ai/improveRecipe";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { buildUserTasteSummary } from "@/lib/ai/userTasteProfile";
import { trackServerEvent } from "@/lib/trackServerEvent";

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

    let body;
    try {
      body = improveRecipeRequestSchema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: true, message: "recipe context is required" }, { status: 400 });
    }

    const { recipeId, versionId, instruction, recipe } = body;

    const [{ data: ownedRecipe, error: recipeError }, { data: ownedVersion, error: versionError }] = await Promise.all([
      access.supabase
        .from("recipes")
        .select("id")
        .eq("id", recipeId)
        .eq("owner_id", access.userId)
        .maybeSingle(),
      access.supabase
        .from("recipe_versions")
        .select("id")
        .eq("id", versionId)
        .eq("recipe_id", recipeId)
        .maybeSingle(),
    ]);

    if (recipeError || versionError || !ownedRecipe || !ownedVersion) {
      return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
    }

    const result = await improveRecipe({
      instruction,
      userTasteSummary: await buildUserTasteSummary(access.supabase as SupabaseClient, access.userId),
      recipe: {
        title: recipe.title,
        servings: typeof recipe.servings === "number" ? recipe.servings : null,
        prep_time_min: typeof recipe.prep_time_min === "number" ? recipe.prep_time_min : null,
        cook_time_min: typeof recipe.cook_time_min === "number" ? recipe.cook_time_min : null,
        difficulty: typeof recipe.difficulty === "string" ? recipe.difficulty : null,
        ingredients: recipe.ingredients
          .map((item) => ({ name: typeof item.name === "string" ? item.name.trim() : "" }))
          .filter((item) => item.name.length > 0),
        steps: recipe.steps
          .map((item) => ({ text: typeof item.text === "string" ? item.text.trim() : "" }))
          .filter((item) => item.text.length > 0),
      },
    }, {
      supabase: access.supabase as SupabaseClient,
      userId: access.userId,
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Improve recipe route failed", error);
    if (trackedAccess) {
      void trackServerEvent(trackedAccess.supabase, trackedAccess.userId, "ai_route_failed", {
        route: "improve-recipe",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return NextResponse.json(
      {
        error: true,
        message: "AI improvement failed. Please try again.",
      },
      { status: 500 }
    );
  }
}

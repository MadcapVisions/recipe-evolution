import { NextResponse } from "next/server";
import { improveRecipe } from "@/lib/ai/improveRecipe";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { buildUserTasteSummary } from "@/lib/ai/userTasteProfile";

type ImproveRecipeRequest = {
  recipeId?: string;
  versionId?: string;
  instruction?: string;
  recipe?: {
    title?: string;
    servings?: number | null;
    prep_time_min?: number | null;
    cook_time_min?: number | null;
    difficulty?: string | null;
    ingredients?: Array<{ name?: string }>;
    steps?: Array<{ text?: string }>;
  };
};

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedAiAccess({
      route: "improve-recipe",
      maxRequests: 10,
      windowMs: 5 * 60 * 1000,
    });

    if (access.errorResponse) {
      return access.errorResponse;
    }

    const body = (await request.json()) as ImproveRecipeRequest;
    const recipeId = body.recipeId?.trim();
    const versionId = body.versionId?.trim();
    const instruction = body.instruction?.trim();
    const recipe = body.recipe;

    if (!recipeId || !versionId) {
      return NextResponse.json({ error: true, message: "recipeId and versionId are required" }, { status: 400 });
    }

    if (!instruction || instruction.length > 2000) {
      return NextResponse.json({ error: true, message: "instruction is required" }, { status: 400 });
    }

    if (!recipe?.title || !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps)) {
      return NextResponse.json({ error: true, message: "recipe context is required" }, { status: 400 });
    }

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
      userTasteSummary: await buildUserTasteSummary(access.supabase as any, access.userId),
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
    });

    return NextResponse.json({ recipe: result });
  } catch (error) {
    console.error("Improve recipe route failed", error);
    return NextResponse.json(
      {
        error: true,
        message: "AI improvement failed. Please try again.",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { estimateNutritionFacts } from "@/lib/ai/nutritionFacts";
import { initAiUsageContext } from "@/lib/ai/usageLogger";

const requestSchema = z.object({
  recipeId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  recipe: z.object({
    title: z.string().trim().min(1),
    servings: z.number().int().positive(),
    ingredients: z.array(z.object({ name: z.string() })),
  }),
  force: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedAiAccess({
      route: "nutrition",
      maxRequests: 20,
      windowMs: 5 * 60 * 1000,
    });

    if (access.errorResponse) {
      return access.errorResponse;
    }
    initAiUsageContext({ supabase: access.supabase as SupabaseClient, userId: access.userId, route: "nutrition" });

    let body;
    try {
      body = requestSchema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: true, message: "Invalid request" }, { status: 400 });
    }

    const { recipeId, versionId, recipe, force } = body;

    const [{ data: ownedRecipe, error: recipeError }, { data: ownedVersion, error: versionError }] = await Promise.all([
      access.supabase.from("recipes").select("id").eq("id", recipeId).eq("owner_id", access.userId).maybeSingle(),
      access.supabase.from("recipe_versions").select("id").eq("id", versionId).eq("recipe_id", recipeId).maybeSingle(),
    ]);

    if (recipeError || versionError || !ownedRecipe || !ownedVersion) {
      return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
    }

    const facts = await estimateNutritionFacts(recipe, {
      supabase: access.supabase,
      userId: access.userId,
      force,
    });

    return NextResponse.json({ facts });
  } catch (error) {
    console.error("Nutrition route failed", error);
    return NextResponse.json({ error: true, message: "Could not estimate nutrition facts." }, { status: 500 });
  }
}

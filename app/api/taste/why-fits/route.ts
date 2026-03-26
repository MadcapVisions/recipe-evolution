import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import {
  applyDecay,
  buildWhyFitsLines,
  extractRecipeFeatures,
  getOverallConfidenceLevel,
  type TasteModel,
} from "@/lib/ai/tasteModel";

const bodySchema = z.object({
  recipe_title: z.string(),
  recipe_tags: z.array(z.string()).optional().default([]),
  recipe_ingredients: z.array(z.string()).optional().default([]),
  dish_family: z.string().nullable().optional(),
});

export type WhyFitsResponse = {
  show: boolean;
  lines: string[];
  confidenceLevel: "low" | "medium" | "high";
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { recipe_title, recipe_tags, recipe_ingredients, dish_family } = parsed.data;

  const { data: row } = await supabase
    .from("user_taste_scores")
    .select("scores_json, updated_at")
    .eq("owner_id", user.id)
    .maybeSingle();

  // No scores yet → nothing to show
  if (!row?.scores_json) {
    return NextResponse.json({ show: false, lines: [], confidenceLevel: "low" } satisfies WhyFitsResponse);
  }

  const raw = row.scores_json as TasteModel;
  const daysSince =
    (Date.now() - new Date(row.updated_at as string).getTime()) / (1000 * 60 * 60 * 24);
  const model = applyDecay(raw, daysSince);

  const confidenceLevel = getOverallConfidenceLevel(model);

  // Require at least medium confidence to show anything
  if (confidenceLevel === "low") {
    return NextResponse.json({ show: false, lines: [], confidenceLevel } satisfies WhyFitsResponse);
  }

  const features = extractRecipeFeatures({
    title: recipe_title,
    tags: recipe_tags,
    ingredients: recipe_ingredients,
    dishFamily: dish_family ?? null,
  });

  const lines = buildWhyFitsLines(model, features);

  return NextResponse.json({
    show: lines.length > 0,
    lines,
    confidenceLevel,
  } satisfies WhyFitsResponse);
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAdmin } from "@/lib/auth/adminAccess";
import { callAIWithMeta } from "@/lib/ai/aiClient";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const aiModelTestSchema = z.object({
  taskKey: z.enum(["chef_chat", "home_ideas", "home_recipe", "recipe_cia", "recipe_improvement", "recipe_structure"]),
  model: z.string().trim().min(1).max(200),
});

function buildTestPrompt(taskKey: string) {
  switch (taskKey) {
    case "chef_chat":
      return [
        { role: "system" as const, content: "You are a cooking assistant. Reply in one short sentence." },
        { role: "user" as const, content: "Suggest one fast lemon chicken dinner idea." },
      ];
    case "home_ideas":
      return [
        { role: "system" as const, content: "Return only valid JSON." },
        { role: "user" as const, content: '{"ideas":[{"title":"Lemon Chicken Bowl","description":"Bright weeknight bowl","cook_time_min":25}]}' },
      ];
    case "home_recipe":
      return [
        { role: "system" as const, content: "Return only valid JSON for a simple recipe." },
        { role: "user" as const, content: '{"title":"Test Pasta","description":"Simple dinner","servings":2,"prep_time_min":10,"cook_time_min":15,"difficulty":"Easy","ingredients":[{"name":"8 oz pasta","quantity":8,"unit":"oz","prep":null}],"steps":[{"text":"Boil pasta."}]}' },
      ];
    case "recipe_improvement":
      return [
        { role: "system" as const, content: "Return only valid JSON." },
        { role: "user" as const, content: '{"title":"Improved Chili","explanation":"Brighter flavor","servings":4,"prep_time_min":15,"cook_time_min":35,"difficulty":"Easy","ingredients":[{"name":"1 onion","quantity":1,"unit":null,"prep":"diced"}],"steps":[{"text":"Cook the onion."}]}' },
      ];
    case "recipe_cia":
      return [
        {
          role: "system" as const,
          content: 'Return only valid JSON with keys decision, confidence, summary, retryStrategy, dropRequiredNamedIngredients, dropRequiredIngredients, correctedStructuredRecipe.',
        },
        {
          role: "user" as const,
          content: '{"flow":"home_create","failureKind":"verification_failed","reasons":["Required ingredient \\"ok\\" appears in ingredients but is not used in any step."],"cookingBrief":{"ingredients":{"required":["ok","peanut butter"],"requiredNamedIngredients":[{"normalizedName":"ok"},{"normalizedName":"peanut butter"}]}}}',
        },
      ];
    default:
      return [
        { role: "system" as const, content: "Return only valid JSON." },
        { role: "user" as const, content: '{"title":"Test Recipe","description":"Structured","ingredients":[{"name":"1 onion","quantity":1,"unit":null,"prep":"diced"}],"steps":[{"text":"Dice the onion."}]}' },
      ];
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  if (!canAccessAdmin(user.email)) {
    return NextResponse.json({ error: true, message: "Admin access required." }, { status: 403 });
  }

  let body;
  try {
    body = aiModelTestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Invalid AI model test payload." }, { status: 400 });
  }

  const startedAt = Date.now();

  try {
    const result = await callAIWithMeta(buildTestPrompt(body.taskKey), {
      model: body.model,
      fallback_models: [],
      max_tokens: 120,
      temperature: 0.2,
    });

    return NextResponse.json({
      ok: true,
      model: result.model ?? body.model,
      latencyMs: Date.now() - startedAt,
      preview: result.text.slice(0, 240),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: true,
        message: error instanceof Error ? error.message : "Model test failed.",
        latencyMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}

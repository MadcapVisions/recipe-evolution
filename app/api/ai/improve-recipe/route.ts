import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { improveRecipe, ImproveRecipeGenerationError } from "@/lib/ai/improveRecipe";
import { classifyImproveRecipeError } from "@/lib/ai/improveRecipeError";
import { AIJsonParseError } from "@/lib/ai/jsonResponse";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { getCachedUserTasteSummary } from "@/lib/ai/userTasteProfile";
import { trackServerEvent } from "@/lib/trackServerEvent";
import { initAiUsageContext } from "@/lib/ai/usageLogger";
import { readCanonicalIngredients, readCanonicalSteps } from "@/lib/recipes/canonicalRecipe";
import { getRecipeSessionConversationKey, resolveRecipeSessionBrief } from "@/lib/ai/recipeSessionStore";
import { getLatestGenerationAttempt, storeGenerationAttempt } from "@/lib/ai/generationAttemptStore";
import { buildAttemptOrchestrationState, normalizeRecipeEditInstruction } from "@/lib/ai/recipeOrchestrator";
import { compileCookingBrief } from "@/lib/ai/briefCompiler";
import type { CookingBrief } from "@/lib/ai/contracts/cookingBrief";
import type { PreviousAttemptSnapshot } from "@/lib/ai/contracts/orchestrationState";
import { getConversationTurns } from "@/lib/ai/conversationStore";
import { buildSessionMemoryBlock, mergeSessionConversationHistory } from "@/lib/ai/sessionContext";

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
  let parsedBody:
    | z.infer<typeof improveRecipeRequestSchema>
    | null = null;
  let sessionBrief: CookingBrief | null = null;
  let previousAttempt: PreviousAttemptSnapshot = null;
  let debugPayload: unknown = null;
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
    parsedBody = body;

    const { recipeId, versionId, instruction, recipe } = body;
    const conversationKey = getRecipeSessionConversationKey(recipeId);
    const normalizedInstruction = normalizeRecipeEditInstruction(instruction);

    const [
      { data: ownedRecipe, error: recipeError },
      { data: ownedVersion, error: versionError },
      userTasteSummary,
      resolvedSessionBrief,
      resolvedPreviousAttempt,
      persistedTurns,
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
      resolveRecipeSessionBrief(access.supabase as SupabaseClient, {
        ownerId: access.userId,
        recipeId,
        versionId,
      }),
      getLatestGenerationAttempt(access.supabase as SupabaseClient, {
        ownerId: access.userId,
        conversationKey,
        scope: "recipe_detail",
      }),
      getConversationTurns(access.supabase as SupabaseClient, {
        ownerId: access.userId,
        conversationKey,
        scope: "recipe_detail",
      }),
    ]);
    sessionBrief = resolvedSessionBrief;
    previousAttempt = resolvedPreviousAttempt;

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
    const usedSessionRecovery = requestIngredients.length === 0 || requestSteps.length === 0;
    const conversationHistory = mergeSessionConversationHistory({
      persistedTurns,
      clientHistory: [],
    });
    const sessionMemory = buildSessionMemoryBlock({
      brief: resolvedSessionBrief,
      recipeContext: {
        title: recipe.title,
        ingredients: effectiveIngredients.map((item) => item.name),
        steps: effectiveSteps.map((item) => item.text),
      },
      conversationHistory,
    });

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
      sessionBrief: resolvedSessionBrief,
      conversationHistory,
      sessionMemory,
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
      conversationKey,
      recipeId,
      versionId,
    });
    debugPayload = result;

    await storeGenerationAttempt(access.supabase as SupabaseClient, {
      ownerId: access.userId,
      conversationKey,
      scope: "recipe_detail",
      recipeId,
      versionId,
      requestMode: resolvedSessionBrief?.request_mode ?? "revise",
      stateBefore: "recipe_loaded",
      stateAfter: "suggestion_ready",
      attempt: {
        conversation_snapshot: `user: ${instruction}`,
        cooking_brief:
          resolvedSessionBrief ??
          compileCookingBrief({
            userMessage: normalizedInstruction,
            conversationHistory: [],
            recipeContext: {
              title: recipe.title,
              ingredients: effectiveIngredients.map((item) => item.name),
              steps: effectiveSteps.map((item) => item.text),
            },
          }),
        recipe_plan: null,
        generator_input: {
          instruction,
          normalized_instruction: normalizedInstruction,
          recipe_title: recipe.title,
          used_saved_recipe_context: usedSessionRecovery,
          orchestration_state: buildAttemptOrchestrationState({
            flow: "recipe_detail_improve",
            action: "suggest_recipe_update",
            intent: "edit_request",
            buildable: true,
            conversationKey,
            recipeId,
            versionId,
            attemptNumber: (previousAttempt?.attemptNumber ?? 0) + 1,
            requestMode: resolvedSessionBrief?.request_mode ?? "revise",
            normalizedInstruction,
            stateBefore: "recipe_loaded",
            stateAfter: "suggestion_ready",
            usedSessionRecovery,
            usedFallbackModel: false,
            failureStage: null,
            retryStrategy: "none",
            recoveryActions: usedSessionRecovery ? ["reuse_saved_recipe_context", "suggest_recipe_update"] : ["suggest_recipe_update"],
            reason: null,
            reasonCodes: [],
            model: result.meta.model ?? result.meta.provider ?? null,
            previousAttempt,
            brief: resolvedSessionBrief,
          }),
        },
        raw_model_output: result,
        normalized_recipe: result.recipe,
        verification: null,
        attempt_number: (previousAttempt?.attemptNumber ?? 0) + 1,
        provider: result.meta.provider ?? null,
        model: result.meta.model ?? result.meta.provider ?? null,
        outcome: "passed",
        stage_metrics: [],
      },
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Improve recipe route failed", error);
    const classified = classifyImproveRecipeError(error);
    const rawModelOutput =
      error instanceof AIJsonParseError
        ? error.response
        : error instanceof ImproveRecipeGenerationError
        ? error.debugPayload
        : debugPayload;
    if (trackedAccess) {
      if (parsedBody) {
        const conversationKey = getRecipeSessionConversationKey(parsedBody.recipeId);
        const normalizedInstruction = normalizeRecipeEditInstruction(parsedBody.instruction);
        const requestIngredients = parsedBody.recipe.ingredients
          .map((item) => ({ name: typeof item.name === "string" ? item.name.trim() : "" }))
          .filter((item) => item.name.length > 0);
        const requestSteps = parsedBody.recipe.steps
          .map((item) => ({ text: typeof item.text === "string" ? item.text.trim() : "" }))
          .filter((item) => item.text.length > 0);
        const usedSessionRecovery = requestIngredients.length === 0 || requestSteps.length === 0;
        await storeGenerationAttempt(trackedAccess.supabase as SupabaseClient, {
          ownerId: trackedAccess.userId,
          conversationKey,
          scope: "recipe_detail",
          recipeId: parsedBody.recipeId,
          versionId: parsedBody.versionId,
          requestMode: sessionBrief?.request_mode ?? "revise",
          stateBefore: "recipe_loaded",
          stateAfter: "recipe_loaded",
          attempt: {
            conversation_snapshot: `user: ${parsedBody.instruction}`,
            cooking_brief:
              sessionBrief ??
              compileCookingBrief({
                userMessage: normalizedInstruction,
                conversationHistory: [],
                recipeContext: {
                  title: parsedBody.recipe.title,
                  ingredients: requestIngredients.map((item) => item.name),
                  steps: requestSteps.map((item) => item.text),
                },
              }),
            recipe_plan: null,
            generator_input: {
              instruction: parsedBody.instruction,
              normalized_instruction: normalizedInstruction,
              recipe_title: parsedBody.recipe.title,
              used_saved_recipe_context: usedSessionRecovery,
              orchestration_state: buildAttemptOrchestrationState({
                flow: "recipe_detail_improve",
                action: "suggest_recipe_update",
                intent: "edit_request",
                buildable: true,
                conversationKey,
                recipeId: parsedBody.recipeId,
                versionId: parsedBody.versionId,
                attemptNumber: (previousAttempt?.attemptNumber ?? 0) + 1,
                requestMode: sessionBrief?.request_mode ?? "revise",
                normalizedInstruction,
                stateBefore: "recipe_loaded",
                stateAfter: "recipe_loaded",
                usedSessionRecovery,
                usedFallbackModel: false,
                failureStage: classified.status >= 500 ? "generation" : "schema",
                retryStrategy: classified.status >= 500 ? "regenerate_same_model" : "ask_user",
                recoveryActions: usedSessionRecovery
                  ? ["reuse_saved_recipe_context", classified.status >= 500 ? "retry_same_model" : "ask_clarifying_question"]
                  : [classified.status >= 500 ? "retry_same_model" : "ask_clarifying_question"],
                reason: classified.message,
                reasonCodes: [error instanceof Error ? error.message : "unknown_error"],
                model: previousAttempt?.model ?? null,
                previousAttempt,
                brief: sessionBrief,
              }),
            },
            raw_model_output: rawModelOutput,
            normalized_recipe: null,
            verification: null,
            attempt_number: (previousAttempt?.attemptNumber ?? 0) + 1,
            provider: null,
            model: previousAttempt?.model ?? null,
            outcome: "generation_failed",
            stage_metrics: [],
          },
        });
      }
      await trackServerEvent(trackedAccess.supabase, trackedAccess.userId, "ai_route_failed", {
        route: "improve-recipe",
        message: error instanceof Error ? error.message : "Unknown error",
        status: classified.status,
        user_message: classified.message,
        raw_model_output: rawModelOutput,
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

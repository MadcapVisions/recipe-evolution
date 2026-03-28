import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { chefChat } from "@/lib/ai/chefChat";
import type { ChefChatEnvelope } from "@/lib/ai/chefOptions";
import type { AIMessage } from "@/lib/ai/chatPromptBuilder";
import { improveRecipe } from "@/lib/ai/improveRecipe";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { trackServerEvent } from "@/lib/trackServerEvent";
import { getCachedUserTasteSummary } from "@/lib/ai/userTasteProfile";
import { storeConversationTurns } from "@/lib/ai/conversationStore";
import { COOKING_SCOPE_MESSAGE, guardCookingTopic } from "@/lib/ai/topicGuard";
import { resolveAiTaskSettings } from "@/lib/ai/taskSettings";
import { initAiUsageContext } from "@/lib/ai/usageLogger";
import { readCanonicalIngredients, readCanonicalSteps } from "@/lib/recipes/canonicalRecipe";
import { analyzeRecipeTurn } from "@/lib/ai/recipeOrchestrator";
import { compileCookingBrief } from "@/lib/ai/briefCompiler";
import { upsertCookingBrief } from "@/lib/ai/briefStore";
import { mergeCookingBriefs, resolveRecipeSessionBrief } from "@/lib/ai/recipeSessionStore";
import { createEmptyCookingBrief } from "@/lib/ai/contracts/cookingBrief";
import { buildChefIntelligence, deriveChefActions } from "@/lib/ai/chefIntelligence";

const aiMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const recipeContextSchema = z
  .object({
    title: z.string().optional(),
    ingredients: z.array(z.string()).optional(),
    steps: z.array(z.string()).optional(),
  })
  .nullable()
  .optional();

const recipeSuggestionSchema = z.object({
  title: z.string().trim().min(1),
  servings: z.number().nullable().optional(),
  prep_time_min: z.number().nullable().optional(),
  cook_time_min: z.number().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  ingredients: z.array(z.object({ name: z.string().optional() })).optional(),
  steps: z.array(z.object({ text: z.string().optional() })).optional(),
});

const chefChatRequestSchema = z.object({
  userMessage: z.string().trim().min(1).max(4000),
  recipeContext: recipeContextSchema,
  conversationHistory: z.array(aiMessageSchema).optional(),
  conversationKey: z.string().optional(),
  includeSuggestion: z.boolean().optional(),
  recipeId: z.string().optional(),
  versionId: z.string().optional(),
  recipe: recipeSuggestionSchema.optional(),
});

export async function POST(request: Request) {
  let trackedAccess:
    | {
        supabase: Awaited<ReturnType<typeof import("@/lib/supabaseServer").createSupabaseServerClient>>;
        userId: string;
      }
    | null = null;
  try {
    const access = await requireAuthenticatedAiAccess({
      route: "chef-chat",
      maxRequests: 20,
      windowMs: 5 * 60 * 1000,
    });

    if (access.errorResponse) {
      return access.errorResponse;
    }

    trackedAccess = {
      supabase: access.supabase,
      userId: access.userId,
    };
    initAiUsageContext({ userId: access.userId, route: "chef-chat" });
    const tasteSummaryPromise = getCachedUserTasteSummary(access.supabase as SupabaseClient, access.userId);

    let body;
    try {
      body = chefChatRequestSchema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: true, message: "userMessage is required" }, { status: 400 });
    }

    const userTasteSummary = await tasteSummaryPromise;

    const userMessage = body.userMessage;

    const topicGuard = guardCookingTopic({
      message: userMessage,
      recipeContext: body.recipeContext ?? null,
    });

    if (!topicGuard.allowed) {
      void trackServerEvent(access.supabase, access.userId, "ai_topic_guard_blocked", {
        route: "chef-chat",
        user_message_length: userMessage.length,
        recipe_id: body.recipeId?.trim() || null,
        version_id: body.versionId?.trim() || null,
      });
      return NextResponse.json({ mode: "refine", reply: COOKING_SCOPE_MESSAGE, options: [], recommended_option_id: null, suggestion: null });
    }

    const conversationHistory = Array.isArray(body.conversationHistory)
      ? body.conversationHistory.filter(
          (message): message is AIMessage =>
            Boolean(message) &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string" &&
            message.content.trim().length > 0
        )
      : [];
    const orchestration = analyzeRecipeTurn({
      userMessage,
      selectedDirectionLocked: conversationHistory.some((message) =>
        message.role === "assistant" && /^Locked direction:/i.test(message.content)
      ),
      hasRecipeContext: Boolean(body.recipeContext || body.recipe || body.recipeId || body.versionId),
    });
    const recipeId = body.recipeId?.trim() || null;
    const versionId = body.versionId?.trim() || null;
    const sessionBriefPromise =
      recipeId
        ? resolveRecipeSessionBrief(access.supabase as SupabaseClient, {
            ownerId: access.userId,
            recipeId,
            versionId,
          })
        : Promise.resolve(null);

    const taskSetting = await resolveAiTaskSettings("chef_chat");
    if (!taskSetting.enabled) {
      return NextResponse.json({ error: true, message: "Chef chat is currently disabled." }, { status: 503 });
    }

    // Validate suggestion fields synchronously before starting any async work.
    if (body.includeSuggestion) {
      const recipeId = body.recipeId?.trim();
      const versionId = body.versionId?.trim();
      const recipe = body.recipe;
      if (!recipeId || !versionId || !recipe?.title || !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps)) {
        return NextResponse.json({ error: true, message: "Recipe context is required for suggestions." }, { status: 400 });
      }
    }

    // If a suggestion is needed, run ownership checks (fast DB queries) before starting any
    // AI calls. This prevents abandoned in-flight AI calls on 403 ownership failures.
    let ownedVersion: {
      id: string;
      ingredients_json?: unknown;
      steps_json?: unknown;
      servings?: unknown;
      prep_time_min?: unknown;
      cook_time_min?: unknown;
      difficulty?: unknown;
    } | null = null;
    if (body.includeSuggestion && orchestration.shouldIncludeSuggestion) {
      const recipeId = body.recipeId!.trim();
      const versionId = body.versionId!.trim();

      const [{ data: ownedRecipe, error: recipeError }, { data: ownedVersionData, error: versionError }] = await Promise.all([
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
      ]);

      if (recipeError || versionError || !ownedRecipe || !ownedVersionData) {
        return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
      }

      ownedVersion = ownedVersionData;
    }

    // Start both AI calls now — ownership is confirmed, no more early returns after this point.
    const chefChatPromise = chefChat(userMessage, body.recipeContext ?? null, conversationHistory, userTasteSummary, taskSetting);

    let improveRecipePromise: Promise<Record<string, unknown> | null> = Promise.resolve(null);
    if (body.includeSuggestion && orchestration.shouldIncludeSuggestion && ownedVersion) {
      const recipe = body.recipe!;
      const requestIngredients = recipe.ingredients!
        .map((item) => ({ name: typeof item.name === "string" ? item.name.trim() : "" }))
        .filter((item) => item.name.length > 0);
      const requestSteps = recipe.steps!
        .map((item) => ({ text: typeof item.text === "string" ? item.text.trim() : "" }))
        .filter((item) => item.text.length > 0);
      const persistedIngredients = readCanonicalIngredients(ownedVersion.ingredients_json ?? null);
      const persistedSteps = readCanonicalSteps(ownedVersion.steps_json ?? null);
      const effectiveIngredients = requestIngredients.length > 0 ? requestIngredients : persistedIngredients;
      const effectiveSteps = requestSteps.length > 0 ? requestSteps : persistedSteps;

      improveRecipePromise = improveRecipe({
        instruction: orchestration.normalizedRecipeInstruction ?? userMessage,
        userTasteSummary,
        sessionBrief: await sessionBriefPromise,
        recipe: {
          title: recipe.title,
          servings:
            typeof recipe.servings === "number"
              ? recipe.servings
              : typeof ownedVersion.servings === "number"
              ? (ownedVersion.servings ?? null)
              : null,
          prep_time_min:
            typeof recipe.prep_time_min === "number"
              ? recipe.prep_time_min
              : typeof ownedVersion.prep_time_min === "number"
              ? (ownedVersion.prep_time_min ?? null)
              : null,
          cook_time_min:
            typeof recipe.cook_time_min === "number"
              ? recipe.cook_time_min
              : typeof ownedVersion.cook_time_min === "number"
              ? (ownedVersion.cook_time_min ?? null)
              : null,
          difficulty:
            typeof recipe.difficulty === "string"
              ? recipe.difficulty
              : typeof ownedVersion.difficulty === "string"
              ? (ownedVersion.difficulty ?? null)
              : null,
          ingredients: effectiveIngredients,
          steps: effectiveSteps,
        },
      })
        .then((r) => r as unknown as Record<string, unknown>)
        .catch((suggestionError) => {
          console.warn("Chef chat suggestion generation failed", suggestionError);
          return null;
        });
    }

    const [result, suggestion] = await Promise.all([chefChatPromise, improveRecipePromise]);
    const envelope = result.envelope;
    const recipeForChefIntelligence = {
      title: body.recipeContext?.title ?? body.recipe?.title ?? null,
      ingredients:
        body.recipeContext?.ingredients ??
        body.recipe?.ingredients?.map((item) => (typeof item.name === "string" ? item.name : "")).filter((item) => item.trim().length > 0) ??
        [],
      steps:
        body.recipeContext?.steps ??
        body.recipe?.steps?.map((item) => (typeof item.text === "string" ? item.text : "")).filter((item) => item.trim().length > 0) ??
        [],
    };
    const chefIntelligence = buildChefIntelligence(recipeForChefIntelligence);
    const actions =
      recipeForChefIntelligence.ingredients.length > 0 || recipeForChefIntelligence.steps.length > 0
        ? deriveChefActions({
            userMessage,
            assistantReply: envelope.reply,
            recipe: recipeForChefIntelligence,
          })
        : [];

    if (result.repaired) {
      void trackServerEvent(access.supabase, access.userId, "chef_chat_repaired", {
        route: "chef-chat",
        provider: result.provider,
        finish_reason: result.finishReason ?? null,
        user_message_length: userMessage.length,
        initial_reply_length: result.initialReply.trim().length,
        final_reply_length: envelope.reply.trim().length,
        conversation_turns: conversationHistory.length,
      });
    }

    if (typeof body.conversationKey === "string" && body.conversationKey.trim().length > 0) {
      const conversationKey = body.conversationKey.trim();
      const brief = compileCookingBrief({
        userMessage: orchestration.normalizedRecipeInstruction ?? userMessage,
        recipeContext: body.recipeContext ?? null,
        conversationHistory,
      });
      const sessionBrief = await sessionBriefPromise;
      const persistedBrief =
        recipeId && conversationKey.startsWith("recipe-session:")
          ? mergeCookingBriefs(
              mergeCookingBriefs(createEmptyCookingBrief(), sessionBrief ?? createEmptyCookingBrief()),
              brief
            )
          : brief;
      void upsertCookingBrief(access.supabase as SupabaseClient, {
        ownerId: access.userId,
        conversationKey,
        scope: "recipe_detail",
        recipeId,
        versionId,
        brief: persistedBrief,
        confidence: persistedBrief.confidence ?? null,
        isLocked: false,
      }).catch((e) => console.error("upsertCookingBrief failed", e));
      void storeConversationTurns(access.supabase as SupabaseClient, {
        ownerId: access.userId,
        conversationKey,
        scope: "recipe_detail",
        recipeId,
        versionId,
        turns: [
          {
            role: "user",
            message: userMessage,
          },
          {
            role: "assistant",
            message: envelope.reply,
            metadata_json:
              suggestion
                ? { suggestion_created: true, envelope, orchestration, actions, chefIntelligence }
                : envelope.options.length > 0
                ? { ...envelope, orchestration, actions, chefIntelligence }
                : { orchestration, actions, chefIntelligence },
          },
        ],
      }).catch((e) => console.error("storeConversationTurns failed", e));
    }

    return NextResponse.json({
      ...(envelope as ChefChatEnvelope),
      suggestion,
      orchestration,
      actions,
      chef_intelligence: chefIntelligence,
    });
  } catch (error) {
    console.error("Chef chat route failed", error);
    if (trackedAccess) {
      await trackServerEvent(trackedAccess.supabase, trackedAccess.userId, "ai_route_failed", {
        route: "chef-chat",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return NextResponse.json(
      {
        error: true,
        message: "Chef chat failed. Please try again.",
      },
      { status: 500 }
    );
  }
}

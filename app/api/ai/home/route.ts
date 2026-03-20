import { NextResponse } from "next/server";
import { z } from "zod";
import { chefChat } from "@/lib/ai/chefChat";
import { generateHomeIdeasWithCache, generateHomeRecipe } from "@/lib/ai/homeHub";
import type { AIMessage, RecipeContext } from "@/lib/ai/chatPromptBuilder";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { trackServerEvent } from "@/lib/trackServerEvent";
import { buildUserTasteSummary } from "@/lib/ai/userTasteProfile";
import { storeConversationTurns } from "@/lib/ai/conversationStore";
import { COOKING_SCOPE_MESSAGE, guardCookingTopic } from "@/lib/ai/topicGuard";
import { resolveAiTaskSettings } from "@/lib/ai/taskSettings";
import { compileCookingBrief } from "@/lib/ai/briefCompiler";
import { getCookingBrief, upsertCookingBrief } from "@/lib/ai/briefStore";
import { storeGenerationAttempt } from "@/lib/ai/generationAttemptStore";
import { createAiStageMetric } from "@/lib/ai/contracts/stageMetrics";
import { createFailedVerificationResult } from "@/lib/ai/contracts/verificationResult";
import { verifyRecipeAgainstBrief } from "@/lib/ai/recipeVerifier";
import { buildRecipePlanFromBrief } from "@/lib/ai/recipePlanner";
import { getRecipeBuildFailureDetails } from "@/lib/ai/recipeBuildError";
import { buildRetryRecipePlan, shouldAutoRetryRecipeBuild } from "@/lib/ai/homeRecipeRetry";

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

const homeAiRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("chef_chat"),
    userMessage: z.string().trim().min(1).max(4000),
    recipeContext: recipeContextSchema,
    conversationHistory: z.array(aiMessageSchema).optional(),
    conversationKey: z.string().optional(),
  }),
  z.object({
    mode: z.literal("mood_ideas"),
    prompt: z.string().trim().min(1),
    ingredients: z.array(z.string()).optional(),
    exclude_titles: z.array(z.string()).optional(),
    batch_index: z.number().optional(),
    conversationHistory: z.array(aiMessageSchema).optional(),
    requested_count: z.number().optional(),
  }),
  z.object({
    mode: z.literal("ingredients_ideas"),
    prompt: z.string().optional(),
    ingredients: z.array(z.string()).min(1),
    exclude_titles: z.array(z.string()).optional(),
    batch_index: z.number().optional(),
    conversationHistory: z.array(aiMessageSchema).optional(),
    requested_count: z.number().optional(),
  }),
  z.object({
    mode: z.literal("filtered_ideas"),
    filters: z
      .object({
        cuisine: z.string().optional(),
        protein: z.string().optional(),
        mealType: z.string().optional(),
        cookingTime: z.string().optional(),
      })
      .optional(),
    requested_count: z.number().optional(),
  }),
  z.object({
    mode: z.literal("idea_recipe"),
    ideaTitle: z.string().trim().min(1),
    prompt: z.string().optional(),
    ingredients: z.array(z.string()).optional(),
    conversationHistory: z.array(aiMessageSchema).optional(),
    conversationKey: z.string().optional(),
  }),
]);

export async function POST(request: Request) {
  let trackedAccess:
    | {
        supabase: Awaited<ReturnType<typeof import("@/lib/supabaseServer").createSupabaseServerClient>>;
        userId: string;
      }
    | null = null;
  try {
    const access = await requireAuthenticatedAiAccess({
      route: "home-hub",
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
    const userTasteSummary = await buildUserTasteSummary(access.supabase as any, access.userId);

    let body;
    try {
      body = homeAiRequestSchema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: true, message: "Unsupported AI mode." }, { status: 400 });
    }

    if (body.mode === "chef_chat") {
      const userMessage = body.userMessage?.trim();
      if (!userMessage || userMessage.length > 4000) {
        return NextResponse.json({ error: true, message: "userMessage is required" }, { status: 400 });
      }

      const topicGuard = guardCookingTopic({
        message: userMessage,
        recipeContext: body.recipeContext ?? null,
      });

      if (!topicGuard.allowed) {
        void trackServerEvent(access.supabase, access.userId, "ai_topic_guard_blocked", {
          route: "home-hub",
          mode: body.mode,
          user_message_length: userMessage.length,
        });
        return NextResponse.json({ mode: "refine", reply: COOKING_SCOPE_MESSAGE, options: [], recommended_option_id: null });
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

      const taskSetting = await resolveAiTaskSettings("chef_chat");
      if (!taskSetting.enabled) {
        return NextResponse.json({ error: true, message: "Chef chat is currently disabled." }, { status: 503 });
      }

      const result = await chefChat(
        userMessage,
        body.recipeContext ?? null,
        conversationHistory,
        userTasteSummary,
        taskSetting
      );

      const envelope = result.envelope;

      if (typeof body.conversationKey === "string" && body.conversationKey.trim().length > 0) {
        const conversationKey = body.conversationKey.trim();
        void storeConversationTurns(access.supabase as any, {
          ownerId: access.userId,
          conversationKey,
          scope: "home_hub",
          turns: [
            {
              role: "user",
              message: userMessage,
            },
            {
              role: "assistant",
              message: envelope.reply,
              metadata_json: envelope.options.length > 0 ? envelope : null,
            },
          ],
        });
        void upsertCookingBrief(access.supabase as any, {
          ownerId: access.userId,
          conversationKey,
          scope: "home_hub",
          brief: compileCookingBrief({
            userMessage,
            assistantReply: envelope.reply,
            conversationHistory,
            recipeContext: body.recipeContext ?? null,
          }),
        });
      }

      if (result.repaired) {
        void trackServerEvent(access.supabase, access.userId, "chef_chat_repaired", {
          route: "home-hub",
          provider: result.provider,
          finish_reason: result.finishReason ?? null,
          user_message_length: userMessage.length,
          initial_reply_length: result.initialReply.trim().length,
          final_reply_length: envelope.reply.trim().length,
          conversation_turns: conversationHistory.length,
        });
      }

      return NextResponse.json(envelope);
    }

    if (body.mode === "mood_ideas" || body.mode === "ingredients_ideas") {
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : undefined;
      const ingredients = Array.isArray(body.ingredients)
        ? body.ingredients.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
        : undefined;
      const conversationHistory = Array.isArray(body.conversationHistory)
        ? body.conversationHistory.filter(
            (message): message is AIMessage =>
              Boolean(message) &&
              (message.role === "user" || message.role === "assistant") &&
              typeof message.content === "string" &&
              message.content.trim().length > 0
          )
        : undefined;

      if (body.mode === "ingredients_ideas" && (!ingredients || ingredients.length === 0)) {
        return NextResponse.json({ error: true, message: "ingredients are required" }, { status: 400 });
      }

      if (body.mode === "mood_ideas" && !prompt) {
        return NextResponse.json({ error: true, message: "prompt is required" }, { status: 400 });
      }

      const ideas = await generateHomeIdeasWithCache({
        mode: body.mode,
        prompt,
        ingredients,
        excludeTitles: Array.isArray(body.exclude_titles) ? body.exclude_titles : [],
        batchIndex: typeof body.batch_index === "number" ? body.batch_index : 1,
        conversationHistory,
        requestedCount: typeof body.requested_count === "number" ? body.requested_count : undefined,
      }, userTasteSummary, {
        supabase: access.supabase as any,
        userId: access.userId,
      });

      return NextResponse.json({ ideas });
    }

    if (body.mode === "filtered_ideas") {
      const ideas = await generateHomeIdeasWithCache({
        mode: "filtered_ideas",
        filters: body.filters,
        requestedCount: typeof body.requested_count === "number" ? body.requested_count : undefined,
      }, userTasteSummary, {
        supabase: access.supabase as any,
        userId: access.userId,
      });
      return NextResponse.json({ ideas });
    }

    if (body.mode === "idea_recipe") {
      const ideaTitle = body.ideaTitle?.trim();
      if (!ideaTitle) {
        return NextResponse.json({ error: true, message: "ideaTitle is required" }, { status: 400 });
      }

      const conversationKey = typeof body.conversationKey === "string" && body.conversationKey.trim().length > 0
        ? body.conversationKey.trim()
        : null;
      const persistedBrief = conversationKey
        ? await getCookingBrief(access.supabase as any, {
            ownerId: access.userId,
            conversationKey,
            scope: "home_hub",
          })
        : null;
      const requestStartedAt = new Date().toISOString();
      const resolvedIdeaTitle = persistedBrief?.brief_json?.dish?.normalized_name?.trim() || ideaTitle;
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : undefined;
      const ingredients = Array.isArray(body.ingredients)
        ? body.ingredients.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
        : undefined;
      const conversationHistory = Array.isArray(body.conversationHistory)
        ? body.conversationHistory.filter(
            (message): message is AIMessage =>
              Boolean(message) &&
              (message.role === "user" || message.role === "assistant") &&
                typeof message.content === "string" &&
                message.content.trim().length > 0
          )
        : undefined;
      const effectiveBrief =
        persistedBrief?.brief_json ??
        compileCookingBrief({
          userMessage: prompt || ideaTitle,
          conversationHistory,
          recipeContext: {
            title: ideaTitle,
            ingredients,
          },
        });
      const briefCompiledAt = new Date().toISOString();
      const planStartedAt = new Date().toISOString();
      const recipePlan = buildRecipePlanFromBrief(effectiveBrief);
      const generateStartedAt = new Date().toISOString();
      let attemptNumber = 1;
      const stageMetrics = [
        createAiStageMetric("brief_compile", {
          started_at: requestStartedAt,
          completed_at: briefCompiledAt,
          cache_status: persistedBrief ? "hit" : "miss",
        }),
        createAiStageMetric("recipe_plan", {
          started_at: planStartedAt,
          completed_at: generateStartedAt,
        }),
      ];
      let retryStrategy: "regenerate_same_model" | "regenerate_stricter" = "regenerate_stricter";
      let retryReasons: string[] = [];

      try {
        let activeRecipePlan = recipePlan;
        let result = null;
        let verification = null;

        while (!result) {
          const attemptGenerateStartedAt = new Date().toISOString();
          try {
            const attemptResult = await generateHomeRecipe({
              ideaTitle: effectiveBrief.dish.normalized_name?.trim() || resolvedIdeaTitle,
              prompt,
              ingredients,
              conversationHistory,
              cookingBrief: effectiveBrief,
              recipePlan: activeRecipePlan,
              retryContext:
                attemptNumber > 1
                  ? {
                      attemptNumber,
                      retryStrategy,
                      reasons: retryReasons,
                    }
                  : null,
            }, userTasteSummary, {
              supabase: access.supabase as any,
              userId: access.userId,
            });
            const verifyStartedAt = new Date().toISOString();
            const attemptVerification = verifyRecipeAgainstBrief({
              brief: effectiveBrief,
              recipe: attemptResult.recipe,
              fallbackContext: `${resolvedIdeaTitle} ${prompt ?? ""}`,
            });
            const completedAt = new Date().toISOString();
            stageMetrics.push(
              createAiStageMetric("recipe_generate", {
                started_at: attemptGenerateStartedAt,
                completed_at: verifyStartedAt,
                input_tokens: attemptResult.meta.input_tokens,
                output_tokens: attemptResult.meta.output_tokens,
                estimated_cost_usd: attemptResult.meta.estimated_cost_usd,
                provider: attemptResult.meta.provider,
                model: attemptResult.meta.model,
              }),
              createAiStageMetric("recipe_verify", {
                started_at: verifyStartedAt,
                completed_at: completedAt,
                provider: attemptResult.meta.provider,
                model: attemptResult.meta.model,
              })
            );
            result = attemptResult;
            verification = attemptVerification;
            activeRecipePlan = activeRecipePlan;
          } catch (error) {
            const failure = getRecipeBuildFailureDetails(error, "Recipe generation failed.");
            const attemptCompletedAt = new Date().toISOString();
            stageMetrics.push(
              createAiStageMetric("recipe_generate", {
                started_at: attemptGenerateStartedAt,
                completed_at: attemptCompletedAt,
              }),
              createAiStageMetric("recipe_verify", {
                started_at: attemptCompletedAt,
                completed_at: attemptCompletedAt,
              })
            );

            if (shouldAutoRetryRecipeBuild(failure.retryStrategy, attemptNumber)) {
              attemptNumber += 1;
              retryStrategy = failure.retryStrategy as "regenerate_same_model" | "regenerate_stricter";
              retryReasons = failure.reasons;
              const retryPlanStartedAt = new Date().toISOString();
              activeRecipePlan = buildRetryRecipePlan(activeRecipePlan, {
                retryStrategy: failure.retryStrategy,
                reasons: failure.reasons,
                attemptNumber,
              });
              const retryGenerateStartedAt = new Date().toISOString();
              stageMetrics.push(
                createAiStageMetric("recipe_plan", {
                  started_at: retryPlanStartedAt,
                  completed_at: retryGenerateStartedAt,
                })
              );
              continue;
            }

            throw error;
          }
        }

        if (!result || !verification) {
          throw new Error("Recipe build loop completed without a verified result.");
        }

        if (conversationKey) {
          void storeGenerationAttempt(access.supabase as any, {
            ownerId: access.userId,
            conversationKey,
            scope: "home_hub",
            requestMode: persistedBrief?.brief_json?.request_mode ?? "generate",
            stateBefore: persistedBrief?.is_locked ? "direction_locked" : "ready_for_recipe",
            stateAfter: "recipe_generated",
            attempt: {
              conversation_snapshot: (conversationHistory ?? []).map((message) => `${message.role}: ${message.content}`).join("\n"),
              cooking_brief: effectiveBrief,
              recipe_plan: recipePlan,
              generator_input: {
                ideaTitle: effectiveBrief.dish.normalized_name?.trim() || resolvedIdeaTitle,
                prompt: prompt ?? null,
                ingredients: ingredients ?? [],
              },
              raw_model_output: result,
              normalized_recipe: result.recipe,
              verification,
              attempt_number: attemptNumber,
              provider: result.meta.provider,
              model: result.meta.model,
              outcome: verification.passes ? "passed" : "failed_verification",
              stage_metrics: stageMetrics,
            },
          });
        }

        return NextResponse.json({ result });
      } catch (error) {
        const failure = getRecipeBuildFailureDetails(error, "Recipe generation failed.");
        if (conversationKey) {
          void storeGenerationAttempt(access.supabase as any, {
            ownerId: access.userId,
            conversationKey,
            scope: "home_hub",
            requestMode: persistedBrief?.brief_json?.request_mode ?? "generate",
            stateBefore: persistedBrief?.is_locked ? "direction_locked" : "ready_for_recipe",
            stateAfter: "ready_for_recipe",
            attempt: {
              conversation_snapshot: (conversationHistory ?? []).map((message) => `${message.role}: ${message.content}`).join("\n"),
              cooking_brief: effectiveBrief,
              recipe_plan: recipePlan,
              generator_input: {
                ideaTitle: effectiveBrief.dish.normalized_name?.trim() || resolvedIdeaTitle,
                prompt: prompt ?? null,
                ingredients: ingredients ?? [],
              },
              raw_model_output: null,
              normalized_recipe: null,
              verification: failure.verification ?? createFailedVerificationResult(failure.message, failure.retryStrategy),
              attempt_number: attemptNumber,
              provider: null,
              model: null,
              outcome: failure.outcome,
              stage_metrics: stageMetrics,
            },
          });
        }
        throw error;
      }
    }

    return NextResponse.json({ error: true, message: "Unsupported AI mode." }, { status: 400 });
  } catch (error) {
    console.error("Home AI route failed", error);
    if (trackedAccess) {
      void trackServerEvent(trackedAccess.supabase, trackedAccess.userId, "ai_route_failed", {
        route: "home-hub",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return NextResponse.json(
      {
        error: true,
        message: "Home AI request failed. Please try again.",
      },
      { status: 500 }
    );
  }
}

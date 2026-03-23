import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { getCachedUserTasteSummary } from "@/lib/ai/userTasteProfile";
import type { AIMessage } from "@/lib/ai/chatPromptBuilder";
import { getCookingBrief } from "@/lib/ai/briefStore";
import { compileCookingBrief } from "@/lib/ai/briefCompiler";
import { generateHomeRecipe } from "@/lib/ai/homeHub";
import { storeGenerationAttempt } from "@/lib/ai/generationAttemptStore";
import { createAiStageMetric } from "@/lib/ai/contracts/stageMetrics";
import { createFailedVerificationResult } from "@/lib/ai/contracts/verificationResult";
import { verifyRecipeAgainstBrief } from "@/lib/ai/recipeVerifier";
import { buildRecipePlanFromBrief } from "@/lib/ai/recipePlanner";
import type { CookingBrief } from "@/lib/ai/contracts/cookingBrief";
import type { RecipePlan } from "@/lib/ai/contracts/recipePlan";
import { getRecipeBuildFailureDetails, RecipeBuildError, type RecipeBuildFailureKind } from "@/lib/ai/recipeBuildError";
import type { VerificationRetryStrategy } from "@/lib/ai/contracts/verificationResult";
import { buildRetryRecipePlan, shouldAutoRetryRecipeBuild } from "@/lib/ai/homeRecipeRetry";
import { buildLockedBrief, markLockedSessionBuilt } from "@/lib/ai/lockedSession";
import { getLockedDirectionSession, upsertLockedDirectionSession } from "@/lib/ai/lockedSessionStore";
import type { LockedDirectionSession } from "@/lib/ai/contracts/lockedDirectionSession";
import { resolveAiTaskSettings } from "@/lib/ai/taskSettings";

const aiMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const lockedSessionSchema = z.object({
  conversation_key: z.string(),
  state: z.enum(["exploring", "direction_locked", "ready_to_build", "building", "built"]),
  selected_direction: z
    .object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      tags: z.array(z.string()),
    })
    .nullable(),
  refinements: z.array(
    z.object({
      user_text: z.string(),
      assistant_text: z.string().nullable(),
      confidence: z.number(),
      ambiguity_reason: z.string().nullable(),
      extracted_changes: z.object({
        required_ingredients: z.array(z.string()),
        preferred_ingredients: z.array(z.string()),
        forbidden_ingredients: z.array(z.string()),
        style_tags: z.array(z.string()),
        notes: z.array(z.string()),
      }),
      field_state: z.object({
        ingredients: z.enum(["locked", "inferred", "unknown"]),
        style: z.enum(["locked", "inferred", "unknown"]),
        notes: z.enum(["locked", "inferred", "unknown"]),
      }),
    })
  ),
  brief_snapshot: z.any().nullable(),
});

const buildRequestSchema = z.object({
  ideaTitle: z.string().trim().min(1),
  prompt: z.string().optional(),
  ingredients: z.array(z.string()).optional(),
  conversationHistory: z.array(aiMessageSchema).optional(),
  conversationKey: z.string().optional(),
  lockedSession: lockedSessionSchema.optional(),
});

type StreamEvent =
  | { type: "status"; message: string }
  | { type: "result"; result: unknown }
  | { type: "debug"; label: string; data: Record<string, unknown> }
  | {
      type: "error";
      message: string;
      failure_kind?: RecipeBuildFailureKind;
      retry_strategy?: VerificationRetryStrategy;
      model?: string;
      reasons?: string[];
    };

function eventLine(event: StreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: Request) {
  const access = await requireAuthenticatedAiAccess({
    route: "home-hub-build",
    maxRequests: 20,
    windowMs: 5 * 60 * 1000,
  });

  if (access.errorResponse) {
    return access.errorResponse;
  }

  // Start taste profile lookup in parallel with request body parsing.
  const tasteSummaryPromise = getCachedUserTasteSummary(access.supabase as SupabaseClient, access.userId);

  let body;
  try {
    body = buildRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Unsupported build payload." }, { status: 400 });
  }

  const userTasteSummary = await tasteSummaryPromise;
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
  const conversationKey = typeof body.conversationKey === "string" && body.conversationKey.trim().length > 0
    ? body.conversationKey.trim()
    : null;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(eventLine(event)));
      const requestStartedAt = new Date().toISOString();
      let effectiveBrief: CookingBrief | null = null;
      let recipePlan: RecipePlan | null = null;
      let briefCompiledAt = requestStartedAt;
      let generateStartedAt = requestStartedAt;
      let planStartedAt = requestStartedAt;
      let verifyStartedAt: string | null = null;
      let attemptNumber = 1;
      const stageMetrics = [];
      let retryStrategy: VerificationRetryStrategy = "regenerate_stricter";
      let retryReasons: string[] = [];
      let lastAttemptModel: string | undefined;
      let resolvedTaskPrimaryModel: string | undefined;

      try {
        send({ type: "status", message: "Understanding your request..." });
        // Kick off task settings lookup in parallel with brief/session reads —
        // it doesn't depend on either and is needed just before generation.
        const taskSettingPromise = resolveAiTaskSettings("home_recipe");
        const [persistedBrief, persistedSession] = await Promise.all([
          conversationKey
            ? getCookingBrief(access.supabase as SupabaseClient, {
                ownerId: access.userId,
                conversationKey,
                scope: "home_hub",
              })
            : Promise.resolve(null),
          conversationKey
            ? getLockedDirectionSession(access.supabase as SupabaseClient, {
                ownerId: access.userId,
                conversationKey,
                scope: "home_hub",
              })
            : Promise.resolve(null),
        ]);
        const lockedSession: LockedDirectionSession | null = body.lockedSession ?? persistedSession?.session_json ?? null;
        // Use the persisted (locked) brief when available — it was compiled from
        // the full conversation at lock time and should not be recompiled from
        // the current prompt, which may have slightly different phrasing.
        const compiledBrief = (persistedBrief?.is_locked && !lockedSession?.selected_direction)
          ? persistedBrief.brief_json
          : compileCookingBrief({
              userMessage: prompt || body.ideaTitle,
              conversationHistory,
              recipeContext: {
                title: body.ideaTitle,
                ingredients,
              },
              lockedSessionState: lockedSession?.state ?? null,
            });
        effectiveBrief = lockedSession?.selected_direction
          ? buildLockedBrief({
              session: lockedSession,
              conversationHistory,
            })
          : compiledBrief;
        briefCompiledAt = new Date().toISOString();
        send({
          type: "debug",
          label: "brief",
          data: {
            normalized_name: effectiveBrief.dish.normalized_name ?? null,
            dish_family: effectiveBrief.dish.dish_family ?? null,
            centerpiece: effectiveBrief.ingredients.centerpiece ?? null,
            required: effectiveBrief.ingredients.required,
            forbidden: effectiveBrief.ingredients.forbidden,
            style_tags: [...effectiveBrief.style.tags, ...effectiveBrief.style.texture_tags, ...effectiveBrief.style.format_tags].filter(Boolean),
            confidence: effectiveBrief.confidence,
          },
        });
        const resolvedIdeaTitle = effectiveBrief.dish.normalized_name?.trim() || body.ideaTitle.trim();
        planStartedAt = new Date().toISOString();
        send({ type: "status", message: "Planning the recipe..." });
        recipePlan = buildRecipePlanFromBrief(effectiveBrief);
        generateStartedAt = new Date().toISOString();
        stageMetrics.push(
          createAiStageMetric("brief_compile", {
            started_at: requestStartedAt,
            completed_at: briefCompiledAt,
            cache_status: persistedBrief ? "hit" : "miss",
          }),
          createAiStageMetric("recipe_plan", {
            started_at: planStartedAt,
            completed_at: generateStartedAt,
          })
        );

        let activeRecipePlan = recipePlan;
        let result = null;
        let verification = null;
        const taskSetting = await taskSettingPromise;
        resolvedTaskPrimaryModel = taskSetting.primaryModel;
        let modelOverride: string | undefined;

        while (!result) {
          const attemptGenerateStartedAt = new Date().toISOString();
          try {
            const attemptResult = await generateHomeRecipe(
              {
                ideaTitle: resolvedIdeaTitle,
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
                        modelOverride,
                      }
                    : null,
              },
              userTasteSummary,
              {
                supabase: access.supabase as SupabaseClient,
                userId: access.userId,
              },
              (_, message) => {
                send({ type: "status", message });
              }
            );

            verifyStartedAt = new Date().toISOString();
            const attemptVerification = verifyRecipeAgainstBrief({
              brief: effectiveBrief,
              recipe: attemptResult.recipe,
              fallbackContext: `${resolvedIdeaTitle} ${prompt ?? ""}`,
            });
            if (!attemptVerification.passes) {
              throw new RecipeBuildError({
                message: attemptVerification.reasons[0] ?? "Recipe failed verification.",
                kind: "verification_failed",
                verification: attemptVerification,
                retryStrategy: attemptVerification.retry_strategy,
                reasons: attemptVerification.reasons,
              });
            }
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
            recipePlan = activeRecipePlan;
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

            // Escalate same-model failures on attempt 2 to try the fallback model
            const effectiveStrategy =
              !shouldAutoRetryRecipeBuild(failure.retryStrategy, attemptNumber) &&
              (failure.retryStrategy === "regenerate_same_model" || failure.retryStrategy === "regenerate_stricter") &&
              taskSetting.fallbackModel
                ? "try_fallback_model"
                : failure.retryStrategy;

            if (shouldAutoRetryRecipeBuild(effectiveStrategy, attemptNumber) && activeRecipePlan) {
              lastAttemptModel = modelOverride ?? taskSetting.primaryModel;
              send({
                type: "debug",
                label: "attempt_failed",
                data: {
                  attempt: attemptNumber,
                  kind: failure.kind,
                  strategy: effectiveStrategy,
                  model: lastAttemptModel,
                  reasons: failure.reasons,
                  checks: failure.verification?.checks ?? null,
                },
              });
              attemptNumber += 1;
              retryStrategy = effectiveStrategy as "regenerate_same_model" | "regenerate_stricter" | "try_fallback_model";
              retryReasons = failure.reasons;

              if (effectiveStrategy === "try_fallback_model") {
                modelOverride = taskSetting.fallbackModel ?? undefined;
                send({ type: "status", message: "Trying a different approach..." });
              } else {
                send({ type: "status", message: "Retrying..." });
              }

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
          if (lockedSession?.selected_direction) {
            void upsertLockedDirectionSession(access.supabase as SupabaseClient, {
              ownerId: access.userId,
              conversationKey,
              scope: "home_hub",
              session: markLockedSessionBuilt(lockedSession, effectiveBrief),
            }).catch((e) => console.error("upsertLockedDirectionSession failed", e));
          }
          void storeGenerationAttempt(access.supabase as SupabaseClient, {
            ownerId: access.userId,
            conversationKey,
            scope: "home_hub",
            requestMode: effectiveBrief.request_mode,
            stateBefore: lockedSession?.selected_direction ? lockedSession.state : "ready_for_recipe",
            stateAfter: lockedSession?.selected_direction ? "built" : "recipe_generated",
            attempt: {
              conversation_snapshot: (conversationHistory ?? []).map((message) => `${message.role}: ${message.content}`).join("\n"),
              cooking_brief: effectiveBrief,
              recipe_plan: recipePlan,
              generator_input: {
                ideaTitle: resolvedIdeaTitle,
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

        send({ type: "status", message: "Recipe is ready." });
        send({ type: "result", result });
      } catch (error) {
        const failure = getRecipeBuildFailureDetails(error, "Recipe generation failed.");
        if (conversationKey) {
          void storeGenerationAttempt(access.supabase as SupabaseClient, {
            ownerId: access.userId,
            conversationKey,
            scope: "home_hub",
            requestMode: "generate",
            stateBefore: "ready_for_recipe",
            stateAfter: "ready_for_recipe",
            attempt: {
              conversation_snapshot: (conversationHistory ?? []).map((message) => `${message.role}: ${message.content}`).join("\n"),
              cooking_brief: effectiveBrief ?? compileCookingBrief({
                userMessage: prompt || body.ideaTitle,
                conversationHistory,
              }),
              recipe_plan: recipePlan,
              generator_input: {
                ideaTitle: body.ideaTitle,
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
              stage_metrics: stageMetrics.length > 0 ? stageMetrics : [
                createAiStageMetric("brief_compile", {
                  started_at: requestStartedAt,
                  completed_at: effectiveBrief ? briefCompiledAt : null,
                  cache_status: conversationKey ? "miss" : "not_applicable",
                }),
              ],
            },
          });
        }
        send({
          type: "debug",
          label: "terminal_failure",
          data: {
            attempt: attemptNumber,
            kind: failure.kind,
            strategy: failure.retryStrategy,
            model: lastAttemptModel ?? resolvedTaskPrimaryModel,
            reasons: failure.reasons,
            checks: failure.verification?.checks ?? null,
          },
        });
        send({
          type: "error",
          message: failure.message,
          failure_kind: failure.kind,
          retry_strategy: failure.retryStrategy,
          model: lastAttemptModel ?? resolvedTaskPrimaryModel,
          reasons: failure.reasons,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

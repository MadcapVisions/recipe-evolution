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
import { normalizeBuildSpec } from "@/lib/ai/contracts/buildSpec";
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
  // Invalid or partial objects (e.g. stale client, empty {}) fall back to null via .catch(null)
  // so the session degrades to legacy reconstruction rather than throwing a 500.
  build_spec: z
    .object({
      dish_family: z.string().nullable(),
      display_title: z.string(),
      build_title: z.string(),
      primary_anchor_type: z.enum(["dish", "protein", "ingredient", "format"]).nullable(),
      primary_anchor_value: z.string().nullable(),
      required_ingredients: z.array(z.string()),
      forbidden_ingredients: z.array(z.string()),
      style_tags: z.array(z.string()),
      must_preserve_format: z.boolean(),
      confidence: z.number(),
      derived_at: z.literal("lock_time"),
      dish_family_source: z.enum(["model", "inferred"]).optional().default("inferred"),
      anchor_source: z.enum(["model", "inferred", "none"]).optional().default("none"),
    })
    .nullable()
    .optional()
    .catch(null),
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
  | { type: "status"; message: string; stage?: string }
  | { type: "result"; result: unknown }
  | { type: "debug"; label: string; data: Record<string, unknown> }
  | {
      type: "error";
      message: string;
      failure_kind?: RecipeBuildFailureKind;
      failure_stage?: string | null;
      retry_strategy?: VerificationRetryStrategy;
      model?: string;
      reasons?: string[];
      failure_context?: Record<string, unknown> | null;
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
      let currentAttemptModel: string | undefined;
      let resolvedTaskPrimaryModel: string | undefined;
      let terminalFailureStored = false;

      try {
        send({ type: "status", message: "Understanding your request...", stage: "brief_compile" });
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
        // Normalize build_spec: malformed/stale objects become null so the session
        // falls back to legacy reconstruction rather than crashing the fast path.
        const rawSession = body.lockedSession ?? persistedSession?.session_json ?? null;
        const lockedSession: LockedDirectionSession | null = rawSession
          ? { ...rawSession, build_spec: normalizeBuildSpec(rawSession.build_spec) }
          : null;
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
        const briefSource = lockedSession?.selected_direction
          ? (lockedSession.build_spec ? "build_spec" : "reconstructed")
          : "compiled";
        send({
          type: "debug",
          label: "brief",
          data: {
            normalized_name: effectiveBrief.dish.normalized_name ?? null,
            dish_family: effectiveBrief.dish.dish_family ?? null,
            centerpiece: effectiveBrief.ingredients.centerpiece ?? null,
            required: effectiveBrief.ingredients.required,
            dish_family_source: lockedSession?.build_spec?.dish_family_source ?? null,
            anchor_source: lockedSession?.build_spec?.anchor_source ?? null,
            forbidden: effectiveBrief.ingredients.forbidden,
            style_tags: [...effectiveBrief.style.tags, ...effectiveBrief.style.texture_tags, ...effectiveBrief.style.format_tags].filter(Boolean),
            confidence: effectiveBrief.confidence,
            brief_source: briefSource,
          },
        });
        const resolvedIdeaTitle = effectiveBrief.dish.normalized_name?.trim() || body.ideaTitle.trim();
        planStartedAt = new Date().toISOString();
        send({ type: "status", message: "Planning the recipe...", stage: "recipe_plan" });
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
          let attemptOutlineStartedAt: string | null = null;
          let attemptRecipeGenerateStartedAt: string | null = null;
          let attemptRecipeVerifyStartedAt: string | null = null;
          currentAttemptModel = modelOverride ?? taskSetting.primaryModel;
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
              (stage, message) => {
                const now = new Date().toISOString();
                if (stage === "recipe_outline" && !attemptOutlineStartedAt) {
                  attemptOutlineStartedAt = now;
                }
                if (stage === "recipe_generate" && !attemptRecipeGenerateStartedAt) {
                  attemptRecipeGenerateStartedAt = now;
                }
                if (stage === "recipe_verify" && !attemptRecipeVerifyStartedAt) {
                  attemptRecipeVerifyStartedAt = now;
                }
                send({ type: "status", message, stage });
              }
            );

            verifyStartedAt = attemptRecipeVerifyStartedAt ?? new Date().toISOString();
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
              createAiStageMetric("recipe_outline", {
                started_at: attemptOutlineStartedAt ?? attemptGenerateStartedAt,
                completed_at: attemptRecipeGenerateStartedAt ?? verifyStartedAt,
                provider: attemptResult.meta.provider,
                model: attemptResult.meta.model,
              }),
              createAiStageMetric("recipe_generate", {
                started_at: attemptRecipeGenerateStartedAt ?? attemptGenerateStartedAt,
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
              createAiStageMetric("recipe_outline", {
                started_at: attemptOutlineStartedAt ?? attemptGenerateStartedAt,
                completed_at: attemptRecipeGenerateStartedAt ?? attemptCompletedAt,
              }),
              createAiStageMetric("recipe_generate", {
                started_at: attemptRecipeGenerateStartedAt ?? attemptGenerateStartedAt,
                completed_at: attemptRecipeVerifyStartedAt ?? attemptCompletedAt,
              }),
              createAiStageMetric("recipe_verify", {
                started_at: attemptRecipeVerifyStartedAt ?? attemptCompletedAt,
                completed_at: attemptCompletedAt,
              })
            );

            if (conversationKey) {
              void storeGenerationAttempt(access.supabase as SupabaseClient, {
                ownerId: access.userId,
                conversationKey,
                scope: "home_hub",
                requestMode: effectiveBrief?.request_mode ?? "generate",
                stateBefore: lockedSession?.selected_direction ? lockedSession.state : "ready_for_recipe",
                stateAfter: lockedSession?.selected_direction ? lockedSession.state : "ready_for_recipe",
                attempt: {
                  conversation_snapshot: (conversationHistory ?? []).map((message) => `${message.role}: ${message.content}`).join("\n"),
                  cooking_brief: effectiveBrief ?? compileCookingBrief({
                    userMessage: prompt || body.ideaTitle,
                    conversationHistory,
                  }),
                  recipe_plan: activeRecipePlan,
                  generator_input: {
                    ideaTitle: resolvedIdeaTitle,
                    prompt: prompt ?? null,
                    ingredients: ingredients ?? [],
                    recipe_outline: null,
                    outline_source: null,
                  },
                  raw_model_output: failure.rawModelOutput,
                  normalized_recipe: failure.normalizedRecipe,
                  verification: failure.verification ?? createFailedVerificationResult(failure.message, failure.retryStrategy),
                  attempt_number: attemptNumber,
                  provider: failure.provider ?? null,
                  model: failure.model ?? currentAttemptModel ?? null,
                  outcome: failure.outcome,
                  stage_metrics: stageMetrics,
                },
              });
            }

            // Escalate same-model failures on attempt 2 to try the fallback model
            const effectiveStrategy =
              !shouldAutoRetryRecipeBuild(failure.retryStrategy, attemptNumber) &&
              (failure.retryStrategy === "regenerate_same_model" || failure.retryStrategy === "regenerate_stricter") &&
              taskSetting.fallbackModel
                ? "try_fallback_model"
                : failure.retryStrategy;

            if (shouldAutoRetryRecipeBuild(effectiveStrategy, attemptNumber) && activeRecipePlan) {
              lastAttemptModel = currentAttemptModel;
              // If retries keep failing with brief_source=reconstructed, the root cause is
              // a missing BuildSpec — the model is being retried from an unstable spec.
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
                  failure_stage: failure.failureStage,
                  failure_context: failure.failureContext,
                  brief_source: briefSource,
                  spec_stable: briefSource === "build_spec",
                },
              });
              attemptNumber += 1;
              retryStrategy = effectiveStrategy as "regenerate_same_model" | "regenerate_stricter" | "try_fallback_model";
              retryReasons = failure.reasons;

              if (effectiveStrategy === "try_fallback_model") {
                modelOverride = taskSetting.fallbackModel ?? undefined;
                send({ type: "status", message: "Trying a different approach...", stage: "recipe_generate" });
              } else {
                send({ type: "status", message: "Retrying...", stage: "recipe_generate" });
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

            terminalFailureStored = true;
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
                recipe_outline: result.recipe.ai_metadata_json && typeof result.recipe.ai_metadata_json === "object"
                  ? (result.recipe.ai_metadata_json as { recipe_outline?: unknown }).recipe_outline ?? null
                  : null,
                outline_source: result.recipe.ai_metadata_json && typeof result.recipe.ai_metadata_json === "object"
                  ? (result.recipe.ai_metadata_json as { outline_source?: unknown }).outline_source ?? null
                  : null,
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

        send({ type: "status", message: "Recipe is ready.", stage: "recipe_verify" });
        send({ type: "result", result });
      } catch (error) {
        const failure = getRecipeBuildFailureDetails(error, "Recipe generation failed.");
        if (conversationKey && !terminalFailureStored) {
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
                recipe_outline: null,
                outline_source: null,
              },
              raw_model_output: failure.rawModelOutput,
              normalized_recipe: failure.normalizedRecipe,
              verification: failure.verification ?? createFailedVerificationResult(failure.message, failure.retryStrategy),
              attempt_number: attemptNumber,
              provider: failure.provider ?? null,
              model: failure.model ?? currentAttemptModel ?? lastAttemptModel ?? null,
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
            model: currentAttemptModel ?? lastAttemptModel ?? resolvedTaskPrimaryModel,
            reasons: failure.reasons,
            checks: failure.verification?.checks ?? null,
            failure_stage: failure.failureStage,
            failure_context: failure.failureContext,
          },
        });
        send({
          type: "error",
          message: failure.message,
          failure_kind: failure.kind,
          failure_stage: failure.failureStage,
          retry_strategy: failure.retryStrategy,
          model: currentAttemptModel ?? lastAttemptModel ?? resolvedTaskPrimaryModel,
          reasons: failure.reasons,
          failure_context: failure.failureContext,
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

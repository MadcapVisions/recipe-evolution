import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { buildUserTasteSummary } from "@/lib/ai/userTasteProfile";
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
import { getRecipeBuildFailureDetails, type RecipeBuildFailureKind } from "@/lib/ai/recipeBuildError";
import type { VerificationRetryStrategy } from "@/lib/ai/contracts/verificationResult";
import { buildRetryRecipePlan, shouldAutoRetryRecipeBuild } from "@/lib/ai/homeRecipeRetry";

const aiMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const buildRequestSchema = z.object({
  ideaTitle: z.string().trim().min(1),
  prompt: z.string().optional(),
  ingredients: z.array(z.string()).optional(),
  conversationHistory: z.array(aiMessageSchema).optional(),
  conversationKey: z.string().optional(),
});

type StreamEvent =
  | { type: "status"; message: string }
  | { type: "result"; result: unknown }
  | {
      type: "error";
      message: string;
      failure_kind?: RecipeBuildFailureKind;
      retry_strategy?: VerificationRetryStrategy;
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

  let body;
  try {
    body = buildRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Unsupported build payload." }, { status: 400 });
  }

  const userTasteSummary = await buildUserTasteSummary(access.supabase as any, access.userId);
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

      try {
        send({ type: "status", message: "Understanding your request..." });
        const persistedBrief = conversationKey
          ? await getCookingBrief(access.supabase as any, {
              ownerId: access.userId,
              conversationKey,
              scope: "home_hub",
            })
          : null;
        effectiveBrief =
          persistedBrief?.brief_json ??
          compileCookingBrief({
            userMessage: prompt || body.ideaTitle,
            conversationHistory,
            recipeContext: {
              title: body.ideaTitle,
              ingredients,
            },
          });
        briefCompiledAt = new Date().toISOString();
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
                      }
                    : null,
              },
              userTasteSummary,
              {
                supabase: access.supabase as any,
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

            if (shouldAutoRetryRecipeBuild(failure.retryStrategy, attemptNumber) && activeRecipePlan) {
              attemptNumber += 1;
              retryStrategy = failure.retryStrategy as "regenerate_same_model" | "regenerate_stricter";
              retryReasons = failure.reasons;
              send({ type: "status", message: "Tightening the recipe constraints..." });
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
            requestMode: effectiveBrief.request_mode,
            stateBefore: persistedBrief?.is_locked ? "direction_locked" : "ready_for_recipe",
            stateAfter: "recipe_generated",
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
          void storeGenerationAttempt(access.supabase as any, {
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
          type: "error",
          message: failure.message,
          failure_kind: failure.kind,
          retry_strategy: failure.retryStrategy,
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

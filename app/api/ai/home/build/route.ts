import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { getCachedUserTasteSummary } from "@/lib/ai/userTasteProfile";
import type { AIMessage } from "@/lib/ai/chatPromptBuilder";
import { getCookingBrief } from "@/lib/ai/briefStore";
import { compileCookingBrief } from "@/lib/ai/briefCompiler";
import { getConversationTurns } from "@/lib/ai/conversationStore";
import { generateHomeRecipe } from "@/lib/ai/homeHub";
import { getLatestGenerationAttempt, storeGenerationAttempt } from "@/lib/ai/generationAttemptStore";
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
import { getFeatureFlag } from "@/lib/ai/featureFlags";
import { adjudicateRecipeFailure, applyFailureAdjudicationToBrief, buildCiaConstraintProvenance } from "@/lib/ai/failureAdjudicator";
import { storeCiaAdjudication } from "@/lib/ai/ciaStore";
import { orchestrateRecipeGeneration } from "@/lib/ai/recipeGenerationOrchestrator";
import { buildGenerationDeps } from "@/lib/ai/repairAdapters";
import { analyzeHomeBuildRequest, buildAttemptOrchestrationState } from "@/lib/ai/recipeOrchestrator";
import {
  mapToLaunchDecision,
  extractVerifierIssueCodes,
  extractFailureKindCode,
  type LaunchDecision,
} from "@/lib/ai/launchDecisionMapper";
import {
  createRunIssueCollector,
  collectIssueCodes,
  collectReasons,
} from "@/lib/ai/runIssueCollector";
import type { PreviousAttemptSnapshot } from "@/lib/ai/contracts/orchestrationState";
import { lockedSessionSchema } from "@/lib/ai/contracts/lockedDirectionSessionSchema";
import { mergeSessionConversationHistory } from "@/lib/ai/sessionContext";

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
  lockedSession: lockedSessionSchema.optional(),
  // Retry action modifiers (from graceful failure card buttons)
  retryMode: z.enum(["prioritize_required_ingredients", "simplify", "relax_required", "clarify"]).optional(),
  relaxRequiredNamedIngredients: z.array(z.string()).optional(),
  simplifyRequest: z.boolean().optional(),
});

type StreamEvent =
  | { type: "status"; message: string; stage?: string }
  | { type: "result"; result: unknown; launchDecision?: LaunchDecision }
  | { type: "debug"; label: string; data: Record<string, unknown> }
  | {
      type: "graceful_failure";
      message: string;
      failure_kind?: RecipeBuildFailureKind;
      failure_stage?: string | null;
      retry_strategy?: VerificationRetryStrategy;
      model?: string;
      reasons?: string[];
      failure_context?: Record<string, unknown> | null;
      launchDecision: LaunchDecision;
    }
  | {
      type: "error";
      message: string;
      failure_kind?: RecipeBuildFailureKind;
      failure_stage?: string | null;
      retry_strategy?: VerificationRetryStrategy;
      model?: string;
      reasons?: string[];
      failure_context?: Record<string, unknown> | null;
      launchDecision?: LaunchDecision;
    };

function eventLine(event: StreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

function latestDistilledIntents(session: LockedDirectionSession | null) {
  return session?.refinements.at(-1)?.distilled_intents ?? null;
}

function latestRefinementSummary(session: LockedDirectionSession | null) {
  const latest = session?.refinements.at(-1);
  if (!latest) {
    return null;
  }

  return {
    confidence: latest.confidence,
    ambiguity_reason: latest.ambiguity_reason,
    ambiguous_notes: latest.ambiguous_notes ?? [],
  };
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
  const retryMode = body.retryMode ?? null;
  const relaxIngredients: string[] = Array.isArray(body.relaxRequiredNamedIngredients)
    ? body.relaxRequiredNamedIngredients.filter((s): s is string => typeof s === "string")
    : [];
  const _simplifyRequest = body.simplifyRequest === true;
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
  const buildAnalysis = analyzeHomeBuildRequest({
    ideaTitle: body.ideaTitle,
    prompt,
    selectedDirectionLocked: body.lockedSession?.selected_direction != null,
    retryMode,
  });
  if (!buildAnalysis.canBuild) {
    return NextResponse.json({ error: true, message: buildAnalysis.reason ?? "Recipe build request is incomplete." }, { status: 400 });
  }

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
      let gracefulModeEnabled = false;
      let adjudicatorRetryUsed = false;
      let terminalFailureStored = false;
      let lockedSession: LockedDirectionSession | null = null;
      let effectiveConversationHistory: AIMessage[] = conversationHistory ?? [];
      let previousAttempt: PreviousAttemptSnapshot = null;
      const issueCollector = createRunIssueCollector();

      try {
        send({ type: "status", message: "Understanding your request...", stage: "brief_compile" });
        // Kick off task settings lookup in parallel with brief/session reads —
        // it doesn't depend on either and is needed just before generation.
        const taskSettingPromise = resolveAiTaskSettings("home_recipe");
        const ciaTaskSettingPromise = resolveAiTaskSettings("recipe_cia");
        const gracefulModePromise = getFeatureFlag("graceful_mode", false);
        const [persistedBrief, persistedSession, persistedTurns] = await Promise.all([
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
          conversationKey
            ? getConversationTurns(access.supabase as SupabaseClient, {
                ownerId: access.userId,
                conversationKey,
                scope: "home_hub",
              })
            : Promise.resolve([]),
        ]);
        previousAttempt = conversationKey
          ? await getLatestGenerationAttempt(access.supabase as SupabaseClient, {
              ownerId: access.userId,
              conversationKey,
              scope: "home_hub",
            })
          : null;
        effectiveConversationHistory = mergeSessionConversationHistory({
          persistedTurns,
          clientHistory: conversationHistory,
          maxMessages: 16,
        });
        // Normalize build_spec: malformed/stale objects become null so the session
        // falls back to legacy reconstruction rather than crashing the fast path.
        const rawSession = body.lockedSession ?? persistedSession?.session_json ?? null;
        lockedSession = rawSession
          ? { ...rawSession, build_spec: normalizeBuildSpec(rawSession.build_spec) }
          : null;
        // Use the persisted (locked) brief when available — it was compiled from
        // the full conversation at lock time and should not be recompiled from
        // the current prompt, which may have slightly different phrasing.
        const compiledBrief = (persistedBrief?.is_locked && !lockedSession?.selected_direction)
          ? persistedBrief.brief_json
          : compileCookingBrief({
              userMessage: prompt || body.ideaTitle,
              conversationHistory: effectiveConversationHistory,
              recipeContext: {
                title: body.ideaTitle,
                ingredients,
              },
              lockedSessionState: lockedSession?.state ?? null,
            });
        effectiveBrief = lockedSession?.selected_direction
          ? buildLockedBrief({
              session: lockedSession,
              conversationHistory: effectiveConversationHistory,
            })
          : compiledBrief;
        briefCompiledAt = new Date().toISOString();

        // Apply retry modifiers from graceful failure card actions
        if (relaxIngredients.length > 0 && effectiveBrief.ingredients.requiredNamedIngredients?.length) {
          effectiveBrief = {
            ...effectiveBrief,
            ingredients: {
              ...effectiveBrief.ingredients,
              requiredNamedIngredients: effectiveBrief.ingredients.requiredNamedIngredients.filter(
                (r) => !relaxIngredients.includes(r.normalizedName)
              ),
            },
          };
        }

        // Collect required named ingredient names for LaunchDecision
        for (const r of effectiveBrief.ingredients.requiredNamedIngredients ?? []) {
          if (!issueCollector.requiredNamedIngredientNames.includes(r.normalizedName)) {
            issueCollector.requiredNamedIngredientNames.push(r.normalizedName);
          }
        }

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
        let taskSetting;
        let ciaTaskSetting;
        [taskSetting, ciaTaskSetting, gracefulModeEnabled] = await Promise.all([
          taskSettingPromise,
          ciaTaskSettingPromise,
          gracefulModePromise,
        ]);
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
                conversationHistory: effectiveConversationHistory,
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
            if (
              !adjudicatorRetryUsed &&
              effectiveBrief &&
              (failure.kind === "verification_failed" || failure.kind === "invalid_payload")
            ) {
              const ciaPacket = {
                flow: "home_create",
                failureKind: failure.kind,
                userMessage: prompt ?? body.ideaTitle,
                conversationHistory: effectiveConversationHistory,
                selectedDirection: lockedSession?.selected_direction ?? null,
                cookingBrief: effectiveBrief,
                constraintProvenance: buildCiaConstraintProvenance({
                  flow: "home_create",
                  failureKind: failure.kind,
                  userMessage: prompt ?? body.ideaTitle,
                  conversationHistory: effectiveConversationHistory,
                  selectedDirection: lockedSession?.selected_direction ?? null,
                  cookingBrief: effectiveBrief,
                  recipeCandidate: failure.normalizedRecipe,
                  verification: failure.verification,
                  reasons: failure.reasons,
                  rawModelOutput: failure.rawModelOutput,
                }),
                recipeCandidate: failure.normalizedRecipe,
                verification: failure.verification,
                reasons: failure.reasons,
                rawModelOutput: failure.rawModelOutput,
              };
              const adjudication = await adjudicateRecipeFailure({
                flow: "home_create",
                taskSetting: ciaTaskSetting,
                failureKind: failure.kind,
                userMessage: prompt ?? body.ideaTitle,
                conversationHistory: effectiveConversationHistory,
                selectedDirection: lockedSession?.selected_direction ?? null,
                cookingBrief: effectiveBrief,
                recipeCandidate: failure.normalizedRecipe,
                verification: failure.verification,
                reasons: failure.reasons,
                rawModelOutput: failure.rawModelOutput,
              });
              await storeCiaAdjudication(access.supabase as SupabaseClient, {
                ownerId: access.userId,
                conversationKey,
                scope: "home_hub",
                flow: "home_create",
                taskKey: "recipe_cia",
                parentTaskKey: "home_recipe",
                failureKind: failure.kind,
                failureStage: failure.failureStage,
                model: ciaTaskSetting.primaryModel,
                provider: null,
                packet: ciaPacket,
                adjudication,
              });

              if (
                adjudication.decision === "sanitize_constraints" &&
                (adjudication.dropRequiredIngredients.length > 0 || adjudication.dropRequiredNamedIngredients.length > 0)
              ) {
                adjudicatorRetryUsed = true;
                effectiveBrief = applyFailureAdjudicationToBrief(effectiveBrief, adjudication);
                activeRecipePlan = buildRecipePlanFromBrief(effectiveBrief);
                recipePlan = activeRecipePlan;
                attemptNumber += 1;
                retryStrategy =
                  adjudication.retryStrategy === "regenerate_same_model" ||
                  adjudication.retryStrategy === "try_fallback_model"
                    ? adjudication.retryStrategy
                    : "regenerate_stricter";
                retryReasons = [adjudication.summary, ...failure.reasons];
                send({
                  type: "debug",
                  label: "failure_adjudicated",
                  data: {
                    decision: adjudication.decision,
                    summary: adjudication.summary,
                    confidence: adjudication.confidence,
                    dropped_required: adjudication.dropRequiredIngredients,
                    dropped_required_named: adjudication.dropRequiredNamedIngredients,
                  },
                });
                send({ type: "status", message: "Adjudicating the failure and retrying...", stage: "recipe_plan" });
                const retryPlanStartedAt = new Date().toISOString();
                const retryGenerateStartedAt = new Date().toISOString();
                stageMetrics.push(
                  createAiStageMetric("recipe_plan", {
                    started_at: retryPlanStartedAt,
                    completed_at: retryGenerateStartedAt,
                  })
                );
                continue;
              }
            }
            const effectiveStrategy =
              !shouldAutoRetryRecipeBuild(failure.retryStrategy, attemptNumber) &&
              (failure.retryStrategy === "regenerate_same_model" || failure.retryStrategy === "regenerate_stricter") &&
              taskSetting.fallbackModel
                ? "try_fallback_model"
                : failure.retryStrategy;
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
                  conversation_snapshot: effectiveConversationHistory.map((message) => `${message.role}: ${message.content}`).join("\n"),
                  cooking_brief: effectiveBrief ?? compileCookingBrief({
                    userMessage: prompt || body.ideaTitle,
                    conversationHistory: effectiveConversationHistory,
                  }),
                  recipe_plan: activeRecipePlan,
                  generator_input: {
                    ideaTitle: resolvedIdeaTitle,
                    prompt: prompt ?? null,
                    ingredients: ingredients ?? [],
                    refinement_summary: latestRefinementSummary(lockedSession),
                    distilled_intents: latestDistilledIntents(lockedSession),
                    recipe_outline: null,
                    outline_source: null,
                    orchestration_state: buildAttemptOrchestrationState({
                      flow: "home_hub_build",
                      action: "build_recipe",
                      intent: buildAnalysis.intent,
                      buildable: buildAnalysis.canBuild,
                      conversationKey,
                      attemptNumber,
                      requestMode: effectiveBrief?.request_mode ?? buildAnalysis.requestModeHint,
                      normalizedInstruction: buildAnalysis.normalizedBuildPrompt,
                      stateBefore: lockedSession?.selected_direction ? lockedSession.state : "ready_for_recipe",
                      stateAfter: lockedSession?.selected_direction ? lockedSession.state : "ready_for_recipe",
                      usedSessionRecovery: briefSource === "reconstructed",
                      usedFallbackModel: effectiveStrategy === "try_fallback_model",
                      failureStage: failure.failureStage,
                      retryStrategy: failure.retryStrategy,
                      recoveryActions: [effectiveStrategy],
                      reason: failure.message,
                      reasonCodes: failure.reasons,
                      model: failure.model ?? currentAttemptModel ?? null,
                      previousAttempt,
                      brief: effectiveBrief,
                    }),
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

            if (shouldAutoRetryRecipeBuild(effectiveStrategy, attemptNumber) && activeRecipePlan) {
              lastAttemptModel = currentAttemptModel;
              // Collect issues from this failed attempt
              if (failure.verification?.checks) {
                collectIssueCodes(issueCollector, extractVerifierIssueCodes(failure.verification.checks));
              }
              const fkCode = extractFailureKindCode(failure.kind);
              if (fkCode) collectIssueCodes(issueCollector, [fkCode]);
              collectReasons(issueCollector, failure.reasons);
              issueCollector.plannerRetries += 1;
              if (effectiveStrategy === "try_fallback_model") issueCollector.usedFallback = true;

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

            // Collect issues from terminal failure
            if (failure.verification?.checks) {
              collectIssueCodes(issueCollector, extractVerifierIssueCodes(failure.verification.checks));
            }
            const termFkCode = extractFailureKindCode(failure.kind);
            if (termFkCode) collectIssueCodes(issueCollector, [termFkCode]);
            collectReasons(issueCollector, failure.reasons);

            terminalFailureStored = true;
            throw error;
          }
        }

        if (!result || !verification) {
          throw new Error("Recipe build loop completed without a verified result.");
        }

        send({ type: "status", message: "Recipe is ready.", stage: "recipe_verify" });
        const successDecision = mapToLaunchDecision({
          issueCodes: issueCollector.codes,
          plannerRetries: issueCollector.plannerRetries,
          repairAttempts: issueCollector.repairAttempts,
          usedFallback: issueCollector.usedFallback,
          reasons: issueCollector.reasons,
          requiredNamedIngredientNames: issueCollector.requiredNamedIngredientNames,
        });
        send({ type: "result", result, launchDecision: successDecision });

        // Shadow: run new generation orchestrator fire-and-forget for all builds.
        // Does NOT affect the served result — used only to collect telemetry for comparison.
        void (async () => {
          try {
            const shadowAiOptions = {
              max_tokens: taskSetting.maxTokens,
              temperature: taskSetting.temperature,
              model: resolvedTaskPrimaryModel,
            };
            const shadowResult = await orchestrateRecipeGeneration(
              {
                userIntent: prompt ?? resolvedIdeaTitle,
                titleHint: resolvedIdeaTitle,
                dishHint: effectiveBrief.dish.dish_family ?? null,
                requiredNamedIngredients: effectiveBrief.ingredients.requiredNamedIngredients ?? [],
                dietaryConstraints: effectiveBrief.constraints.dietary_tags,
                availableIngredients: effectiveBrief.ingredients.required,
                preferredIngredients: effectiveBrief.ingredients.preferred,
                forbiddenIngredients: effectiveBrief.ingredients.forbidden,
                macroTargets: effectiveBrief.constraints.macroTargets ?? null,
                servings: effectiveBrief.constraints.servings ?? null,
                creativityMode: "safe",
                requestId: `shadow_${access.userId}_${Date.now()}`,
              },
              buildGenerationDeps(shadowAiOptions)
            );
            console.log("[shadow-orchestrator]", {
              status: shadowResult.status,
              success: shadowResult.success,
              dishFamily: shadowResult.dishFamily?.key ?? null,
              telemetry: shadowResult.telemetry.summary,
            });
          } catch {
            // shadow failure never affects the served result
          }
        })();

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
              conversation_snapshot: effectiveConversationHistory.map((message) => `${message.role}: ${message.content}`).join("\n"),
              cooking_brief: effectiveBrief,
              recipe_plan: recipePlan,
              generator_input: {
                ideaTitle: resolvedIdeaTitle,
                prompt: prompt ?? null,
                ingredients: ingredients ?? [],
                refinement_summary: latestRefinementSummary(lockedSession),
                distilled_intents: latestDistilledIntents(lockedSession),
                recipe_outline: result.recipe.ai_metadata_json && typeof result.recipe.ai_metadata_json === "object"
                  ? (result.recipe.ai_metadata_json as { recipe_outline?: unknown }).recipe_outline ?? null
                  : null,
                outline_source: result.recipe.ai_metadata_json && typeof result.recipe.ai_metadata_json === "object"
                  ? (result.recipe.ai_metadata_json as { outline_source?: unknown }).outline_source ?? null
                  : null,
                generation_path: result.recipe.ai_metadata_json && typeof result.recipe.ai_metadata_json === "object"
                  ? (result.recipe.ai_metadata_json as { generation_path?: unknown }).generation_path ?? null
                  : null,
                generation_details: result.recipe.ai_metadata_json && typeof result.recipe.ai_metadata_json === "object"
                  ? (result.recipe.ai_metadata_json as { generation_details?: unknown }).generation_details ?? null
                  : null,
                orchestration_state: buildAttemptOrchestrationState({
                  flow: "home_hub_build",
                  action: "build_recipe",
                  intent: buildAnalysis.intent,
                  buildable: buildAnalysis.canBuild,
                  conversationKey,
                  attemptNumber,
                  requestMode: effectiveBrief.request_mode,
                  normalizedInstruction: buildAnalysis.normalizedBuildPrompt,
                  stateBefore: lockedSession?.selected_direction ? lockedSession.state : "ready_for_recipe",
                  stateAfter: lockedSession?.selected_direction ? "built" : "recipe_generated",
                  usedSessionRecovery: briefSource === "reconstructed",
                  usedFallbackModel: currentAttemptModel === taskSetting.fallbackModel && Boolean(taskSetting.fallbackModel),
                  failureStage: null,
                  retryStrategy: "none",
                  recoveryActions: ["build_recipe", "persist_session"],
                  reason: null,
                  reasonCodes: [],
                  model: result.meta.model,
                  previousAttempt,
                  brief: effectiveBrief,
                }),
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
              conversation_snapshot: effectiveConversationHistory.map((message) => `${message.role}: ${message.content}`).join("\n"),
              cooking_brief: effectiveBrief ?? compileCookingBrief({
                userMessage: prompt || body.ideaTitle,
                conversationHistory: effectiveConversationHistory,
              }),
              recipe_plan: recipePlan,
              generator_input: {
                ideaTitle: body.ideaTitle,
                prompt: prompt ?? null,
                ingredients: ingredients ?? [],
                refinement_summary: latestRefinementSummary(lockedSession),
                distilled_intents: latestDistilledIntents(lockedSession),
                recipe_outline: null,
                outline_source: null,
                generation_path: failure.verification?.failure_context && typeof failure.verification.failure_context === "object"
                  ? (failure.verification.failure_context as { generation_path?: unknown }).generation_path ?? null
                  : null,
                generation_details: failure.verification?.failure_context && typeof failure.verification.failure_context === "object"
                  ? (failure.verification.failure_context as { generation_details?: unknown }).generation_details ?? null
                  : null,
                orchestration_state: buildAttemptOrchestrationState({
                  flow: "home_hub_build",
                  action: "build_recipe",
                  intent: buildAnalysis.intent,
                  buildable: buildAnalysis.canBuild,
                  conversationKey,
                  attemptNumber,
                  requestMode: effectiveBrief?.request_mode ?? buildAnalysis.requestModeHint,
                  normalizedInstruction: buildAnalysis.normalizedBuildPrompt,
                  stateBefore: "ready_for_recipe",
                  stateAfter: "ready_for_recipe",
                  usedSessionRecovery: Boolean(lockedSession?.selected_direction) && !lockedSession?.build_spec,
                  usedFallbackModel: currentAttemptModel === resolvedTaskPrimaryModel ? false : Boolean(currentAttemptModel),
                  failureStage: failure.failureStage,
                  retryStrategy: failure.retryStrategy,
                  recoveryActions: [failure.retryStrategy],
                  reason: failure.message,
                  reasonCodes: failure.reasons,
                  model: failure.model ?? currentAttemptModel ?? lastAttemptModel ?? null,
                  previousAttempt,
                  brief: effectiveBrief,
                }),
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
          label: gracefulModeEnabled ? "graceful_failure" : "terminal_failure",
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
        // Ensure terminal failure is reflected even if issue collection happened before the throw
        if (failure.verification?.checks) {
          collectIssueCodes(issueCollector, extractVerifierIssueCodes(failure.verification.checks));
        }
        const outerFkCode = extractFailureKindCode(failure.kind);
        if (outerFkCode && !issueCollector.codes.includes(outerFkCode)) {
          collectIssueCodes(issueCollector, [outerFkCode]);
        }

        const terminalDecision = mapToLaunchDecision({
          issueCodes: issueCollector.codes,
          plannerRetries: issueCollector.plannerRetries,
          repairAttempts: issueCollector.repairAttempts,
          usedFallback: issueCollector.usedFallback,
          reasons: issueCollector.reasons.length > 0 ? issueCollector.reasons : failure.reasons,
          requiredNamedIngredientNames: issueCollector.requiredNamedIngredientNames,
        });
        if (gracefulModeEnabled) {
          send({
            type: "graceful_failure",
            message: failure.message,
            failure_kind: failure.kind,
            failure_stage: failure.failureStage,
            retry_strategy: failure.retryStrategy,
            model: currentAttemptModel ?? lastAttemptModel ?? resolvedTaskPrimaryModel,
            reasons: failure.reasons,
            failure_context: failure.failureContext,
            launchDecision: terminalDecision,
          });
        } else {
          send({
            type: "error",
            message: failure.message,
            failure_kind: failure.kind,
            failure_stage: failure.failureStage,
            retry_strategy: failure.retryStrategy,
            model: currentAttemptModel ?? lastAttemptModel ?? resolvedTaskPrimaryModel,
            reasons: failure.reasons,
            failure_context: failure.failureContext,
            launchDecision: terminalDecision,
          });
        }
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

import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { compileCookingBrief } from "../../lib/ai/briefCompiler";
import { upsertCookingBrief } from "../../lib/ai/briefStore";
import { createAiStageMetric } from "../../lib/ai/contracts/stageMetrics";
import { getLatestGenerationAttempt, storeGenerationAttempt } from "../../lib/ai/generationAttemptStore";
import { analyzeHomeBuildRequest, analyzeRecipeTurn, buildAttemptOrchestrationState } from "../../lib/ai/recipeOrchestrator";
import {
  getRecipeSessionConversationKey,
  getRecipeSessionBrief,
  resolveRecipeSessionBrief,
  seedRecipeSessionFromSavedRecipe,
} from "../../lib/ai/recipeSessionStore";

function createMockSupabase() {
  const briefs = new Map<string, Record<string, unknown>>();
  const attempts: Record<string, unknown>[] = [];
  const recipes = new Map<string, Record<string, unknown>>();
  const versions = new Map<string, Record<string, unknown>>();

  const makeChain = (table: string) => {
    let filters: Record<string, unknown> = {};
    let sortColumn: string | null = null;
    let sortAscending = true;
    let rowLimit: number | null = null;

    return {
      select() {
        return this;
      },
      eq(column: string, value: unknown) {
        filters[column] = value;
        return this;
      },
      order(column: string, options?: { ascending?: boolean }) {
        sortColumn = column;
        sortAscending = options?.ascending !== false;
        return this;
      },
      limit(value: number) {
        rowLimit = value;
        return this;
      },
      maybeSingle() {
        if (table === "ai_cooking_briefs") {
          const key = `${filters.owner_id}:${filters.conversation_key}:${filters.scope}`;
          return Promise.resolve({ data: briefs.get(key) ?? null, error: null });
        }
        if (table === "recipes") {
          const row = recipes.get(String(filters.id)) ?? null;
          if (row && filters.owner_id && row.owner_id !== filters.owner_id) {
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: row, error: null });
        }
        if (table === "recipe_versions") {
          let rows = Array.from(versions.values());
          if (filters.id) {
            rows = rows.filter((row) => row.id === filters.id);
          }
          if (filters.recipe_id) {
            rows = rows.filter((row) => row.recipe_id === filters.recipe_id);
          }
          if (sortColumn) {
            const column = sortColumn;
            rows.sort((a, b) => {
              const left = Number(a[column] ?? 0);
              const right = Number(b[column] ?? 0);
              return sortAscending ? left - right : right - left;
            });
          }
          if (rowLimit != null) {
            rows = rows.slice(0, rowLimit);
          }
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        }
        if (table === "ai_generation_attempts") {
          let rows = attempts.filter(
            (row) =>
              row.owner_id === filters.owner_id &&
              row.conversation_key === filters.conversation_key &&
              row.scope === filters.scope
          );
          if (sortColumn) {
            const column = sortColumn;
            rows = rows.sort((a, b) => {
              const left = Number(a[column] ?? 0);
              const right = Number(b[column] ?? 0);
              return sortAscending ? left - right : right - left;
            });
          }
          if (rowLimit != null) {
            rows = rows.slice(0, rowLimit);
          }
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      upsert(payload: Record<string, unknown>) {
        if (table === "ai_cooking_briefs") {
          const key = `${payload.owner_id}:${payload.conversation_key}:${payload.scope}`;
          briefs.set(key, payload);
        }
        return Promise.resolve({ error: null });
      },
      insert(payload: Record<string, unknown>) {
        if (table === "ai_generation_attempts") {
          attempts.push(payload);
        }
        return Promise.resolve({ error: null });
      },
    };
  };

  return {
    supabase: {
      from(table: string) {
        return makeChain(table);
      },
    } as unknown as SupabaseClient,
    briefs,
    attempts,
    recipes,
    versions,
  };
}

test("create flow carries persisted home constraints into the recipe session and recipe-detail edits", async () => {
  const { supabase } = createMockSupabase();
  const ownerId = "user-1";
  const homeConversationKey = "home-1";
  const recipeId = "recipe-1";

  const homeBrief = compileCookingBrief({
    userMessage: "Make banana bread pudding in a slow cooker with sourdough discard",
    conversationHistory: [],
    recipeContext: null,
  });

  await upsertCookingBrief(supabase, {
    ownerId,
    conversationKey: homeConversationKey,
    scope: "home_hub",
    brief: homeBrief,
  });

  await seedRecipeSessionFromSavedRecipe(supabase, {
    ownerId,
    recipeId,
    versionId: "version-1",
    draft: {
      title: "Banana Bread Pudding",
      ingredients: [{ name: "8 cups stale bread" }, { name: "2 cups milk" }, { name: "4 eggs" }],
      steps: [{ text: "Whisk the custard." }, { text: "Soak the bread and cook until set." }],
    },
    seed: {
      sourceConversationKey: homeConversationKey,
      sourceScope: "home_hub",
      instruction: "Make banana bread pudding in a slow cooker with sourdough discard",
    },
  });

  const recipeSession = await getRecipeSessionBrief(supabase, { ownerId, recipeId });
  assert.ok(recipeSession);
  assert.deepEqual(recipeSession?.brief_json.constraints.equipment_limits, ["slow cooker"]);
  assert.ok(
    (recipeSession?.brief_json.ingredients.requiredNamedIngredients ?? []).some((item) =>
      /sourdough discard/i.test(item.normalizedName)
    )
  );

  const turn = analyzeRecipeTurn({
    userMessage: "more eggs and rum",
    hasRecipeContext: true,
  });
  assert.equal(turn.canBuildLatestRequest, true);
});

test("import/manual save can rebuild a missing recipe session from persisted recipe content", async () => {
  const { supabase, recipes, versions } = createMockSupabase();
  const ownerId = "user-1";
  const recipeId = "recipe-2";
  const versionId = "version-2";

  recipes.set(recipeId, {
    id: recipeId,
    owner_id: ownerId,
    title: "Slow Cooker Banana Bread Pudding",
  });
  versions.set(versionId, {
    id: versionId,
    recipe_id: recipeId,
    version_number: 1,
    servings: 8,
    prep_time_min: 20,
    cook_time_min: 240,
    difficulty: "easy",
    ingredients_json: [
      { name: "8 cups stale bread" },
      { name: "2 cups milk" },
      { name: "4 eggs" },
    ],
    steps_json: [
      { text: "Whisk the custard." },
      { text: "Cook the pudding in the slow cooker until set." },
    ],
  });

  const rebuilt = await resolveRecipeSessionBrief(supabase, {
    ownerId,
    recipeId,
    versionId,
  });

  assert.ok(rebuilt);
  assert.deepEqual(rebuilt?.constraints.equipment_limits, ["slow cooker"]);
  assert.ok(rebuilt?.directives.required_techniques.includes("slow_cook"));
});

test("persisted orchestration metadata survives across a failed build and a later recipe-detail improve", async () => {
  const { supabase } = createMockSupabase();
  const ownerId = "user-1";
  const recipeId = "recipe-3";
  const conversationKey = getRecipeSessionConversationKey(recipeId);
  const brief = compileCookingBrief({
    userMessage: "Make banana bread pudding in a slow cooker",
    conversationHistory: [],
    recipeContext: null,
  });

  await storeGenerationAttempt(supabase, {
    ownerId,
    conversationKey,
    scope: "recipe_detail",
    recipeId,
    versionId: "version-3",
    requestMode: "revise",
    stateBefore: "recipe_loaded",
    stateAfter: "recipe_loaded",
    attempt: {
      conversation_snapshot: "user: add rum",
      cooking_brief: brief,
      recipe_plan: null,
      generator_input: {
        instruction: "add rum",
        orchestration_state: buildAttemptOrchestrationState({
          flow: "recipe_detail_improve",
          action: "suggest_recipe_update",
          intent: "edit_request",
          buildable: true,
          conversationKey,
          recipeId,
          versionId: "version-3",
          attemptNumber: 1,
          requestMode: "revise",
          normalizedInstruction: "Add rum to the recipe.",
          stateBefore: "recipe_loaded",
          stateAfter: "recipe_loaded",
          usedSessionRecovery: true,
          usedFallbackModel: false,
          failureStage: "generation",
          retryStrategy: "regenerate_same_model",
          recoveryActions: ["reuse_saved_recipe_context", "retry_same_model"],
          reason: "AI improvement failed.",
          reasonCodes: ["generation_failed"],
          model: "test-model",
          previousAttempt: null,
          brief,
        }),
      },
      raw_model_output: null,
      normalized_recipe: null,
      verification: null,
      attempt_number: 1,
      provider: null,
      model: "test-model",
      outcome: "generation_failed",
      stage_metrics: [createAiStageMetric("recipe_generate")],
    },
  });

  const latest = await getLatestGenerationAttempt(supabase, {
    ownerId,
    conversationKey,
    scope: "recipe_detail",
  });

  assert.deepEqual(latest, {
    attemptNumber: 1,
    outcome: "generation_failed",
    failureStage: null,
    retryStrategy: null,
    model: "test-model",
  });

  const nextAttempt = buildAttemptOrchestrationState({
    flow: "recipe_detail_improve",
    action: "suggest_recipe_update",
    intent: "edit_request",
    buildable: true,
    conversationKey,
    recipeId,
    versionId: "version-3",
    attemptNumber: 2,
    requestMode: "revise",
    normalizedInstruction: "Add dark rum to the recipe.",
    stateBefore: "recipe_loaded",
    stateAfter: "suggestion_ready",
    usedSessionRecovery: true,
    usedFallbackModel: false,
    failureStage: null,
    retryStrategy: "none",
    recoveryActions: ["reuse_saved_recipe_context", "suggest_recipe_update"],
    reason: null,
    reasonCodes: [],
    model: "test-model",
    previousAttempt: latest,
    brief,
  });

  assert.equal(nextAttempt.previousAttempt?.outcome, "generation_failed");
  assert.equal(nextAttempt.usedSessionRecovery, true);
  assert.deepEqual(nextAttempt.sessionConstraintSummary?.equipment_limits, ["slow cooker"]);
});

test("home build analysis normalizes the build instruction through the shared orchestrator", () => {
  const analysis = analyzeHomeBuildRequest({
    ideaTitle: "Banana Bread Pudding",
    prompt: "make it in a slow cooker",
    selectedDirectionLocked: true,
    retryMode: null,
  });

  assert.equal(analysis.canBuild, true);
  assert.equal(analysis.action, "build_recipe");
  assert.equal(analysis.requestModeHint, "locked");
  assert.equal(analysis.normalizedBuildPrompt, "make it in a slow cooker");
});

import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { compileCookingBrief } from "../../lib/ai/briefCompiler";
import { upsertCookingBrief } from "../../lib/ai/briefStore";
import { getConversationTurns, storeConversationTurns } from "../../lib/ai/conversationStore";
import { createAiStageMetric } from "../../lib/ai/contracts/stageMetrics";
import { getLatestGenerationAttempt, storeGenerationAttempt } from "../../lib/ai/generationAttemptStore";
import { createLockedSessionFromDirection, buildLockedBrief, canonicalizeLockedSession } from "../../lib/ai/lockedSession";
import { analyzeHomeBuildRequest, analyzeRecipeTurn, buildAttemptOrchestrationState } from "../../lib/ai/recipeOrchestrator";
import {
  getRecipeSessionConversationKey,
  getRecipeSessionBrief,
  resolveRecipeSessionBrief,
  seedRecipeSessionFromSavedRecipe,
} from "../../lib/ai/recipeSessionStore";
import { buildSessionMemoryBlock, mergeSessionConversationHistory } from "../../lib/ai/sessionContext";
import { upsertLockedDirectionSession } from "../../lib/ai/lockedSessionStore";

function createMockSupabase() {
  const briefs = new Map<string, Record<string, unknown>>();
  const attempts: Record<string, unknown>[] = [];
  const recipes = new Map<string, Record<string, unknown>>();
  const versions = new Map<string, Record<string, unknown>>();
  const turns: Record<string, unknown>[] = [];
  const lockedSessions = new Map<string, Record<string, unknown>>();

  const makeChain = (table: string) => {
    const filters: Record<string, unknown> = {};
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
        if (table === "ai_locked_direction_sessions") {
          const key = `${filters.owner_id}:${filters.conversation_key}:${filters.scope}`;
          return Promise.resolve({ data: lockedSessions.get(key) ?? null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve: (value: { data: unknown; error: null }) => unknown) {
        if (table === "ai_conversation_turns") {
          let rows = turns.filter(
            (row) =>
              row.owner_id === filters.owner_id &&
              row.conversation_key === filters.conversation_key &&
              row.scope === filters.scope
          );
          if (sortColumn) {
            const column = sortColumn;
            rows = rows.sort((a, b) => {
              const left = String(a[column] ?? "");
              const right = String(b[column] ?? "");
              return sortAscending ? left.localeCompare(right) : right.localeCompare(left);
            });
          }
          if (rowLimit != null) {
            rows = rows.slice(0, rowLimit);
          }
          return Promise.resolve(resolve({ data: rows, error: null }));
        }
        return Promise.resolve(resolve({ data: null, error: null }));
      },
      upsert(payload: Record<string, unknown>) {
        if (table === "ai_cooking_briefs") {
          const key = `${payload.owner_id}:${payload.conversation_key}:${payload.scope}`;
          briefs.set(key, payload);
        }
        if (table === "ai_locked_direction_sessions") {
          const key = `${payload.owner_id}:${payload.conversation_key}:${payload.scope}`;
          lockedSessions.set(key, {
            id: key,
            owner_id: payload.owner_id,
            conversation_key: payload.conversation_key,
            scope: payload.scope,
            session_json: payload.session_json,
            state: payload.state,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        return Promise.resolve({ error: null });
      },
      insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
        if (table === "ai_generation_attempts") {
          attempts.push(payload as Record<string, unknown>);
        }
        if (table === "ai_conversation_turns") {
          const rows = Array.isArray(payload) ? payload : [payload];
          for (const row of rows) {
            turns.push({
              id: `turn-${turns.length + 1}`,
              ...row,
              created_at: new Date(turns.length + 1).toISOString(),
            });
          }
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
    turns,
    lockedSessions,
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

test("merged session memory keeps the active dish coherent from home lock through recipe-detail follow-up", async () => {
  const { supabase } = createMockSupabase();
  const ownerId = "user-1";
  const homeConversationKey = "home-coherence";
  const recipeId = "recipe-coherence";

  await storeConversationTurns(supabase, {
    ownerId,
    conversationKey: homeConversationKey,
    scope: "home_hub",
    turns: [
      {
        role: "user",
        message: "Make banana bread pudding in a slow cooker with sourdough discard.",
      },
      {
        role: "assistant",
        message: "A slow cooker banana bread pudding will stay custardy if you cook it gently on low.",
      },
      {
        role: "user",
        message: "Keep it creamy and wet.",
      },
    ],
  });

  const persistedTurns = await getConversationTurns(supabase, {
    ownerId,
    conversationKey: homeConversationKey,
    scope: "home_hub",
  });
  const mergedHomeHistory = mergeSessionConversationHistory({
    persistedTurns,
    clientHistory: [
      { role: "user", content: "Keep it creamy and wet." },
    ],
    maxMessages: 16,
  });

  const clientLockedSession = createLockedSessionFromDirection({
    conversationKey: homeConversationKey,
    selectedDirection: {
      id: "dir-1",
      title: "Bread Pudding",
      summary: "Keep it creamy and wet.",
      tags: ["Comforting"],
    },
    conversationHistory: [
      { role: "user", content: "Keep it creamy and wet." },
    ],
  });

  const canonicalLockedSession = canonicalizeLockedSession({
    session: clientLockedSession,
    conversationHistory: mergedHomeHistory,
  });
  assert.ok(canonicalLockedSession?.build_spec?.required_ingredients.includes("sourdough discard"));

  await upsertLockedDirectionSession(supabase, {
    ownerId,
    conversationKey: homeConversationKey,
    scope: "home_hub",
    session: canonicalLockedSession!,
  });

  const lockedBrief = buildLockedBrief({
    session: canonicalLockedSession!,
    conversationHistory: mergedHomeHistory,
  });
  assert.equal(lockedBrief.dish.dish_family, "bread_pudding");
  assert.ok(lockedBrief.constraints.equipment_limits.includes("slow cooker"));
  assert.ok(
    (lockedBrief.ingredients.requiredNamedIngredients ?? []).some((item) => item.normalizedName === "sourdough discard")
  );

  await upsertCookingBrief(supabase, {
    ownerId,
    conversationKey: homeConversationKey,
    scope: "home_hub",
    brief: lockedBrief,
    isLocked: true,
  });

  await seedRecipeSessionFromSavedRecipe(supabase, {
    ownerId,
    recipeId,
    versionId: "version-coherence",
    draft: {
      title: "Banana Bread Pudding",
      ingredients: [{ name: "8 cups stale bread" }, { name: "1 cup sourdough discard" }, { name: "4 eggs" }],
      steps: [{ text: "Whisk the custard." }, { text: "Cook in the slow cooker until set." }],
    },
    seed: {
      sourceConversationKey: homeConversationKey,
      sourceScope: "home_hub",
      instruction: "Make banana bread pudding in a slow cooker with sourdough discard",
    },
  });

  const recipeConversationKey = getRecipeSessionConversationKey(recipeId);
  await storeConversationTurns(supabase, {
    ownerId,
    conversationKey: recipeConversationKey,
    scope: "recipe_detail",
    recipeId,
    versionId: "version-coherence",
    turns: [
      { role: "user", message: "more eggs and rum" },
      { role: "assistant", message: "Add one more egg and a splash of dark rum to deepen the custard." },
    ],
  });

  const recipeTurns = await getConversationTurns(supabase, {
    ownerId,
    conversationKey: recipeConversationKey,
    scope: "recipe_detail",
  });
  const recipeSession = await getRecipeSessionBrief(supabase, { ownerId, recipeId });
  const recipeMemory = buildSessionMemoryBlock({
    brief: recipeSession?.brief_json ?? null,
    recipeContext: {
      title: "Banana Bread Pudding",
      ingredients: ["8 cups stale bread", "1 cup sourdough discard", "4 eggs"],
      steps: ["Whisk the custard.", "Cook in the slow cooker until set."],
    },
    conversationHistory: mergeSessionConversationHistory({
      persistedTurns: recipeTurns,
      clientHistory: [],
      maxMessages: 16,
    }),
  });

  assert.match(recipeMemory ?? "", /Active dish: Banana Bread Pudding/i);
  assert.match(recipeMemory ?? "", /Must keep: sourdough discard/i);
  assert.match(recipeMemory ?? "", /Equipment constraints: slow cooker/i);
  assert.match(recipeMemory ?? "", /Required methods: slow_cook/i);
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

test("home build analysis rejects reply-only cooking questions when a prompt is supplied", () => {
  const analysis = analyzeHomeBuildRequest({
    ideaTitle: "Osso Buco",
    prompt: "do I need to sear it first?",
    selectedDirectionLocked: true,
    retryMode: null,
  });

  assert.equal(analysis.canBuild, false);
  assert.match(analysis.reason ?? "", /recipe question/i);
});

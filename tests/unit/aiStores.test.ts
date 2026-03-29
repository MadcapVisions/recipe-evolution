import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmptyCookingBrief } from "../../lib/ai/contracts/cookingBrief";
import { createAiStageMetric } from "../../lib/ai/contracts/stageMetrics";
import { upsertCookingBrief, getCookingBrief } from "../../lib/ai/briefStore";
import { getLatestGenerationAttempt, storeGenerationAttempt } from "../../lib/ai/generationAttemptStore";
import { deleteLockedDirectionSession, getLockedDirectionSession, upsertLockedDirectionSession } from "../../lib/ai/lockedSessionStore";
import { createLockedSessionFromDirection } from "../../lib/ai/lockedSession";
import { getConversationTurns } from "../../lib/ai/conversationStore";
import { getCanonicalSessionState, upsertCanonicalSessionState } from "../../lib/ai/sessionStateStore";

test("upsertCookingBrief writes the normalized brief payload", async () => {
  let recordedArgs: unknown[] = [];
  const supabase = {
    from(table: string) {
      assert.equal(table, "ai_cooking_briefs");
      return {
        upsert(...args: unknown[]) {
          recordedArgs = args;
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const brief = createEmptyCookingBrief();
  brief.request_mode = "locked";
  brief.confidence = 0.91;

  await upsertCookingBrief(supabase as unknown as SupabaseClient, {
    ownerId: "user-1",
    conversationKey: "conv-1",
    scope: "home_hub",
    brief,
  });

  const [payload, options] = recordedArgs as [Record<string, unknown>, Record<string, unknown>];
  assert.equal(payload.owner_id, "user-1");
  assert.equal(payload.conversation_key, "conv-1");
  assert.equal(payload.scope, "home_hub");
  assert.equal(payload.is_locked, true);
  assert.equal(payload.confidence, 0.91);
  assert.deepEqual(options, { onConflict: "owner_id,conversation_key,scope" });
});

test("getCookingBrief returns the fetched brief row", async () => {
  const brief = createEmptyCookingBrief();
  brief.request_mode = "generate";

  const supabase = {
    from(table: string) {
      assert.equal(table, "ai_cooking_briefs");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({
            data: {
              id: "brief-1",
              owner_id: "user-1",
              conversation_key: "conv-1",
              scope: "home_hub",
              recipe_id: null,
              version_id: null,
              brief_json: brief,
              confidence: 0.88,
              is_locked: true,
              created_at: "2026-03-20T12:00:00Z",
              updated_at: "2026-03-20T12:00:01Z",
            },
            error: null,
          });
        },
      };
    },
  };

  const result = await getCookingBrief(supabase as unknown as SupabaseClient, {
    ownerId: "user-1",
    conversationKey: "conv-1",
    scope: "home_hub",
  });

  assert.ok(result);
  assert.equal(result?.conversation_key, "conv-1");
  assert.equal(result?.brief_json.request_mode, "generate");
});

test("storeGenerationAttempt writes structured attempt artifacts", async () => {
  let inserted: Record<string, unknown> | null = null;
  const supabase = {
    from(table: string) {
      assert.equal(table, "ai_generation_attempts");
      return {
        insert(payload: Record<string, unknown>) {
          inserted = payload;
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const brief = createEmptyCookingBrief();
  brief.request_mode = "generate";

  await storeGenerationAttempt(supabase as unknown as SupabaseClient, {
    ownerId: "user-1",
    conversationKey: "conv-1",
    scope: "home_hub",
    attempt: {
      conversation_snapshot: "User: I want focaccia pizza",
      cooking_brief: brief,
      recipe_plan: null,
      generator_input: { prompt: "build recipe" },
      raw_model_output: { raw: true },
      normalized_recipe: { title: "Focaccia Pizza" },
      verification: null,
      attempt_number: 1,
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      outcome: "passed",
      stage_metrics: [createAiStageMetric("brief_compile")],
    },
  });

  assert.ok(inserted);
  const payload = inserted as Record<string, unknown>;
  assert.equal(payload.owner_id, "user-1");
  assert.equal(payload.conversation_key, "conv-1");
  assert.equal(payload.request_mode, "generate");
  assert.equal(payload.model, "openai/gpt-4o-mini");
});

test("getLatestGenerationAttempt returns the most recent persisted recovery snapshot", async () => {
  const supabase = {
    from(table: string) {
      assert.equal(table, "ai_generation_attempts");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({
            data: {
              attempt_number: 3,
              outcome: "failed_verification",
              model: "openai/gpt-4o",
              verification_json: {
                failure_stage: "semantic",
                retry_strategy: "try_fallback_model",
              },
            },
            error: null,
          });
        },
      };
    },
  };

  const result = await getLatestGenerationAttempt(supabase as unknown as SupabaseClient, {
    ownerId: "user-1",
    conversationKey: "conv-1",
    scope: "home_hub",
  });

  assert.deepEqual(result, {
    attemptNumber: 3,
    outcome: "failed_verification",
    failureStage: "semantic",
    retryStrategy: "try_fallback_model",
    model: "openai/gpt-4o",
  });
});

test("upsertLockedDirectionSession writes immutable selected-direction state", async () => {
  let recordedArgs: unknown[] = [];
  const supabase = {
    from(table: string) {
      assert.equal(table, "ai_locked_direction_sessions");
      return {
        upsert(...args: unknown[]) {
          recordedArgs = args;
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Chicken Tostadas",
      summary: "Crunchy tostadas with chicken.",
      tags: ["Crunchy"],
    },
  });

  await upsertLockedDirectionSession(supabase as unknown as SupabaseClient, {
    ownerId: "user-1",
    conversationKey: "conv-1",
    scope: "home_hub",
    session,
  });

  const [payload, options] = recordedArgs as [Record<string, unknown>, Record<string, unknown>];
  assert.equal(payload.owner_id, "user-1");
  assert.equal(payload.conversation_key, "conv-1");
  assert.equal(payload.state, "direction_locked");
  assert.deepEqual(options, { onConflict: "owner_id,conversation_key,scope" });
});

test("getLockedDirectionSession returns the fetched locked session row", async () => {
  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Chicken Tostadas",
      summary: "Crunchy tostadas with chicken.",
      tags: ["Crunchy"],
    },
  });

  const supabase = {
    from(table: string) {
      assert.equal(table, "ai_locked_direction_sessions");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({
            data: {
              id: "session-1",
              owner_id: "user-1",
              conversation_key: "conv-1",
              scope: "home_hub",
              session_json: session,
              state: "direction_locked",
              created_at: "2026-03-21T12:00:00Z",
              updated_at: "2026-03-21T12:00:01Z",
            },
            error: null,
          });
        },
      };
    },
  };

  const result = await getLockedDirectionSession(supabase as unknown as SupabaseClient, {
    ownerId: "user-1",
    conversationKey: "conv-1",
    scope: "home_hub",
  });

  assert.ok(result);
  assert.equal(result?.state, "direction_locked");
  assert.equal(result?.session_json.selected_direction?.title, "Chicken Tostadas");
});

test("upsertCanonicalSessionState writes the canonical state payload", async () => {
  let recordedArgs: unknown[] = [];
  const supabase = {
    from(table: string) {
      assert.equal(table, "ai_recipe_session_states");
      return {
        upsert(...args: unknown[]) {
          recordedArgs = args;
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  await upsertCanonicalSessionState(supabase as unknown as SupabaseClient, {
    ownerId: "user-1",
    conversationKey: "conv-1",
    scope: "recipe_detail",
    recipeId: "recipe-1",
    versionId: "version-1",
    state: {
      conversation_key: "conv-1",
      scope: "recipe_detail",
      recipe_id: "recipe-1",
      version_id: "version-1",
      active_dish: {
        title: "Banana Bread Pudding",
        dish_family: "bread_pudding",
        locked: true,
      },
      selected_direction: null,
      hard_constraints: {
        required_named_ingredients: ["sourdough discard"],
        required_ingredients: [],
        forbidden_ingredients: [],
        required_techniques: ["slow_cook"],
        equipment_limits: ["slow cooker"],
      },
      soft_preferences: {
        preferred_ingredients: ["rum"],
        style_tags: ["custardy"],
        nice_to_have: [],
      },
      rejected_branches: [],
      recipe_context: null,
      conversation: {
        last_user_message: "more eggs and rum",
        last_assistant_message: null,
        turn_count: 1,
      },
      source: {
        updated_by: "test",
        brief_confidence: 0.9,
      },
    },
  });

  const [payload, options] = recordedArgs as [Record<string, unknown>, Record<string, unknown>];
  assert.equal(payload.owner_id, "user-1");
  assert.equal(payload.conversation_key, "conv-1");
  assert.equal(payload.scope, "recipe_detail");
  assert.equal(payload.recipe_id, "recipe-1");
  assert.deepEqual(options, { onConflict: "owner_id,conversation_key,scope" });
});

test("getCanonicalSessionState returns the fetched canonical session state row", async () => {
  const supabase = {
    from(table: string) {
      assert.equal(table, "ai_recipe_session_states");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({
            data: {
              id: "state-1",
              owner_id: "user-1",
              conversation_key: "conv-1",
              scope: "recipe_detail",
              recipe_id: "recipe-1",
              version_id: "version-1",
              state_json: {
                conversation_key: "conv-1",
                scope: "recipe_detail",
                recipe_id: "recipe-1",
                version_id: "version-1",
                active_dish: {
                  title: "Banana Bread Pudding",
                  dish_family: "bread_pudding",
                  locked: true,
                },
                selected_direction: null,
                hard_constraints: {
                  required_named_ingredients: ["sourdough discard"],
                  required_ingredients: [],
                  forbidden_ingredients: [],
                  required_techniques: ["slow_cook"],
                  equipment_limits: ["slow cooker"],
                },
                soft_preferences: {
                  preferred_ingredients: ["rum"],
                  style_tags: ["custardy"],
                  nice_to_have: [],
                },
                rejected_branches: [],
                recipe_context: null,
                conversation: {
                  last_user_message: "more eggs and rum",
                  last_assistant_message: null,
                  turn_count: 1,
                },
                source: {
                  updated_by: "test",
                  brief_confidence: 0.9,
                },
              },
              created_at: "2026-03-29T12:00:00Z",
              updated_at: "2026-03-29T12:00:01Z",
            },
            error: null,
          });
        },
      };
    },
  };

  const result = await getCanonicalSessionState(supabase as unknown as SupabaseClient, {
    ownerId: "user-1",
    conversationKey: "conv-1",
    scope: "recipe_detail",
  });

  assert.ok(result);
  assert.equal(result?.state_json.active_dish.title, "Banana Bread Pudding");
  assert.deepEqual(result?.state_json.hard_constraints.required_techniques, ["slow_cook"]);
});

test("deleteLockedDirectionSession clears a persisted session", async () => {
  const calls: Array<{ column: string; value: string }> = [];
  const chain = {
    delete() {
      return this;
    },
    eq(column: string, value: string) {
      calls.push({ column, value });
      if (calls.length === 3) {
        return Promise.resolve({ error: null });
      }
      return this;
    },
  };
  const supabase = {
    from(table: string) {
      assert.equal(table, "ai_locked_direction_sessions");
      return chain;
    },
  };

  await deleteLockedDirectionSession(supabase as unknown as SupabaseClient, {
    ownerId: "user-1",
    conversationKey: "conv-1",
    scope: "home_hub",
  });

  assert.deepEqual(calls, [
    { column: "owner_id", value: "user-1" },
    { column: "conversation_key", value: "conv-1" },
    { column: "scope", value: "home_hub" },
  ]);
});

test("getConversationTurns returns ordered home-hub turns", async () => {
  const supabase = {
    from(table: string) {
      assert.equal(table, "ai_conversation_turns");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return Promise.resolve({
            data: [
              {
                id: "turn-1",
                owner_id: "user-1",
                conversation_key: "conv-1",
                scope: "home_hub",
                recipe_id: null,
                version_id: null,
                role: "user",
                message: "I want tacos",
                metadata_json: null,
                created_at: "2026-03-21T10:00:00Z",
              },
              {
                id: "turn-2",
                owner_id: "user-1",
                conversation_key: "conv-1",
                scope: "home_hub",
                recipe_id: null,
                version_id: null,
                role: "assistant",
                message: "Here are three taco directions.",
                metadata_json: { mode: "options", reply: "Here are three taco directions.", options: [] },
                created_at: "2026-03-21T10:00:01Z",
              },
            ],
            error: null,
          });
        },
      };
    },
  };

  const result = await getConversationTurns(supabase as unknown as SupabaseClient, {
    ownerId: "user-1",
    conversationKey: "conv-1",
    scope: "home_hub",
  });

  assert.equal(result.length, 2);
  assert.equal(result[0]?.role, "user");
  assert.equal(result[1]?.role, "assistant");
});

test("upsertLockedDirectionSession persists build_spec provenance fields intact across a round-trip", async () => {
  let persistedPayload: Record<string, unknown> | null = null;

  const supabase = {
    from(table: string) {
      assert.equal(table, "ai_locked_direction_sessions");
      return {
        upsert(payload: Record<string, unknown>) {
          persistedPayload = payload;
          return Promise.resolve({ error: null });
        },
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          return Promise.resolve({
            data: {
              id: "session-1",
              owner_id: "user-1",
              conversation_key: "conv-1",
              scope: "home_hub",
              session_json: persistedPayload?.session_json,
              state: "direction_locked",
              created_at: "2026-03-23T10:00:00Z",
              updated_at: "2026-03-23T10:00:01Z",
            },
            error: null,
          });
        },
      };
    },
  };

  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Crispy Chicken Tostadas with Avocado Crema",
      summary: "Shredded chicken on tostadas with avocado crema.",
      tags: ["Mexican", "Crunchy"],
    },
    conversationHistory: [
      { role: "user" as const, content: "I want crunchy chicken tacos." },
    ],
  });

  // Session created with conversationHistory so build_spec is populated with provenance fields.
  assert.ok(session.build_spec !== null, "build_spec should be populated when conversationHistory is provided");
  assert.ok(session.build_spec!.derived_at === "lock_time");
  assert.ok(session.build_spec!.dish_family_source === "model" || session.build_spec!.dish_family_source === "inferred");
  assert.ok(["model", "inferred", "none"].includes(session.build_spec!.anchor_source));

  await upsertLockedDirectionSession(supabase as unknown as SupabaseClient, {
    ownerId: "user-1",
    conversationKey: "conv-1",
    scope: "home_hub",
    session,
  });

  // Verify the persisted session_json contains the build_spec with provenance fields intact.
  assert.ok(persistedPayload !== null);
  const storedSession = (persistedPayload as Record<string, unknown>).session_json as typeof session;
  assert.ok(storedSession.build_spec !== null);
  assert.equal(storedSession.build_spec!.derived_at, "lock_time");
  assert.equal(storedSession.build_spec!.dish_family_source, session.build_spec!.dish_family_source);
  assert.equal(storedSession.build_spec!.anchor_source, session.build_spec!.anchor_source);
});

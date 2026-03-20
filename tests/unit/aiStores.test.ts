import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyCookingBrief } from "../../lib/ai/contracts/cookingBrief";
import { createAiStageMetric } from "../../lib/ai/contracts/stageMetrics";
import { upsertCookingBrief, getCookingBrief } from "../../lib/ai/briefStore";
import { storeGenerationAttempt } from "../../lib/ai/generationAttemptStore";

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

  await upsertCookingBrief(supabase as any, {
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

  const result = await getCookingBrief(supabase as any, {
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

  await storeGenerationAttempt(supabase as any, {
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

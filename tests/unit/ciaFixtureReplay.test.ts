import test from "node:test";
import assert from "node:assert/strict";
import { replayCiaFailureFixture } from "../../lib/ai/evals/ciaFixtureReplay";

test("replayCiaFailureFixture reproduces heuristic sanitization for noisy required ingredients", async () => {
  const replay = await replayCiaFailureFixture(
    {
      id: "home_create_verification_failed_noise",
      source: {
        adjudication_id: "cia-1",
        created_at: "2026-03-29T00:00:00.000Z",
        conversation_key: "conversation-1",
      },
      flow: "home_create",
      failure_kind: "verification_failed",
      failure_stage: "verify",
      packet: {
        cookingBrief: {
          ingredients: {
            required: ["ok", "peanut butter"],
            preferred: [],
            forbidden: [],
            requiredNamedIngredients: [
              { rawText: "ok", normalizedName: "ok", aliases: [], source: "must_include", requiredStrength: "hard" },
              { rawText: "peanut butter", normalizedName: "peanut butter", aliases: [], source: "must_include", requiredStrength: "hard" },
            ],
            provenance: { required: [], preferred: [], forbidden: [] },
          },
          compiler_notes: [],
          source_turn_ids: [],
        },
        reasons: ['Required ingredient "ok" appears in the ingredient list but is not used in any step.'],
      },
      observed: null,
    },
    {
      taskSetting: {
        taskKey: "recipe_cia",
        label: "CIA",
        description: "CIA",
        primaryModel: "openai/gpt-4o-mini",
        fallbackModel: "anthropic/claude-3.5-haiku",
        temperature: 0.1,
        maxTokens: 900,
        enabled: false,
        updatedAt: null,
        updatedBy: null,
      },
    }
  );

  assert.equal(replay.decision, "sanitize_constraints");
  assert.deepEqual(replay.dropRequiredIngredients, ["ok"]);
});

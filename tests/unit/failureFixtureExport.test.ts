import test from "node:test";
import assert from "node:assert/strict";
import { buildRecipeFailureFixtureFromAttempt } from "../../lib/ai/evals/failureFixtureExport";

test("buildRecipeFailureFixtureFromAttempt prefers raw text and captures current replay expectations", () => {
  const fixture = buildRecipeFailureFixtureFromAttempt({
    id: "attempt-1",
    created_at: "2026-03-23T12:00:00.000Z",
    conversation_key: "chef-convo-1",
    attempt_number: 2,
    outcome: "parse_failed",
    generator_payload_json: {
      ideaTitle: "Spanish-Inspired Chicken with Peppers",
    },
    raw_model_output_json: {
      text: "Here is the recipe:\n{\"Title\":\"Spanish-Inspired Chicken with Peppers\",\"Ingredients_Text\":\"1 lb chicken thighs\\n2 bell peppers\",\"Instructions_Text\":\"1. Brown the chicken.\\n2. Simmer until tender.\"}",
    },
    normalized_recipe_json: null,
    verification_json: {
      failure_stage: "parse",
      failure_context: {
        parser: "legacy",
        missing_fields: ["ingredients", "steps"],
      },
    },
  });

  assert.match(fixture.id, /chef_convo_1_attempt_2_parse_failed/);
  assert.equal(fixture.fallback_title, "Spanish-Inspired Chicken with Peppers");
  assert.equal(fixture.source?.attempt_id, "attempt-1");
  assert.equal(fixture.observed?.outcome, "parse_failed");
  assert.equal(fixture.observed?.failure_stage, "parse");
  assert.deepEqual(fixture.observed?.failure_context, {
    parser: "legacy",
    missing_fields: ["ingredients", "steps"],
  });
  assert.equal(fixture.expected.parse_success, true);
  assert.equal(fixture.expected.normalization_reason, null);
  assert.equal(fixture.expected.structural_passes, true);
  assert.equal(fixture.expected.title, "Spanish-Inspired Chicken with Peppers");
  assert.equal(fixture.expected.outcome, "passed");
  assert.equal(fixture.expected.failure_stage, null);
  assert.equal(fixture.expected.failure_context, null);
});

test("buildRecipeFailureFixtureFromAttempt stringifies non-text payloads when needed", () => {
  const fixture = buildRecipeFailureFixtureFromAttempt({
    id: "attempt-2",
    created_at: "2026-03-23T12:00:00.000Z",
    conversation_key: "chef-convo-2",
    attempt_number: 1,
    outcome: "generation_failed",
    generator_payload_json: null,
    raw_model_output_json: { foo: "bar" },
    normalized_recipe_json: null,
    verification_json: null,
  });

  assert.match(fixture.raw_text, /"foo": "bar"/);
  assert.equal(fixture.observed?.outcome, "generation_failed");
  assert.equal(fixture.expected.outcome, "parse_failed");
});

test("buildRecipeFailureFixtureFromAttempt falls back to replay-derived outcome metadata when verification is missing", () => {
  const fixture = buildRecipeFailureFixtureFromAttempt({
    id: "attempt-3",
    created_at: "2026-03-23T12:00:00.000Z",
    conversation_key: "chef-convo-3",
    attempt_number: 1,
    outcome: null,
    generator_payload_json: {
      ideaTitle: "Fallback Braised Chicken",
    },
    raw_model_output_json: "{\"title\":\"Broken Recipe\",\"ingredients\":[{\"name\":\"2 onions\"}],\"step_notes\":\"Cook until done.\"}",
    normalized_recipe_json: null,
    verification_json: null,
  });

  assert.equal(fixture.expected.outcome, "parse_failed");
  assert.equal(fixture.expected.failure_stage, "parse");
  assert.equal(fixture.expected.failure_context, null);
});

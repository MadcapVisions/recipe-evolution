import test from "node:test";
import assert from "node:assert/strict";
import { buildRetryRecipePlan, shouldAutoRetryRecipeBuild } from "../../lib/ai/homeRecipeRetry";
import { createEmptyRecipePlan } from "../../lib/ai/contracts/recipePlan";

test("shouldAutoRetryRecipeBuild retries only once for verifier-directed retry strategies", () => {
  assert.equal(shouldAutoRetryRecipeBuild("regenerate_stricter", 1), true);
  assert.equal(shouldAutoRetryRecipeBuild("regenerate_same_model", 1), true);
  assert.equal(shouldAutoRetryRecipeBuild("ask_user", 1), false);
  assert.equal(shouldAutoRetryRecipeBuild("regenerate_stricter", 2), false);
});

test("buildRetryRecipePlan appends previous failure reasons to the active plan", () => {
  const basePlan = {
    ...createEmptyRecipePlan(),
    notes: ["Keep the dough airy."],
    title_direction: "Focaccia Pizza",
    dish_family: "pizza",
  };

  const retried = buildRetryRecipePlan(basePlan, {
    retryStrategy: "regenerate_stricter",
    reasons: ["Recipe drifted from the requested dish family or direction."],
    attemptNumber: 2,
  });

  assert.equal(retried.notes.some((note) => note.includes("stricter alignment")), true);
  assert.equal(
    retried.notes.some((note) => note.includes("Recipe drifted from the requested dish family or direction.")),
    true
  );
  assert.equal(
    retried.notes.some((note) => note.includes("Retry attempt 2")),
    true
  );
});

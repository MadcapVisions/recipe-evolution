import test from "node:test";
import assert from "node:assert/strict";
import { getDowngradedResponseFormat, shouldDowngradeStructuredOutputError } from "../../lib/ai/responseFormat";

test("getDowngradedResponseFormat converts json_schema to json_object", () => {
  assert.deepEqual(
    getDowngradedResponseFormat({
      type: "json_schema",
      json_schema: {
        name: "recipe_outline",
        strict: true,
        schema: { type: "object" },
      },
    }),
    { type: "json_object" }
  );
});

test("shouldDowngradeStructuredOutputError detects unsupported schema-format errors", () => {
  assert.equal(
    shouldDowngradeStructuredOutputError(
      new Error("This model does not support response_format json_schema."),
      {
        type: "json_schema",
        json_schema: {
          name: "recipe_outline",
          schema: { type: "object" },
        },
      }
    ),
    true
  );
});

test("shouldDowngradeStructuredOutputError ignores non-schema formats", () => {
  assert.equal(
    shouldDowngradeStructuredOutputError(new Error("unsupported"), { type: "json_object" }),
    false
  );
});

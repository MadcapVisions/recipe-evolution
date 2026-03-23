import test from "node:test";
import assert from "node:assert/strict";
import { parseJsonResponse, validateJsonContract } from "../../lib/ai/jsonContract";

test("parseJsonResponse extracts a valid JSON object after leading prose", () => {
  const parsed = parseJsonResponse('Here is the result:\n{"title":"Test Recipe","ingredients":[],"steps":[]}');
  assert.deepEqual(parsed, {
    title: "Test Recipe",
    ingredients: [],
    steps: [],
  });
});

test("parseJsonResponse returns null for non-JSON text", () => {
  assert.equal(parseJsonResponse("not valid json"), null);
});

test("validateJsonContract throws when parsed JSON fails the typed contract", () => {
  assert.throws(
    () =>
      validateJsonContract({ title: "" }, (parsed) => ({
        value: typeof (parsed as { title?: unknown }).title === "string" && (parsed as { title: string }).title.length > 0
          ? parsed
          : null,
        error: "Recipe title was missing.",
      })),
    /Recipe title was missing/
  );
});

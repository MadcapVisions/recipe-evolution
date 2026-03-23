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

test("parseJsonResponse unwraps recipe JSON nested inside a text field", () => {
  const parsed = parseJsonResponse(
    JSON.stringify({
      text: JSON.stringify({
        title: "Spicy Pineapple Carnitas Tacos",
        ingredients: [{ name: "1 lb pork shoulder" }],
        steps: [{ text: "Cook the pork until tender." }],
      }),
    })
  );

  assert.deepEqual(parsed, {
    title: "Spicy Pineapple Carnitas Tacos",
    ingredients: [{ name: "1 lb pork shoulder" }],
    steps: [{ text: "Cook the pork until tender." }],
  });
});

test("parseJsonResponse unwraps recipe JSON nested inside wrapper objects and content arrays", () => {
  const parsed = parseJsonResponse(
    JSON.stringify({
      result: {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              title: "Pineapple Carnitas Tacos",
              ingredients: [{ name: "2 lb pork shoulder" }],
              steps: [{ text: "Cook and crisp the pork." }],
            }),
          },
        ],
      },
    })
  );

  assert.deepEqual(parsed, {
    title: "Pineapple Carnitas Tacos",
    ingredients: [{ name: "2 lb pork shoulder" }],
    steps: [{ text: "Cook and crisp the pork." }],
  });
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

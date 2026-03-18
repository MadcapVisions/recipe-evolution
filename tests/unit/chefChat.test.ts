import test from "node:test";
import assert from "node:assert/strict";
import { normalizeChefChatEnvelope, optionsTooSimilar } from "../../lib/ai/chefOptions";

// --- normalizeChefChatEnvelope ---

test("normalizeChefChatEnvelope returns null when reply is empty string", () => {
  const result = normalizeChefChatEnvelope({
    mode: "refine",
    reply: "",
    options: [],
    recommended_option_id: null,
  });
  assert.equal(result, null);
});

test("normalizeChefChatEnvelope returns null when reply field is missing", () => {
  const result = normalizeChefChatEnvelope({
    mode: "refine",
    options: [],
    recommended_option_id: null,
  });
  assert.equal(result, null);
});

test("normalizeChefChatEnvelope returns envelope when reply is present", () => {
  const result = normalizeChefChatEnvelope({
    mode: "refine",
    reply: "Go with a lemon chicken skillet.",
    options: [],
    recommended_option_id: null,
  });
  assert.ok(result !== null);
  assert.equal(result?.reply, "Go with a lemon chicken skillet.");
  assert.equal(result?.mode, "refine");
});

test("normalizeChefChatEnvelope parses options mode with valid options", () => {
  const result = normalizeChefChatEnvelope({
    mode: "options",
    reply: "Three directions for a quick chicken dinner:",
    options: [
      { id: "option-1", title: "Lemon Skillet", summary: "Bright lemon chicken with garlic and herbs.", tags: [] },
      { id: "option-2", title: "Smoky Bowl", summary: "Smoky paprika chicken rice bowl with roasted veg.", tags: [] },
    ],
    recommended_option_id: "option-1",
  });
  assert.ok(result !== null);
  assert.equal(result?.mode, "options");
  assert.equal(result?.options.length, 2);
  assert.equal(result?.recommended_option_id, "option-1");
});

// --- optionsTooSimilar ---

test("optionsTooSimilar returns false for clearly distinct options", () => {
  const options = [
    { id: "option-1", title: "Lemon Herb Chicken Skillet", summary: "", tags: [] },
    { id: "option-2", title: "Smoky Paprika Rice Bowl", summary: "", tags: [] },
  ];
  assert.equal(optionsTooSimilar(options), false);
});

test("optionsTooSimilar returns true when two titles share more than 60% of words", () => {
  const options = [
    { id: "option-1", title: "Spicy Chicken Skillet", summary: "", tags: [] },
    { id: "option-2", title: "Spicy Chicken Skillet Variation", summary: "", tags: [] },
  ];
  assert.equal(optionsTooSimilar(options), true);
});

test("optionsTooSimilar returns false for a single option", () => {
  const options = [
    { id: "option-1", title: "Lemon Herb Chicken Skillet", summary: "", tags: [] },
  ];
  assert.equal(optionsTooSimilar(options), false);
});

test("optionsTooSimilar returns false for empty options", () => {
  assert.equal(optionsTooSimilar([]), false);
});

test("optionsTooSimilar returns false for three distinct options", () => {
  const options = [
    { id: "option-1", title: "Lemon Herb Chicken Skillet", summary: "", tags: [] },
    { id: "option-2", title: "Smoky Paprika Rice Bowl", summary: "", tags: [] },
    { id: "option-3", title: "Spicy Peanut Noodles", summary: "", tags: [] },
  ];
  assert.equal(optionsTooSimilar(options), false);
});

test("optionsTooSimilar returns true when one pair in three is too similar", () => {
  const options = [
    { id: "option-1", title: "Crispy Garlic Chicken Bowl", summary: "", tags: [] },
    { id: "option-2", title: "Smoky Paprika Rice Bowl", summary: "", tags: [] },
    { id: "option-3", title: "Crispy Garlic Chicken Skillet", summary: "", tags: [] },
  ];
  assert.equal(optionsTooSimilar(options), true);
});

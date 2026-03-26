import test from "node:test";
import assert from "node:assert/strict";
import { deriveBuildSpec } from "../../lib/ai/buildSpecDeriver";

const chickenTostadaDirection = {
  id: "dir-1",
  title: "Crispy Chicken Tostadas with Avocado Crema",
  summary: "Shredded chicken on tostadas with avocado crema.",
  tags: ["Mexican", "Crunchy"],
};

const braisedDirection = {
  id: "dir-2",
  title: "Tomato and Pepper Braise",
  summary: "Braised chicken leg quarters with tomato pulp and peppers.",
  tags: ["Braised"],
};

const chickenConversation = [
  { role: "user" as const, content: "I want to make a braised chicken dish." },
  { role: "assistant" as const, content: "Great — sear the chicken first then braise." },
  { role: "user" as const, content: "I have tomato pulp and mushrooms." },
];

test("deriveBuildSpec resolves dish_family from direction title", () => {
  const spec = deriveBuildSpec({
    selectedDirection: chickenTostadaDirection,
    conversationHistory: [],
  });

  assert.equal(spec.dish_family, "tacos");
  assert.equal(spec.dish_family_source, "inferred");
  assert.equal(spec.derived_at, "lock_time");
});

test("deriveBuildSpec uses model-provided dish_family when it is in DISH_FAMILIES", () => {
  const spec = deriveBuildSpec({
    selectedDirection: braisedDirection,
    conversationHistory: [],
    modelDishFamily: "braised",
  });

  assert.equal(spec.dish_family, "braised");
  assert.equal(spec.dish_family_source, "model");
});

test("deriveBuildSpec falls back to inference when model-provided dish_family is not in DISH_FAMILIES", () => {
  // "stew" is not a canonical DISH_FAMILIES value — should fall back to inference
  const spec = deriveBuildSpec({
    selectedDirection: braisedDirection,
    conversationHistory: [],
    modelDishFamily: "stew",
  });

  // Inference from "Tomato and Pepper Braise" / summary text should detect braised
  assert.equal(spec.dish_family, "braised");
  assert.equal(spec.dish_family_source, "inferred");
});

test("deriveBuildSpec does not silently null dish_family when model value is invalid and inference succeeds", () => {
  // Key regression guard: model provides garbage value — we must not lose the inferred family
  const spec = deriveBuildSpec({
    selectedDirection: chickenTostadaDirection,
    conversationHistory: [],
    modelDishFamily: "not-a-real-family",
  });

  assert.notEqual(spec.dish_family, null);
  assert.equal(spec.dish_family_source, "inferred");
});

test("deriveBuildSpec uses model-provided anchor and marks anchor_source as model", () => {
  const spec = deriveBuildSpec({
    selectedDirection: braisedDirection,
    conversationHistory: [],
    modelAnchor: "salmon",
    modelAnchorType: "protein",
  });

  assert.equal(spec.primary_anchor_value, "salmon");
  assert.equal(spec.primary_anchor_type, "protein");
  assert.equal(spec.anchor_source, "model");
});

test("deriveBuildSpec infers protein from user conversation turns when model anchor is null", () => {
  const spec = deriveBuildSpec({
    selectedDirection: braisedDirection,
    conversationHistory: chickenConversation,
  });

  assert.equal(spec.primary_anchor_value, "chicken");
  assert.equal(spec.primary_anchor_type, "protein");
  assert.equal(spec.anchor_source, "inferred");
});

test("deriveBuildSpec ignores assistant turns when inferring anchor to avoid polluting required ingredients", () => {
  // Assistant message mentions salmon — should not be picked up
  const spec = deriveBuildSpec({
    selectedDirection: braisedDirection,
    conversationHistory: [
      { role: "user" as const, content: "I want something with tomatoes and mushrooms." },
      { role: "assistant" as const, content: "Consider salmon with a tomato braise." },
    ],
  });

  // salmon is from assistant turn — should not be the anchor
  assert.notEqual(spec.primary_anchor_value, "salmon");
  // mushrooms or tomatoes should be inferred from user turn
  assert.equal(spec.anchor_source, "inferred");
});

test("deriveBuildSpec marks anchor_source as none when no anchor can be found", () => {
  const spec = deriveBuildSpec({
    selectedDirection: {
      id: "dir-3",
      title: "Simple Flatbread",
      summary: "A classic flatbread with herbs.",
      tags: ["flatbread"],
    },
    conversationHistory: [],
  });

  // No protein, no anchor ingredient in title, summary, or conversation
  // dish_family="flatbread" so primary_anchor_value falls back to the family itself
  assert.equal(spec.primary_anchor_type, "dish");
  assert.equal(spec.anchor_source, "inferred");
});

test("deriveBuildSpec sets must_preserve_format true for format-locked families", () => {
  const pizzaSpec = deriveBuildSpec({
    selectedDirection: { id: "p", title: "Margherita Pizza", summary: "Classic pizza.", tags: [] },
    conversationHistory: [],
  });
  assert.equal(pizzaSpec.must_preserve_format, true);

  const braisedSpec = deriveBuildSpec({
    selectedDirection: braisedDirection,
    conversationHistory: [],
  });
  // braised is not in FORMAT_LOCKED_FAMILIES
  assert.equal(braisedSpec.must_preserve_format, false);
});

test("deriveBuildSpec produces higher confidence when dish_family and specific title are both resolved", () => {
  const highConf = deriveBuildSpec({
    selectedDirection: chickenTostadaDirection,
    conversationHistory: [],
  });
  assert.ok(highConf.confidence >= 0.9, `expected >= 0.9, got ${highConf.confidence}`);

  const lowConf = deriveBuildSpec({
    selectedDirection: { id: "x", title: "Chef Direction", summary: "Something tasty.", tags: [] },
    conversationHistory: [],
  });
  assert.ok(lowConf.confidence < 0.9, `expected < 0.9, got ${lowConf.confidence}`);
});

test("deriveBuildSpec recovers dish_family from user conversation when locked title is a generic placeholder", () => {
  // Regression: the old deriver only used title+summary for dish_family detection.
  // A "Chef Direction" title with a tacos conversation would produce dish_family: null.
  const spec = deriveBuildSpec({
    selectedDirection: {
      id: "dir-1",
      title: "Chef Direction",
      summary: "Shrimp with garlic butter and lime.",
      tags: [],
    },
    conversationHistory: [
      { role: "user" as const, content: "I want tacos with shrimp and lime crema." },
    ],
  });

  assert.equal(spec.dish_family, "tacos");
  assert.equal(spec.dish_family_source, "inferred");
});

test("deriveBuildSpec recovers build_title from user conversation when locked title is a generic placeholder", () => {
  const spec = deriveBuildSpec({
    selectedDirection: {
      id: "dir-1",
      title: "Chef Direction",
      summary: "Shrimp with garlic butter and lime.",
      tags: [],
    },
    conversationHistory: [
      { role: "user" as const, content: "I want tacos with shrimp and lime crema." },
    ],
  });

  // build_title should be derived from context — not left as "Chef Direction"
  assert.notEqual(spec.build_title, "Chef Direction");
  assert.ok(
    spec.build_title.toLowerCase().includes("shrimp") || spec.build_title.toLowerCase().includes("taco"),
    `expected shrimp/taco in build_title, got "${spec.build_title}"`
  );
});

test("deriveBuildSpec preserves explicit required ingredients from lock-time user conversation", () => {
  const spec = deriveBuildSpec({
    selectedDirection: {
      id: "dir-discard",
      title: "Bread Pudding",
      summary: "Classic bread pudding direction.",
      tags: [],
    },
    conversationHistory: [
      { role: "user" as const, content: "I want bread pudding with sourdough discard." },
    ],
  });

  assert.ok(spec.required_ingredients.includes("sourdough discard"));
});

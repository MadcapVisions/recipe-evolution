import test from "node:test";
import assert from "node:assert/strict";
import { detectSessionContradictions } from "../../lib/ai/sessionContradictions";
import type { CanonicalRecipeSessionState } from "../../lib/ai/contracts/sessionState";

function createSessionState(): CanonicalRecipeSessionState {
  return {
    conversation_key: "home-1",
    scope: "home_hub",
    recipe_id: null,
    version_id: null,
    active_dish: {
      title: "Slow Cooker Banana Bread Pudding",
      dish_family: "bread_pudding",
      locked: true,
    },
    selected_direction: {
      id: "opt-1",
      title: "Slow Cooker Banana Bread Pudding",
      summary: "Custardy banana bread pudding for the slow cooker.",
      tags: ["dessert", "comfort"],
    },
    hard_constraints: {
      required_named_ingredients: ["sourdough discard"],
      required_ingredients: [],
      forbidden_ingredients: ["walnuts"],
      required_techniques: ["slow_cook"],
      equipment_limits: ["slow cooker"],
    },
    soft_preferences: {
      preferred_ingredients: ["cinnamon"],
      style_tags: ["cozy"],
      nice_to_have: [],
    },
    rejected_branches: [],
    recipe_context: null,
    conversation: {
      last_user_message: "Make banana bread pudding in a slow cooker with sourdough discard.",
      last_assistant_message: null,
      turn_count: 2,
    },
    source: {
      updated_by: "test",
      brief_confidence: 0.93,
    },
  };
}

test("detectSessionContradictions flags removal of a locked required ingredient", () => {
  const contradictions = detectSessionContradictions(
    createSessionState(),
    "Make it without sourdough discard."
  );

  assert.deepEqual(
    contradictions.map((item) => item.kind),
    ["required_ingredient_removed"]
  );
  assert.match(contradictions[0]!.message, /locked required ingredient/i);
});

test("detectSessionContradictions flags forbidden ingredient additions", () => {
  const contradictions = detectSessionContradictions(
    createSessionState(),
    "Add walnuts and keep everything else the same."
  );

  assert.deepEqual(
    contradictions.map((item) => item.kind),
    ["forbidden_ingredient_added"]
  );
});

test("detectSessionContradictions flags method and equipment conflicts together", () => {
  const contradictions = detectSessionContradictions(
    createSessionState(),
    "Convert it to an oven bake instead."
  );

  assert.deepEqual(
    contradictions.map((item) => item.kind),
    ["required_method_conflict", "equipment_conflict"]
  );
});

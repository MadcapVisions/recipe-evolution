import test from "node:test";
import assert from "node:assert/strict";
import { buildHomeRecipeAiMetadata } from "../../lib/ai/homeRecipeMetadata";

test("buildHomeRecipeAiMetadata persists outline artifact and retry context", () => {
  const metadata = buildHomeRecipeAiMetadata({
    outlineSource: "fallback",
    generationPath: "sectioned_quality_repaired",
    generationDetails: {
      sectionedAttempted: true,
      monolithicFallbackUsed: false,
      repairedSections: ["ingredient_structure", "instruction_quality"],
    },
    outline: {
      title: "Spanish-Inspired Chicken with Peppers",
      summary: "Home-cook friendly braised direction.",
      dish_family: "braised",
      primary_ingredient: "chicken",
      ingredient_groups: [{ name: "Main components", items: ["chicken", "peppers", "paprika"] }],
      step_outline: ["Brown the chicken.", "Braise with peppers until tender."],
      chef_tip_topics: ["browning", "paprika bloom"],
    },
    cookingBrief: {
      request_mode: "locked",
      confidence: 0.9,
      ambiguity_reason: null,
      dish: {
        raw_user_phrase: "Spanish-inspired chicken with peppers",
        normalized_name: "Spanish-Inspired Chicken with Peppers",
        dish_family: "braised",
        cuisine: null,
        course: null,
        authenticity_target: null,
      },
      style: { tags: [], texture_tags: [], format_tags: [] },
      ingredients: { required: ["chicken"], preferred: [], forbidden: [], centerpiece: "chicken" },
      constraints: {
        servings: null,
        time_max_minutes: null,
        difficulty_target: null,
        dietary_tags: [],
        equipment_limits: [],
      },
      directives: { must_have: [], nice_to_have: [], must_not_have: [], required_techniques: [] },
      field_state: {
        dish_family: "locked",
        normalized_name: "locked",
        cuisine: "unknown",
        ingredients: "locked",
        constraints: "unknown",
      },
      source_turn_ids: [],
      compiler_notes: [],
    },
    retryContext: {
      attemptNumber: 2,
      retryStrategy: "regenerate_same_model",
      reasons: ["Recipe JSON was missing recognizable steps."],
    },
  });

  assert.equal(metadata.pipeline_version, "outline_sections_v1");
  assert.equal(metadata.outline_source, "fallback");
  assert.equal(metadata.generation_path, "sectioned_quality_repaired");
  assert.deepEqual(metadata.generation_details, {
    sectioned_attempted: true,
    monolithic_fallback_used: false,
    repaired_sections: ["ingredient_structure", "instruction_quality"],
  });
  assert.equal(metadata.dish_family, "braised");
  assert.equal(metadata.primary_ingredient, "chicken");
  assert.equal(metadata.recipe_outline.title, "Spanish-Inspired Chicken with Peppers");
  assert.deepEqual(metadata.retry_context, {
    attempt_number: 2,
    retry_strategy: "regenerate_same_model",
    reasons: ["Recipe JSON was missing recognizable steps."],
    model_override: null,
  });
});

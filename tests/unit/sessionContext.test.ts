import test from "node:test";
import assert from "node:assert/strict";
import { buildSessionMemoryBlock, mergeSessionConversationHistory } from "../../lib/ai/sessionContext";

test("mergeSessionConversationHistory preserves persisted turns when client history is only a cropped tail", () => {
  const merged = mergeSessionConversationHistory({
    persistedTurns: [
      {
        id: "1",
        owner_id: "user-1",
        conversation_key: "home-1",
        scope: "home_hub",
        recipe_id: null,
        version_id: null,
        role: "user",
        message: "I want a dessert inspired by a 100 Grand bar.",
        metadata_json: null,
        created_at: "2026-03-29T13:01:00.000Z",
      },
      {
        id: "2",
        owner_id: "user-1",
        conversation_key: "home-1",
        scope: "home_hub",
        recipe_id: null,
        version_id: null,
        role: "assistant",
        message: "Option 1 caramel crunch tart. Option 2 no-bake bar. Option 3 ice cream sundae.",
        metadata_json: null,
        created_at: "2026-03-29T13:01:01.000Z",
      },
    ],
    clientHistory: [
      {
        role: "assistant",
        content: "Option 1 caramel crunch tart. Option 2 no-bake bar. Option 3 ice cream sundae.",
      },
      {
        role: "user",
        content: "Those are the same options you first gave me, I want 3 different options.",
      },
    ],
  });

  assert.deepEqual(merged, [
    {
      role: "user",
      content: "I want a dessert inspired by a 100 Grand bar.",
    },
    {
      role: "assistant",
      content: "Option 1 caramel crunch tart. Option 2 no-bake bar. Option 3 ice cream sundae.",
    },
    {
      role: "user",
      content: "Those are the same options you first gave me, I want 3 different options.",
    },
  ]);
});

test("buildSessionMemoryBlock includes locked direction and persistent constraints", () => {
  const block = buildSessionMemoryBlock({
    brief: {
      request_mode: "locked",
      confidence: 0.92,
      ambiguity_reason: null,
      dish: {
        raw_user_phrase: "banana bread pudding",
        normalized_name: "banana bread pudding",
        dish_family: "bread_pudding",
        cuisine: null,
        course: null,
        authenticity_target: null,
      },
      style: {
        tags: ["warm"],
        texture_tags: ["custardy"],
        format_tags: [],
      },
      ingredients: {
        required: [],
        preferred: ["banana"],
        forbidden: ["walnuts"],
        provenance: {
          required: [],
          preferred: [],
          forbidden: [],
        },
        centerpiece: "banana bread pudding",
        requiredNamedIngredients: [
          {
            rawText: "sourdough discard",
            normalizedName: "sourdough discard",
            aliases: ["discard"],
            source: "explicit_use",
            requiredStrength: "hard",
            provenance: null,
          },
        ],
      },
      constraints: {
        servings: null,
        time_max_minutes: null,
        difficulty_target: null,
        dietary_tags: [],
        equipment_limits: ["slow cooker"],
        macroTargets: null,
      },
      directives: {
        must_have: [],
        nice_to_have: [],
        must_not_have: [],
        required_techniques: ["slow_cook"],
      },
      field_state: {
        dish_family: "locked",
        normalized_name: "locked",
        cuisine: "unknown",
        ingredients: "locked",
        constraints: "locked",
      },
      source_turn_ids: [],
      compiler_notes: [],
    },
    lockedSession: {
      conversation_key: "home-1",
      state: "direction_locked",
      selected_direction: {
        id: "opt-1",
        title: "Slow Cooker Banana Bread Pudding",
        summary: "Banana bread pudding with a custardy center and caramelized top notes.",
        tags: ["dessert", "comforting"],
      },
      brief_snapshot: null,
      build_spec: null,
      refinements: [],
    },
    conversationHistory: [
      { role: "user", content: "Make it creamy and keep the sourdough discard." },
    ],
  });

  assert.ok(block);
  assert.match(block ?? "", /Locked direction: Slow Cooker Banana Bread Pudding/i);
  assert.match(block ?? "", /Must keep: sourdough discard/i);
  assert.match(block ?? "", /Avoid: walnuts/i);
  assert.match(block ?? "", /Required methods: slow_cook/i);
  assert.match(block ?? "", /Equipment constraints: slow cooker/i);
});

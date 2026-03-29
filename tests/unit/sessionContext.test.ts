import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanonicalSessionState,
  buildSessionMemoryBlock,
  mergeSessionConversationHistory,
  updateCanonicalSessionState,
} from "../../lib/ai/sessionContext";

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
  const state = buildCanonicalSessionState({
    conversationKey: "home-1",
    scope: "home_hub",
    updatedBy: "test",
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
  const block = buildSessionMemoryBlock({
    sessionState: state,
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

test("buildCanonicalSessionState extracts a stable active dish and hard constraints", () => {
  const state = buildCanonicalSessionState({
    conversationKey: "recipe-session:1",
    scope: "recipe_detail",
    recipeId: "recipe-1",
    versionId: "version-1",
    updatedBy: "test",
    brief: {
      request_mode: "revise",
      confidence: 0.88,
      ambiguity_reason: null,
      dish: {
        raw_user_phrase: "banana bread pudding",
        normalized_name: "Banana Bread Pudding",
        dish_family: "bread_pudding",
        cuisine: null,
        course: null,
        authenticity_target: null,
      },
      style: { tags: ["warm"], texture_tags: ["custardy"], format_tags: [] },
      ingredients: {
        required: ["banana"],
        preferred: ["rum"],
        forbidden: ["walnuts"],
        centerpiece: "banana bread pudding",
        provenance: { required: [], preferred: [], forbidden: [] },
        requiredNamedIngredients: [
          {
            rawText: "sourdough discard",
            normalizedName: "sourdough discard",
            aliases: [],
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
        nice_to_have: ["dark rum"],
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
    recipeContext: {
      title: "Banana Bread Pudding",
      ingredients: ["1 cup sourdough discard", "4 eggs"],
      steps: ["Cook in the slow cooker until set."],
    },
    conversationHistory: [
      { role: "user", content: "more eggs and rum" },
      { role: "assistant", content: "Add one more egg and a splash of rum." },
    ],
  });

  assert.equal(state.active_dish.title, "Banana Bread Pudding");
  assert.equal(state.active_dish.dish_family, "bread_pudding");
  assert.deepEqual(state.hard_constraints.required_named_ingredients, ["sourdough discard"]);
  assert.deepEqual(state.hard_constraints.equipment_limits, ["slow cooker"]);
  assert.deepEqual(state.soft_preferences.preferred_ingredients, ["rum"]);
  assert.equal(state.conversation.last_user_message, "more eggs and rum");
});

test("buildSessionMemoryBlock includes rejected branches from canonical session state", () => {
  const block = buildSessionMemoryBlock({
    sessionState: {
      conversation_key: "home-1",
      scope: "home_hub",
      recipe_id: null,
      version_id: null,
      active_dish: {
        title: "100 Grand-Inspired Dessert",
        dish_family: "dessert",
        locked: false,
      },
      selected_direction: null,
      hard_constraints: {
        required_named_ingredients: [],
        required_ingredients: [],
        forbidden_ingredients: [],
        required_techniques: [],
        equipment_limits: [],
      },
      soft_preferences: {
        preferred_ingredients: [],
        style_tags: [],
        nice_to_have: [],
      },
      rejected_branches: [
        { title: "Caramel Crunch Tart", reason: "user_rejected_option_set" },
        { title: "No-Bake Candy Bar", reason: "user_rejected_option_set" },
      ],
      recipe_context: null,
      conversation: {
        last_user_message: "give me 3 different options",
        last_assistant_message: null,
        turn_count: 4,
      },
      source: {
        updated_by: "test",
        brief_confidence: 0.4,
      },
    },
  });

  assert.match(block ?? "", /Rejected branches: Caramel Crunch Tart \(user_rejected_option_set\), No-Bake Candy Bar \(user_rejected_option_set\)/i);
});

test("updateCanonicalSessionState preserves locked dish context when later turns are lossy", () => {
  const previous = buildCanonicalSessionState({
    conversationKey: "home-1",
    scope: "home_hub",
    updatedBy: "test",
    brief: {
      request_mode: "locked",
      confidence: 0.93,
      ambiguity_reason: null,
      dish: {
        raw_user_phrase: "100 Grand bar dessert",
        normalized_name: "100 Grand Bar Dessert",
        dish_family: "dessert",
        cuisine: null,
        course: null,
        authenticity_target: null,
      },
      style: { tags: [], texture_tags: [], format_tags: [] },
      ingredients: {
        required: [],
        preferred: [],
        forbidden: [],
        provenance: { required: [], preferred: [], forbidden: [] },
        centerpiece: "100 Grand bar dessert",
        requiredNamedIngredients: [],
      },
      constraints: {
        servings: null,
        time_max_minutes: null,
        difficulty_target: null,
        dietary_tags: [],
        equipment_limits: [],
        macroTargets: null,
      },
      directives: {
        must_have: [],
        nice_to_have: [],
        must_not_have: [],
        required_techniques: [],
      },
      field_state: {
        dish_family: "locked",
        normalized_name: "locked",
        cuisine: "unknown",
        ingredients: "unknown",
        constraints: "unknown",
      },
      source_turn_ids: [],
      compiler_notes: [],
    },
    conversationHistory: [{ role: "user", content: "I want a dessert inspired by a 100 Grand bar." }],
  });

  const next = updateCanonicalSessionState({
    conversationKey: "home-1",
    scope: "home_hub",
    previousState: previous,
    brief: {
      request_mode: "compare",
      confidence: 0.41,
      ambiguity_reason: "option_rejection",
      dish: {
        raw_user_phrase: "other options",
        normalized_name: null,
        dish_family: null,
        cuisine: null,
        course: null,
        authenticity_target: null,
      },
      style: { tags: [], texture_tags: [], format_tags: [] },
      ingredients: {
        required: [],
        preferred: [],
        forbidden: [],
        provenance: { required: [], preferred: [], forbidden: [] },
        centerpiece: null,
        requiredNamedIngredients: [],
      },
      constraints: {
        servings: null,
        time_max_minutes: null,
        difficulty_target: null,
        dietary_tags: [],
        equipment_limits: [],
        macroTargets: null,
      },
      directives: {
        must_have: [],
        nice_to_have: [],
        must_not_have: [],
        required_techniques: [],
      },
      field_state: {
        dish_family: "unknown",
        normalized_name: "unknown",
        cuisine: "unknown",
        ingredients: "unknown",
        constraints: "unknown",
      },
      source_turn_ids: [],
      compiler_notes: [],
    },
    conversationHistory: [
      { role: "user", content: "I want a dessert inspired by a 100 Grand bar." },
      { role: "assistant", content: "Option 1 caramel crunch tart. Option 2 no-bake bar. Option 3 ice cream sundae." },
      { role: "user", content: "Give me 3 other options" },
    ],
    updatedBy: "home_chat",
  });

  assert.equal(next.active_dish.title, "100 Grand Bar Dessert");
  assert.equal(next.active_dish.dish_family, "dessert");
  assert.equal(next.active_dish.locked, true);
});

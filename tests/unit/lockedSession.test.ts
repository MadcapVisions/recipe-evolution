import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBuildSpec } from "../../lib/ai/contracts/buildSpec";
import {
  appendLockedSessionRefinement,
  buildLockedBrief,
  createLockedSessionFromDirection,
  markLockedSessionBuilt,
  removeLastLockedSessionRefinement,
} from "../../lib/ai/lockedSession";

test("appendLockedSessionRefinement preserves immutable selected direction and stores delta", () => {
  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Crispy Chicken Tostadas with Avocado Crema",
      summary: "Shredded chicken on tostadas with avocado crema.",
      tags: ["Mexican", "Crunchy"],
    },
  });

  const refined = appendLockedSessionRefinement(session, {
    userText: "lets add jalapeños and skip onions",
    assistantText: "Add diced jalapeños to the crema and leave out the onions.",
  });

  assert.equal(refined.selected_direction?.title, "Crispy Chicken Tostadas with Avocado Crema");
  assert.equal(refined.refinements.length, 1);
  assert.ok(refined.refinements[0]?.extracted_changes.required_ingredients.includes("jalapeños"));
  assert.ok(refined.refinements[0]?.extracted_changes.forbidden_ingredients.includes("onions"));
});

test("buildLockedBrief compiles canonical dish identity from locked session", () => {
  const session = appendLockedSessionRefinement(
    createLockedSessionFromDirection({
      conversationKey: "conv-1",
      selectedDirection: {
        id: "dir-1",
        title: "Crispy Chicken Tostadas with Avocado Crema",
        summary: "Shredded chicken on tostadas with avocado crema.",
        tags: ["Mexican", "Crunchy"],
      },
    }),
    {
      userText: "lets add jalapeños",
      assistantText: "Add diced jalapeños to the crema.",
    }
  );

  const brief = buildLockedBrief({ session, conversationHistory: [] });
  assert.equal(brief.request_mode, "locked");
  assert.equal(brief.dish.normalized_name, "Crispy Chicken Tostadas with Avocado Crema");
  assert.equal(brief.dish.dish_family, "tacos");
  assert.equal(brief.ingredients.centerpiece, "Crispy Chicken Tostadas with Avocado Crema");
  assert.ok(brief.ingredients.required.includes("jalapeños"));
});

test("buildLockedBrief preserves original protein anchors when a locked direction title omits them", () => {
  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Tomato and Pepper Braise",
      summary: "Braised chicken leg quarters with tomato pulp, peppers, onions, and mushrooms.",
      tags: ["Braised"],
    },
  });

  const brief = buildLockedBrief({
    session,
    conversationHistory: [
      {
        role: "user",
        content: "I want to make a braised chicken dish. I have 3 chicken leg quarter, mushrooms, peppers, onions, and carrots.",
      },
      {
        role: "assistant",
        content: "For a braised chicken dish, sear the chicken leg quarters first, then braise them with mushrooms, onions, and peppers.",
      },
      {
        role: "user",
        content: "I also have tomato pulp. Can you suggest a couple different options",
      },
    ],
  });

  assert.equal(brief.dish.normalized_name, "Tomato and Pepper Braise");
  assert.equal(brief.dish.dish_family, "braised");
  assert.equal(brief.ingredients.centerpiece, "chicken");
  assert.ok(brief.ingredients.required.includes("chicken"));
});

test("buildLockedBrief preserves a specific selected title and ignores old conversation constraints", () => {
  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Mediterranean Chicken Bowl",
      summary: "Chicken bowl with olives, herbs, and lemon.",
      tags: ["Mediterranean"],
    },
  });

  const brief = buildLockedBrief({
    session,
    conversationHistory: [
      { role: "user", content: "I need vegan pizza in 20 minutes" },
      { role: "assistant", content: "Try a sheet-pan pizza." },
    ],
  });

  assert.equal(brief.dish.normalized_name, "Mediterranean Chicken Bowl");
  assert.equal(brief.constraints.time_max_minutes, null);
  assert.deepEqual(brief.constraints.dietary_tags, []);
  assert.deepEqual(brief.directives.required_techniques, []);
});

test("appendLockedSessionRefinement keeps ambiguous refinements out of structured ingredient fields", () => {
  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Chicken Tostadas",
      summary: "Crunchy tostadas with chicken.",
      tags: ["Crunchy"],
    },
  });

  const refined = appendLockedSessionRefinement(session, {
    userText: "make it better",
    assistantText: "Try a brighter crema and a sharper finish.",
  });

  assert.deepEqual(refined.refinements[0]?.extracted_changes.required_ingredients, []);
  assert.deepEqual(refined.refinements[0]?.extracted_changes.forbidden_ingredients, []);
  assert.equal(refined.refinements[0]?.field_state.ingredients, "unknown");
  assert.equal(refined.refinements[0]?.field_state.notes, "locked");
});

test("appendLockedSessionRefinement keeps low-confidence style phrasing out of structured style fields", () => {
  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Chicken Tostadas",
      summary: "Crunchy tostadas with chicken.",
      tags: ["Crunchy"],
    },
  });

  const refined = appendLockedSessionRefinement(session, {
    userText: "maybe make it a little brighter",
    assistantText: "A brighter finish could help.",
  });

  assert.deepEqual(refined.refinements[0]?.extracted_changes.style_tags, []);
  assert.equal(refined.refinements[0]?.field_state.style, "unknown");
  assert.equal(refined.refinements[0]?.field_state.notes, "locked");
  assert.deepEqual(refined.refinements[0]?.ambiguous_notes, [
    "maybe make it a little brighter",
    "A brighter finish could help.",
  ]);
});

test("appendLockedSessionRefinement stores distilled ingredient intents without conversational filler", () => {
  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Garlic Butter Shrimp Pasta",
      summary: "Shrimp pasta in a garlic butter sauce.",
      tags: ["Pasta"],
    },
  });

  const refined = appendLockedSessionRefinement(session, {
    userText: "can we add white beans to this",
    assistantText: "White beans would make it heartier.",
  });

  assert.deepEqual(refined.refinements[0]?.extracted_changes.required_ingredients, ["white beans"]);
  assert.deepEqual(refined.refinements[0]?.distilled_intents?.ingredient_additions, [
    { label: "white beans", canonical_key: "white_bean" },
  ]);
});

test("removeLastLockedSessionRefinement drops only the newest refinement", () => {
  const base = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Chicken Tostadas",
      summary: "Crunchy tostadas with chicken.",
      tags: ["Crunchy"],
    },
  });

  const once = appendLockedSessionRefinement(base, {
    userText: "lets add jalapeños",
    assistantText: "Add diced jalapeños.",
  });
  const twice = appendLockedSessionRefinement(once, {
    userText: "skip onions",
    assistantText: "Leave out the onions.",
  });

  const reverted = removeLastLockedSessionRefinement(twice);
  assert.equal(reverted.refinements.length, 1);
  assert.equal(reverted.refinements[0]?.user_text, "lets add jalapeños");
  assert.equal(reverted.state, "ready_to_build");

  const revertedToBase = removeLastLockedSessionRefinement(reverted);
  assert.equal(revertedToBase.refinements.length, 0);
  assert.equal(revertedToBase.state, "direction_locked");
});

test("markLockedSessionBuilt stores a built snapshot without mutating selected direction", () => {
  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Chicken Tostadas",
      summary: "Crunchy tostadas with chicken.",
      tags: ["Crunchy"],
    },
  });

  const brief = buildLockedBrief({ session, conversationHistory: [] });
  const built = markLockedSessionBuilt(session, brief);

  assert.equal(built.state, "built");
  assert.equal(built.selected_direction?.title, "Chicken Tostadas");
  assert.equal(built.brief_snapshot?.dish.normalized_name, "Chicken Tostadas");
});

test("appendLockedSessionRefinementDelta caps the retained refinement stack", () => {
  let session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Chicken Tostadas",
      summary: "Crunchy tostadas with chicken.",
      tags: ["Crunchy"],
    },
  });

  for (let index = 0; index < 20; index += 1) {
    session = appendLockedSessionRefinement(session, {
      userText: `add thing ${index}`,
      assistantText: `Chef acknowledged thing ${index}`,
    });
  }

  assert.equal(session.refinements.length, 12);
  assert.equal(session.refinements[0]?.user_text, "add thing 8");
  assert.equal(session.refinements[11]?.user_text, "add thing 19");
});

// --- normalizeBuildSpec (API-level payload validation) ---

test("normalizeBuildSpec returns null for empty object — stale client payload falls back to legacy", () => {
  assert.equal(normalizeBuildSpec({}), null);
});

test("normalizeBuildSpec returns null when required arrays are missing", () => {
  assert.equal(normalizeBuildSpec({ derived_at: "lock_time" }), null);
  assert.equal(normalizeBuildSpec({ derived_at: "lock_time", required_ingredients: [] }), null);
  assert.equal(normalizeBuildSpec({ derived_at: "lock_time", required_ingredients: [], forbidden_ingredients: [] }), null);
});

test("normalizeBuildSpec returns null when derived_at sentinel is wrong or absent", () => {
  assert.equal(normalizeBuildSpec({ required_ingredients: [], forbidden_ingredients: [], style_tags: [] }), null);
  assert.equal(
    normalizeBuildSpec({ required_ingredients: [], forbidden_ingredients: [], style_tags: [], derived_at: "runtime" }),
    null
  );
});

test("normalizeBuildSpec returns null for impossible enum values — the exact case it was failing", () => {
  // Verified in compiled output: { dish_family: "stew", dish_family_source: "garbage", anchor_source: "oops" }
  // passed the old guard because it only checked arrays and derived_at.
  assert.equal(
    normalizeBuildSpec({
      derived_at: "lock_time",
      required_ingredients: [],
      forbidden_ingredients: [],
      style_tags: [],
      dish_family: "stew",            // not in DISH_FAMILIES
      dish_family_source: "garbage",  // not a valid provenance enum
      anchor_source: "oops",          // not a valid provenance enum
      display_title: "x",
      build_title: "x",
      primary_anchor_type: null,
      primary_anchor_value: null,
      must_preserve_format: false,
      confidence: 0.5,
    }),
    null
  );
});

test("normalizeBuildSpec returns null when dish_family is a non-canonical string", () => {
  assert.equal(
    normalizeBuildSpec({
      derived_at: "lock_time",
      required_ingredients: [], forbidden_ingredients: [], style_tags: [],
      dish_family: "stew",  // valid-looking but not in DISH_FAMILIES
      dish_family_source: "inferred", anchor_source: "none",
      display_title: "x", build_title: "x",
      primary_anchor_type: null, primary_anchor_value: null,
      must_preserve_format: false, confidence: 0.5,
    }),
    null
  );
});

test("normalizeBuildSpec returns null when anchor_source is an unrecognized value", () => {
  assert.equal(
    normalizeBuildSpec({
      derived_at: "lock_time",
      required_ingredients: [], forbidden_ingredients: [], style_tags: [],
      dish_family: null, dish_family_source: "inferred",
      anchor_source: "unknown_value",  // not model/inferred/none
      display_title: "x", build_title: "x",
      primary_anchor_type: null, primary_anchor_value: null,
      must_preserve_format: false, confidence: 0.5,
    }),
    null
  );
});

test("normalizeBuildSpec returns null when primary_anchor_type is an unrecognized string", () => {
  assert.equal(
    normalizeBuildSpec({
      derived_at: "lock_time",
      required_ingredients: [], forbidden_ingredients: [], style_tags: [],
      dish_family: null, dish_family_source: "inferred", anchor_source: "none",
      display_title: "x", build_title: "x",
      primary_anchor_type: "veggie",  // not dish/protein/ingredient/format
      primary_anchor_value: "broccoli",
      must_preserve_format: false, confidence: 0.5,
    }),
    null
  );
});

test("normalizeBuildSpec returns null when required scalars have wrong types", () => {
  const base = {
    derived_at: "lock_time",
    required_ingredients: [], forbidden_ingredients: [], style_tags: [],
    dish_family: null, dish_family_source: "inferred", anchor_source: "none",
    primary_anchor_type: null, primary_anchor_value: null,
    must_preserve_format: false, confidence: 0.5,
  };
  assert.equal(normalizeBuildSpec({ ...base, build_title: 42 }), null);
  assert.equal(normalizeBuildSpec({ ...base, display_title: null }), null);
  assert.equal(normalizeBuildSpec({ ...base, must_preserve_format: "yes" }), null);
  assert.equal(normalizeBuildSpec({ ...base, confidence: "high" }), null);
});

test("normalizeBuildSpec returns the object typed as BuildSpec when all fields are valid", () => {
  const value = {
    derived_at: "lock_time" as const,
    required_ingredients: [],
    forbidden_ingredients: [],
    style_tags: [],
    dish_family: null,
    display_title: "Shrimp Tacos",
    build_title: "Shrimp Tacos",
    primary_anchor_type: "protein" as const,
    primary_anchor_value: "shrimp",
    must_preserve_format: true,
    confidence: 0.92,
    dish_family_source: "inferred" as const,
    anchor_source: "inferred" as const,
  };
  assert.ok(normalizeBuildSpec(value) !== null);
});

// --- Malformed build_spec fallback in buildLockedBrief ---

test("buildLockedBrief does not throw when build_spec is an empty object and falls back to legacy", () => {
  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Crispy Chicken Tostadas with Avocado Crema",
      summary: "Shredded chicken on tostadas with avocado crema.",
      tags: ["Mexican"],
    },
  });
  // Inject a malformed build_spec (stale client payload, corrupted storage).
  const malformed = { ...session, build_spec: {} as never };

  assert.doesNotThrow(() => buildLockedBrief({ session: malformed, conversationHistory: [] }));
  const brief = buildLockedBrief({ session: malformed, conversationHistory: [] });
  assert.equal(brief.request_mode, "locked");
  // Legacy path note should appear — not the BuildSpec fast path note.
  assert.ok(brief.compiler_notes.some((n) => n.toLowerCase().includes("legacy")));
});

test("buildLockedBrief does not throw when build_spec is missing required arrays and falls back to legacy", () => {
  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Crispy Chicken Tostadas with Avocado Crema",
      summary: "Shredded chicken on tostadas with avocado crema.",
      tags: ["Mexican"],
    },
  });
  // Partial spec: has derived_at sentinel but missing the array fields.
  const partial = { ...session, build_spec: { derived_at: "lock_time" } as never };

  assert.doesNotThrow(() => buildLockedBrief({ session: partial, conversationHistory: [] }));
  const brief = buildLockedBrief({ session: partial, conversationHistory: [] });
  assert.ok(brief.compiler_notes.some((n) => n.toLowerCase().includes("legacy")));
});

// --- Debug metadata regression (brief_source) ---

test("buildLockedBrief uses the BuildSpec fast path and notes it in compiler_notes when spec is valid", () => {
  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Crispy Chicken Tostadas with Avocado Crema",
      summary: "Shredded chicken on tostadas with avocado crema.",
      tags: ["Mexican"],
    },
    conversationHistory: [],
  });
  // Session created with conversationHistory — build_spec is populated.
  assert.ok(session.build_spec !== null);
  const brief = buildLockedBrief({ session, conversationHistory: [] });
  assert.ok(brief.compiler_notes.some((n) => n.includes("BuildSpec")));
});

test("buildLockedBrief uses the legacy path and notes it in compiler_notes when spec is malformed", () => {
  const session = createLockedSessionFromDirection({
    conversationKey: "conv-1",
    selectedDirection: {
      id: "dir-1",
      title: "Crispy Chicken Tostadas with Avocado Crema",
      summary: "Shredded chicken on tostadas with avocado crema.",
      tags: ["Mexican"],
    },
    conversationHistory: [],
  });
  const malformed = { ...session, build_spec: {} as never };
  const brief = buildLockedBrief({ session: malformed, conversationHistory: [] });
  assert.ok(brief.compiler_notes.some((n) => n.toLowerCase().includes("legacy")));
});

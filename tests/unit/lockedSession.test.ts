import test from "node:test";
import assert from "node:assert/strict";
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

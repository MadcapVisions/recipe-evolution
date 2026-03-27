import test from "node:test";
import assert from "node:assert/strict";
import { applyChefActions, buildChefIntelligence, deriveChefActions } from "../../lib/ai/chefIntelligence";

test("buildChefIntelligence flags sourdough non-dairy cookie risks and chef guidance", () => {
  const intelligence = buildChefIntelligence({
    title: "Non-dairy oatmeal raisin cookies with sourdough discard",
    ingredients: [
      "1 cup sourdough discard",
      "1/2 cup vegan butter",
      "1 cup rolled oats",
      "3/4 cup raisins",
      "1 cup flour",
    ],
    steps: [
      "Mix the wet ingredients and sugar.",
      "Fold in the dry ingredients and raisins.",
      "Scoop onto a tray and bake at 350F for 12 minutes.",
    ],
  });

  assert.equal(intelligence.analysis.isCookies, true);
  assert.equal(intelligence.analysis.isSourdough, true);
  assert.equal(intelligence.analysis.isNonDairy, true);
  assert.ok(intelligence.insights.some((insight) => insight.id === "cookie_chill_step_missing"));
  assert.ok(intelligence.insights.some((insight) => insight.id === "sourdough_balance"));
  assert.ok(intelligence.insights.some((insight) => insight.id === "non_dairy_spread"));
  assert.ok(intelligence.stepTips.some((tip) => /slightly soft/i.test(tip.text)));
});

test("deriveChefActions converts refrigeration guidance into structured recipe edits", () => {
  const actions = deriveChefActions({
    userMessage: "Should I refrigerate the dough before baking?",
    assistantReply: "Yes. Chill the dough before baking so the cookies do not spread too much.",
    recipe: {
      title: "Non-dairy oatmeal raisin cookies with sourdough discard",
      ingredients: ["1 cup sourdough discard", "1/2 cup vegan butter"],
      steps: ["Mix the dough.", "Bake at 350F for 12 minutes."],
    },
  });

  assert.ok(actions.some((action) => action.type === "add_step"));
  assert.ok(actions.some((action) => action.type === "add_chef_insight"));
});

test("applyChefActions inserts chill step and preserves chef notes", () => {
  const actions = deriveChefActions({
    userMessage: "Should I refrigerate the dough before baking?",
    assistantReply: "Yes. Chill the dough before baking so the cookies do not spread too much.",
    recipe: {
      title: "Non-dairy oatmeal raisin cookies with sourdough discard",
      ingredients: ["1 cup sourdough discard", "1/2 cup vegan butter"],
      steps: ["Mix the dough.", "Bake at 350F for 12 minutes."],
      notes: null,
    },
  });

  const applied = applyChefActions(
    {
      title: "Non-dairy oatmeal raisin cookies with sourdough discard",
      ingredients: ["1 cup sourdough discard", "1/2 cup vegan butter"],
      steps: ["Mix the dough.", "Bake at 350F for 12 minutes."],
      notes: null,
    },
    actions
  );

  assert.equal(applied.steps[1]?.text, "Refrigerate the dough for 30 to 60 minutes before baking.");
  assert.match(applied.notes ?? "", /spread risk/i);
});

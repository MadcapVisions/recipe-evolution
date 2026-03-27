import test from "node:test";
import assert from "node:assert/strict";
import { calculateChefScore, compareChefScores, generateChefFixes } from "../../lib/ai/chefScoring";

test("chef score penalizes non-dairy sourdough cookies that omit chilling", () => {
  const score = calculateChefScore({
    recipeTitle: "Non-dairy oatmeal raisin cookies with sourdough discard",
    ingredients: [
      "1 cup sourdough discard",
      "1/2 cup vegan butter",
      "1 cup rolled oats",
      "3/4 cup raisins",
      "1 tsp cinnamon",
      "1/2 tsp salt",
    ],
    steps: [
      "Mix the wet ingredients and sugar.",
      "Fold in the dry ingredients and raisins.",
      "Bake at 350 F for 12 minutes.",
    ],
  });

  assert.ok(score.totalScore >= 55 && score.totalScore <= 70);
  assert.ok(score.improvementPriorities.some((item) => /chill/i.test(item)));
  assert.ok(score.riskFlags.some((flag) => /spread/i.test(flag)));
});

test("chef score rewards chicken recipes with temperature and rest guidance", () => {
  const strong = calculateChefScore({
    recipeTitle: "Simple roast chicken",
    ingredients: ["1 whole chicken", "1 tbsp olive oil", "1 tsp salt", "1/2 tsp black pepper"],
    steps: [
      "Pat the chicken dry and season it all over.",
      "Roast at 425 F until the thickest part reaches 165 F.",
      "Rest for 10 minutes before carving.",
    ],
  });

  const weak = calculateChefScore({
    recipeTitle: "Simple roast chicken",
    ingredients: ["1 whole chicken", "1 tbsp olive oil", "1 tsp salt", "1/2 tsp black pepper"],
    steps: ["Roast the chicken until done and serve immediately."],
  });

  assert.ok(strong.totalScore > weak.totalScore);
  const comparison = compareChefScores(weak, strong);
  assert.ok(comparison.improvedAreas.includes("Technique Soundness"));
  assert.ok(comparison.improvedAreas.includes("Failure Risk"));
});

test("chef fixes prioritize reliability for fragile cookie recipes", () => {
  const score = calculateChefScore({
    recipeTitle: "Non-dairy oatmeal raisin cookies with sourdough discard",
    ingredients: [
      "1 cup sourdough discard",
      "1/2 cup vegan butter",
      "1 cup rolled oats",
      "3/4 cup raisins",
      "1 tsp cinnamon",
      "1/2 tsp salt",
    ],
    steps: [
      "Mix the wet ingredients and sugar.",
      "Fold in the dry ingredients and raisins.",
      "Bake at 350 F for 12 minutes.",
    ],
  });

  const fixes = generateChefFixes({ score, mode: "reliability" });
  assert.equal(fixes.fixes[0]?.issueKey, "cookie_chill_step_missing");
  assert.ok(fixes.projectedDelta > 0);
});

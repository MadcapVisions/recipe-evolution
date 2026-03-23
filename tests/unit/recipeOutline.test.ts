import test from "node:test";
import assert from "node:assert/strict";
import { buildFallbackRecipeOutline, normalizeRecipeOutlinePayload, validateRecipeOutline } from "../../lib/ai/recipeOutline";
import { compileCookingBrief } from "../../lib/ai/briefCompiler";
import { buildRecipePlanFromBrief } from "../../lib/ai/recipePlanner";

test("normalizeRecipeOutlinePayload accepts wrapped outline objects with alternate key shapes", () => {
  const normalized = normalizeRecipeOutlinePayload(
    {
      result: {
        Name: "Spanish-Inspired Chicken with Peppers",
        family: "braised",
        primaryIngredient: "chicken",
        components: ["chicken", "bell peppers", "paprika"],
        technique_outline: [
          { instruction: "Brown the chicken well before adding the braising base." },
          { direction: "Simmer gently with peppers until tender." },
        ],
        chefTips: ["browning", "paprika bloom"],
      },
    },
    "Fallback Title"
  );

  assert.equal(normalized.reason, null);
  assert.equal(normalized.outline?.title, "Spanish-Inspired Chicken with Peppers");
  assert.equal(normalized.outline?.dish_family, "braised");
  assert.equal(normalized.outline?.primary_ingredient, "chicken");
  assert.deepEqual(normalized.outline?.ingredient_groups, [
    {
      name: "Main components",
      items: ["chicken", "bell peppers", "paprika"],
    },
  ]);
  assert.deepEqual(normalized.outline?.step_outline, [
    "Brown the chicken well before adding the braising base.",
    "Simmer gently with peppers until tender.",
  ]);
});

test("validateRecipeOutline rejects dish-family drift against the locked brief", () => {
  const brief = compileCookingBrief({
    userMessage: "I want shrimp tacos with lime crema",
    assistantReply: "Locked direction: Shrimp Tacos. Bright shrimp tacos with lime crema and cabbage.",
  });

  const result = validateRecipeOutline({
    outline: {
      title: "Shrimp Skillet",
      summary: null,
      dish_family: "skillet",
      primary_ingredient: "shrimp",
      ingredient_groups: [{ name: "Main", items: ["shrimp", "lime crema", "cabbage"] }],
      step_outline: ["Cook the shrimp filling.", "Serve over rice."],
      chef_tip_topics: ["lime balance"],
    },
    brief,
    recipePlan: buildRecipePlanFromBrief(brief),
  });

  assert.equal(result.passes, false);
  assert.equal(result.checks.dish_family_aligned, false);
});

test("buildFallbackRecipeOutline preserves anchor ingredient and plan structure", () => {
  const brief = compileCookingBrief({
    userMessage: "I want Spanish-inspired braised chicken with peppers",
    assistantReply: "Locked direction: Spanish-Inspired Chicken with Peppers. Paprika-braised chicken with sweet peppers.",
  });
  const plan = buildRecipePlanFromBrief(brief);

  const outline = buildFallbackRecipeOutline({
    ideaTitle: "Spanish-Inspired Chicken with Peppers",
    brief,
    recipePlan: plan,
  });

  assert.equal(outline.title, "Spanish-Inspired Chicken with Peppers");
  assert.equal(outline.dish_family, "braised");
  assert.equal(outline.primary_ingredient?.toLowerCase(), "chicken");
  assert.ok(
    outline.ingredient_groups.some((group) => group.items.some((item) => item.toLowerCase().includes("chicken")))
  );
  assert.ok(outline.step_outline.length > 0);
});

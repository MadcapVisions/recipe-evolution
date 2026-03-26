import test from "node:test";
import assert from "node:assert/strict";

type CallAiForJson = typeof import("../../lib/ai/jsonResponse").callAIForJson;
type ResolveAiTaskSettings = typeof import("../../lib/ai/taskSettings").resolveAiTaskSettings;

test("improveRecipe retries when a response substitutes sourdough bread for sourdough discard", async () => {
  const jsonResponsePath = require.resolve("../../lib/ai/jsonResponse");
  const taskSettingsPath = require.resolve("../../lib/ai/taskSettings");
  const improveRecipePath = require.resolve("../../lib/ai/improveRecipe");

  const jsonResponseModule = require(jsonResponsePath) as {
    callAIForJson: CallAiForJson;
  };
  const taskSettingsModule = require(taskSettingsPath) as {
    resolveAiTaskSettings: ResolveAiTaskSettings;
  };
  const originalJsonResponseExports = { ...jsonResponseModule };
  const originalTaskSettingsExports = { ...taskSettingsModule };

  let callCount = 0;

  const mockedCallAiForJson = (async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        provider: "openrouter",
        model: "test-model",
        text: JSON.stringify({
          title: "Bread Pudding",
          version_label: "With Sourdough",
          explanation: "Tried to use sourdough bread instead.",
          ingredients: [
            { name: "8 cups stale sourdough bread" },
            { name: "2 cups whole milk" },
            { name: "4 eggs" },
          ],
          steps: [
            { text: "Whisk the milk and eggs, then soak the sourdough bread before baking." },
          ],
        }),
        usage: { inputTokens: 10, outputTokens: 10, reasoningTokens: 0, totalTokens: 20, estimatedCostUsd: 0.001 },
        parsed: {
          title: "Bread Pudding",
          version_label: "With Sourdough",
          explanation: "Tried to use sourdough bread instead.",
          ingredients: [
            { name: "8 cups stale sourdough bread" },
            { name: "2 cups whole milk" },
            { name: "4 eggs" },
          ],
          steps: [
            { text: "Whisk the milk and eggs, then soak the sourdough bread before baking." },
          ],
        },
      };
    }

    return {
      provider: "openrouter",
      model: "test-model",
      text: JSON.stringify({
        title: "Bread Pudding",
        version_label: "With Discard",
        explanation: "Mix sourdough discard into the custard.",
        ingredients: [
          { name: "8 cups stale bread" },
          { name: "1 cup sourdough discard" },
          { name: "1.5 cups whole milk" },
          { name: "4 eggs" },
        ],
        steps: [
          { text: "Whisk the sourdough discard with the milk and eggs until smooth." },
          { text: "Soak the bread in the discard custard, then bake until set and browned." },
        ],
      }),
      usage: { inputTokens: 10, outputTokens: 10, reasoningTokens: 0, totalTokens: 20, estimatedCostUsd: 0.001 },
      parsed: {
        title: "Bread Pudding",
        version_label: "With Discard",
        explanation: "Mix sourdough discard into the custard.",
        ingredients: [
          { name: "8 cups stale bread" },
          { name: "1 cup sourdough discard" },
          { name: "1.5 cups whole milk" },
          { name: "4 eggs" },
        ],
        steps: [
          { text: "Whisk the sourdough discard with the milk and eggs until smooth." },
          { text: "Soak the bread in the discard custard, then bake until set and browned." },
        ],
      },
    };
  }) as unknown as CallAiForJson;

  const mockedResolveAiTaskSettings = (async () => ({
    taskKey: "recipe_improvement",
    label: "Recipe improvement",
    description: null,
    enabled: true,
    maxTokens: 1200,
    temperature: 0.2,
    primaryModel: "test-model",
    fallbackModel: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
  })) as unknown as ResolveAiTaskSettings;

  require.cache[jsonResponsePath]!.exports = {
    ...originalJsonResponseExports,
    callAIForJson: mockedCallAiForJson,
  };
  require.cache[taskSettingsPath]!.exports = {
    ...originalTaskSettingsExports,
    resolveAiTaskSettings: mockedResolveAiTaskSettings,
  };

  try {
    delete require.cache[improveRecipePath];
    const { improveRecipe } = require(improveRecipePath) as typeof import("../../lib/ai/improveRecipe");

    const result = await improveRecipe({
      instruction: "I want to add sourdough discard to the recipe",
      recipe: {
        title: "Bread Pudding",
        servings: 8,
        prep_time_min: 20,
        cook_time_min: 45,
        difficulty: "easy",
        ingredients: [
          { name: "8 cups stale bread" },
          { name: "2 cups whole milk" },
          { name: "4 eggs" },
        ],
        steps: [{ text: "Whisk the custard, soak the bread, and bake." }],
      },
    });

    assert.equal(callCount, 2);
    assert.ok(result.recipe.ingredients.some((ingredient) => /sourdough discard/i.test(ingredient.name)));
    assert.ok(result.recipe.steps.some((step) => /sourdough discard/i.test(step.text)));
  } finally {
    require.cache[jsonResponsePath]!.exports = originalJsonResponseExports;
    require.cache[taskSettingsPath]!.exports = originalTaskSettingsExports;
    delete require.cache[improveRecipePath];
  }
});

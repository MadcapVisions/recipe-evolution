/* eslint-disable @typescript-eslint/no-require-imports */
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

test("improveRecipe runs a repair pass when two attempts still omit sourdough discard", async () => {
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
    if (callCount < 3) {
      return {
        provider: "openrouter",
        model: "test-model",
        text: JSON.stringify({
          title: "Bread Pudding",
          version_label: "Still Standard",
          explanation: "Did not actually add discard.",
          ingredients: [
            { name: "8 cups stale bread" },
            { name: "2 cups whole milk" },
            { name: "4 eggs" },
          ],
          steps: [
            { text: "Whisk the milk and eggs, soak the bread, and bake until set." },
          ],
        }),
        usage: { inputTokens: 10, outputTokens: 10, reasoningTokens: 0, totalTokens: 20, estimatedCostUsd: 0.001 },
        parsed: {
          title: "Bread Pudding",
          version_label: "Still Standard",
          explanation: "Did not actually add discard.",
          ingredients: [
            { name: "8 cups stale bread" },
            { name: "2 cups whole milk" },
            { name: "4 eggs" },
          ],
          steps: [
            { text: "Whisk the milk and eggs, soak the bread, and bake until set." },
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
        explanation: "Repaired to include discard.",
        ingredients: [
          { name: "8 cups stale bread" },
          { name: "1 cup sourdough discard" },
          { name: "1.5 cups whole milk" },
          { name: "4 eggs" },
        ],
        steps: [
          { text: "Whisk the sourdough discard with the milk and eggs until smooth." },
          { text: "Soak the bread in the discard custard, then bake until puffed and browned." },
        ],
      }),
      usage: { inputTokens: 10, outputTokens: 10, reasoningTokens: 0, totalTokens: 20, estimatedCostUsd: 0.001 },
      parsed: {
        title: "Bread Pudding",
        version_label: "With Discard",
        explanation: "Repaired to include discard.",
        ingredients: [
          { name: "8 cups stale bread" },
          { name: "1 cup sourdough discard" },
          { name: "1.5 cups whole milk" },
          { name: "4 eggs" },
        ],
        steps: [
          { text: "Whisk the sourdough discard with the milk and eggs until smooth." },
          { text: "Soak the bread in the discard custard, then bake until puffed and browned." },
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
      instruction: "Can you add sourdough discard",
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

    assert.equal(callCount, 3);
    assert.ok(result.recipe.ingredients.some((ingredient) => /sourdough discard/i.test(ingredient.name)));
    assert.ok(result.recipe.steps.some((step) => /sourdough discard/i.test(step.text)));
  } finally {
    require.cache[jsonResponsePath]!.exports = originalJsonResponseExports;
    require.cache[taskSettingsPath]!.exports = originalTaskSettingsExports;
    delete require.cache[improveRecipePath];
  }
});

test("improveRecipe includes persisted recipe-session constraints in the model prompt", async () => {
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

  let capturedPrompt = "";

  const mockedCallAiForJson = (async (messages: Array<{ content: string }>) => {
    capturedPrompt = messages[1]?.content ?? "";
    return {
      provider: "openrouter",
      model: "test-model",
      text: JSON.stringify({
        title: "Bread Pudding",
        version_label: "Rum Version",
        explanation: "Added rum while preserving the slow cooker method.",
        ingredients: [
          { name: "8 cups stale bread" },
          { name: "1/4 cup dark rum" },
          { name: "5 eggs" },
        ],
        steps: [
          { text: "Whisk the eggs and rum together, then soak the bread." },
          { text: "Cook the pudding in the slow cooker until set." },
        ],
      }),
      usage: { inputTokens: 10, outputTokens: 10, reasoningTokens: 0, totalTokens: 20, estimatedCostUsd: 0.001 },
      parsed: {
        title: "Bread Pudding",
        version_label: "Rum Version",
        explanation: "Added rum while preserving the slow cooker method.",
        ingredients: [
          { name: "8 cups stale bread" },
          { name: "1/4 cup dark rum" },
          { name: "5 eggs" },
        ],
        steps: [
          { text: "Whisk the eggs and rum together, then soak the bread." },
          { text: "Cook the pudding in the slow cooker until set." },
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

    await improveRecipe({
      instruction: "more eggs and rum",
      sessionBrief: {
        request_mode: "revise",
        confidence: 0.9,
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
          tags: [],
          texture_tags: [],
          format_tags: [],
        },
        ingredients: {
          required: [],
          preferred: [],
          forbidden: [],
          centerpiece: null,
          requiredNamedIngredients: [],
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
          ingredients: "inferred",
          constraints: "locked",
        },
        source_turn_ids: [],
        compiler_notes: [],
      },
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
        steps: [{ text: "Whisk the custard, soak the bread, and cook until set." }],
      },
    });

    assert.match(capturedPrompt, /Persistent equipment or tool constraints: slow cooker/i);
    assert.match(capturedPrompt, /Persistent required cooking methods: slow_cook/i);
  } finally {
    require.cache[jsonResponsePath]!.exports = originalJsonResponseExports;
    require.cache[taskSettingsPath]!.exports = originalTaskSettingsExports;
    delete require.cache[improveRecipePath];
  }
});

test("improveRecipe falls back to a deterministic ingredient addition when structured output is empty", async () => {
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

  const mockedCallAiForJson = (async () => ({
    provider: "openrouter",
    model: "test-model",
    text: JSON.stringify({
      title: "Nutty Brownies with Sea Salt",
      version_label: "With Chunks",
      explanation: "Add chocolate chunks to the brownie batter.",
      ingredients: [],
      steps: [],
    }),
    usage: { inputTokens: 10, outputTokens: 10, reasoningTokens: 0, totalTokens: 20, estimatedCostUsd: 0.001 },
    parsed: {
      title: "Nutty Brownies with Sea Salt",
      version_label: "With Chunks",
      explanation: "Add chocolate chunks to the brownie batter.",
      ingredients: [],
      steps: [],
    },
  })) as unknown as CallAiForJson;

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
      instruction: "Add chocolate chunks to the recipe.",
      recipe: {
        title: "Nutty Brownies with Sea Salt",
        servings: 9,
        prep_time_min: 20,
        cook_time_min: 35,
        difficulty: "medium",
        ingredients: [
          { name: "1 cup sugar" },
          { name: "1/2 cup cocoa powder" },
          { name: "2 eggs" },
        ],
        steps: [{ text: "Mix the batter until smooth, then pour it into the prepared pan." }],
      },
    });

    assert.equal(result.meta.source, "fallback");
    assert.ok(result.recipe.ingredients.some((ingredient) => /chocolate chunks/i.test(ingredient.name)));
    assert.ok(result.recipe.steps.some((step) => /chocolate chunks/i.test(step.text)));
  } finally {
    require.cache[jsonResponsePath]!.exports = originalJsonResponseExports;
    require.cache[taskSettingsPath]!.exports = originalTaskSettingsExports;
    delete require.cache[improveRecipePath];
  }
});

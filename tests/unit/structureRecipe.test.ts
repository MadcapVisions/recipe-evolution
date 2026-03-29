/* eslint-disable @typescript-eslint/no-require-imports */
import test from "node:test";
import assert from "node:assert/strict";

type CallAiForJson = typeof import("../../lib/ai/jsonResponse").callAIForJson;
type ResolveAiTaskSettings = typeof import("../../lib/ai/taskSettings").resolveAiTaskSettings;

function createSupabaseMock() {
  return {
    from(table: string) {
      if (table === "ai_cache") {
        return {
          select(_columns: string, options?: { count?: string; head?: boolean }) {
            if (options?.head) {
              return {
                eq() {
                  return this;
                },
                gt: async () => ({ count: 0, error: null }),
              };
            }

            return {
              eq() {
                return this;
              },
              order() {
                return this;
              },
              limit() {
                return this;
              },
              maybeSingle: async () => ({ data: null, error: null }),
            };
          },
          upsert: async () => ({ error: null }),
        };
      }

      if (table === "product_events") {
        return {
          insert: async () => ({ error: null }),
        };
      }

      if (table === "ai_cia_adjudications") {
        return {
          insert: async () => ({ error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

test("structureRecipeFromRawText salvages an invalid payload through the adjudicator", async () => {
  const jsonResponsePath = require.resolve("../../lib/ai/jsonResponse");
  const taskSettingsPath = require.resolve("../../lib/ai/taskSettings");
  const structureRecipePath = require.resolve("../../lib/ai/structureRecipe");

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
          title: "Tomato Soup",
          ingredients: [{ name: "tomatoes", unit: null }],
          steps: [{ text: "Simmer the soup until done." }],
        }),
        usage: { inputTokens: 10, outputTokens: 10, reasoningTokens: 0, totalTokens: 20, estimatedCostUsd: 0.001 },
        parsed: {
          title: "Tomato Soup",
          ingredients: [{ name: "tomatoes", unit: null }],
          steps: [{ text: "Simmer the soup until done." }],
        },
      };
    }

    return {
      provider: "openrouter",
      model: "test-model",
      text: JSON.stringify({
        decision: "return_structured_recipe",
        confidence: 0.93,
        summary: "Recovered the missing ingredient quantities from the recipe text.",
        retryStrategy: "none",
        dropRequiredNamedIngredients: [],
        dropRequiredIngredients: [],
        correctedStructuredRecipe: {
          title: "Tomato Soup",
          description: "A simple tomato soup.",
          servings: 4,
          prep_time_min: 10,
          cook_time_min: 30,
          difficulty: "easy",
          tags: ["soup"],
          ingredients: [
            { name: "tomatoes", quantity: 2, unit: "lb", prep: null, optional: false, group: null },
            { name: "olive oil", quantity: 2, unit: "tbsp", prep: null, optional: false, group: null },
          ],
          steps: [
            { text: "Heat the olive oil, add the tomatoes, and simmer for 30 minutes." },
          ],
        },
      }),
      usage: { inputTokens: 10, outputTokens: 10, reasoningTokens: 0, totalTokens: 20, estimatedCostUsd: 0.001 },
      parsed: {
        decision: "return_structured_recipe",
        confidence: 0.93,
        summary: "Recovered the missing ingredient quantities from the recipe text.",
        retryStrategy: "none",
        dropRequiredNamedIngredients: [],
        dropRequiredIngredients: [],
        correctedStructuredRecipe: {
          title: "Tomato Soup",
          description: "A simple tomato soup.",
          servings: 4,
          prep_time_min: 10,
          cook_time_min: 30,
          difficulty: "easy",
          tags: ["soup"],
          ingredients: [
            { name: "tomatoes", quantity: 2, unit: "lb", prep: null, optional: false, group: null },
            { name: "olive oil", quantity: 2, unit: "tbsp", prep: null, optional: false, group: null },
          ],
          steps: [
            { text: "Heat the olive oil, add the tomatoes, and simmer for 30 minutes." },
          ],
        },
      },
    };
  }) as unknown as CallAiForJson;

  const mockedResolveAiTaskSettings = (async () => ({
    taskKey: "recipe_structure",
    label: "Recipe Structuring",
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
    delete require.cache[structureRecipePath];
    const { structureRecipeFromRawText } = require(structureRecipePath) as typeof import("../../lib/ai/structureRecipe");

    const result = await structureRecipeFromRawText({
      supabase: createSupabaseMock() as never,
      userId: "user-1",
      rawText: "Tomato Soup: simmer tomatoes with olive oil until smooth.",
    });

    assert.equal(callCount, 2);
    assert.equal(result.recipe.title, "Tomato Soup");
    assert.ok(result.recipe.ingredients.some((ingredient) => /2 lb tomatoes/i.test(ingredient.name)));
    assert.ok(result.recipe.steps.some((step) => /olive oil/i.test(step.text)));
  } finally {
    require.cache[jsonResponsePath]!.exports = originalJsonResponseExports;
    require.cache[taskSettingsPath]!.exports = originalTaskSettingsExports;
    delete require.cache[structureRecipePath];
  }
});

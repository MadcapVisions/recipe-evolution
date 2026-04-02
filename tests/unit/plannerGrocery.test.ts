import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveWeekGroceryFromAcceptedEntries,
  type AcceptedMealPlanEntry,
} from "../../lib/planner/plannerGrocery";
import type { PlannerRecipeOption } from "../../lib/plannerData";

function recipeOption(input: Partial<PlannerRecipeOption> & Pick<PlannerRecipeOption, "recipeId" | "recipeTitle" | "versionId">): PlannerRecipeOption {
  return {
    recipeId: input.recipeId,
    recipeTitle: input.recipeTitle,
    versionId: input.versionId,
    versionLabel: input.versionLabel ?? "Saved",
    servings: input.servings ?? 2,
    targetServings: input.targetServings ?? input.servings ?? 2,
    ingredients: input.ingredients ?? [],
    steps: input.steps ?? [],
  };
}

function acceptedEntry(input: Partial<AcceptedMealPlanEntry> & Pick<AcceptedMealPlanEntry, "plan_date" | "recipe_id" | "version_id">): AcceptedMealPlanEntry {
  return {
    plan_date: input.plan_date,
    sort_order: input.sort_order ?? 0,
    recipe_id: input.recipe_id,
    version_id: input.version_id,
    servings: input.servings ?? 2,
  };
}

test("accepted week derives grocery correctly with meaningful overlap", () => {
  const result = deriveWeekGroceryFromAcceptedEntries({
    acceptedEntries: [
      acceptedEntry({ plan_date: "2026-04-06", recipe_id: "r1", version_id: "v1", servings: 2 }),
      acceptedEntry({ plan_date: "2026-04-08", recipe_id: "r2", version_id: "v2", servings: 2 }),
    ],
    recipeOptions: [
      recipeOption({
        recipeId: "r1",
        recipeTitle: "Chicken Rice Bowl",
        versionId: "v1",
        ingredients: [{ name: "1 lb chicken thighs" }, { name: "2 cups spinach" }],
      }),
      recipeOption({
        recipeId: "r2",
        recipeTitle: "Spinach Pasta",
        versionId: "v2",
        ingredients: [{ name: "2 cups spinach" }, { name: "8 oz pasta" }],
      }),
    ],
    pantryStaples: [],
  });

  const spinach = result.groceryPlan.groupedItems.flatMap((group) => group.items).find((item) => item.normalized_name.includes("spinach"));

  assert.equal(result.metadata.acceptedEntryCount, 2);
  assert.ok((spinach?.quantity ?? 0) >= 4);
  assert.ok(result.metadata.mergedItemCount >= 1);
  assert.ok(result.reasons.includes("merged_overlapping_ingredients"));
});

test("servings overrides affect grocery quantities", () => {
  const result = deriveWeekGroceryFromAcceptedEntries({
    acceptedEntries: [acceptedEntry({ plan_date: "2026-04-06", recipe_id: "r1", version_id: "v1", servings: 4 })],
    recipeOptions: [
      recipeOption({
        recipeId: "r1",
        recipeTitle: "Pasta",
        versionId: "v1",
        servings: 2,
        ingredients: [{ name: "1 onion, chopped" }],
      }),
    ],
    pantryStaples: [],
  });

  const onion = result.groceryPlan.groupedItems
    .flatMap((group) => group.items)
    .concat(result.groceryPlan.flexibleItems)
    .find((item) => item.normalized_name.includes("onion"));
  assert.equal(onion?.quantity, 2);
});

test("pantry staples are suppressed from explicit settings only", () => {
  const result = deriveWeekGroceryFromAcceptedEntries({
    acceptedEntries: [acceptedEntry({ plan_date: "2026-04-06", recipe_id: "r1", version_id: "v1", servings: 2 })],
    recipeOptions: [
      recipeOption({
        recipeId: "r1",
        recipeTitle: "Greens",
        versionId: "v1",
        ingredients: [{ name: "1 tbsp olive oil" }, { name: "1 bunch kale" }],
      }),
    ],
    pantryStaples: ["olive oil"],
  });

  assert.equal(result.groceryPlan.pantryItems.length, 1);
  assert.equal(result.metadata.pantrySuppressedCount, 1);
  assert.ok(result.reasons.includes("pantry_staples_omitted"));
});

test("flexible or unfilled nights contribute no grocery items", () => {
  const result = deriveWeekGroceryFromAcceptedEntries({
    acceptedEntries: [acceptedEntry({ plan_date: "2026-04-06", recipe_id: "r1", version_id: "v1", servings: 2 })],
    recipeOptions: [
      recipeOption({
        recipeId: "r1",
        recipeTitle: "Soup",
        versionId: "v1",
        ingredients: [{ name: "2 carrots, diced" }],
      }),
    ],
    pantryStaples: [],
  });

  assert.equal(result.metadata.acceptedEntryCount, 1);
  assert.equal(result.metadata.contributingRecipeCount, 1);
});

test("mixed accepted recipe versions derive correctly", () => {
  const result = deriveWeekGroceryFromAcceptedEntries({
    acceptedEntries: [
      acceptedEntry({ plan_date: "2026-04-06", recipe_id: "r1", version_id: "v-old", servings: 2 }),
      acceptedEntry({ plan_date: "2026-04-07", recipe_id: "r1", version_id: "v-new", servings: 2, sort_order: 1 }),
    ],
    recipeOptions: [
      recipeOption({
        recipeId: "r1",
        recipeTitle: "Tacos",
        versionId: "v-old",
        ingredients: [{ name: "1 lb beef" }],
      }),
      recipeOption({
        recipeId: "r1",
        recipeTitle: "Tacos",
        versionId: "v-new",
        ingredients: [{ name: "1 lb chicken" }],
      }),
    ],
    pantryStaples: [],
  });

  const groceryNames = result.groceryPlan.groupedItems.flatMap((group) => group.items).map((item) => item.normalized_name);
  assert.ok(groceryNames.some((name) => name.includes("beef")));
  assert.ok(groceryNames.some((name) => name.includes("chicken")));
});

test("accepted week updates change derived grocery output predictably", () => {
  const recipeOptions = [
    recipeOption({
      recipeId: "r1",
      recipeTitle: "Pasta",
      versionId: "v1",
      ingredients: [{ name: "8 oz pasta" }],
    }),
    recipeOption({
      recipeId: "r2",
      recipeTitle: "Salad",
      versionId: "v2",
      ingredients: [{ name: "1 head lettuce" }],
    }),
  ];

  const before = deriveWeekGroceryFromAcceptedEntries({
    acceptedEntries: [acceptedEntry({ plan_date: "2026-04-06", recipe_id: "r1", version_id: "v1", servings: 2 })],
    recipeOptions,
    pantryStaples: [],
  });
  const after = deriveWeekGroceryFromAcceptedEntries({
    acceptedEntries: [acceptedEntry({ plan_date: "2026-04-07", recipe_id: "r2", version_id: "v2", servings: 2 })],
    recipeOptions,
    pantryStaples: [],
  });

  const beforeNames = before.groceryPlan.groupedItems.flatMap((group) => group.items).map((item) => item.normalized_name);
  const afterNames = after.groceryPlan.groupedItems.flatMap((group) => group.items).map((item) => item.normalized_name);
  assert.notDeepEqual(beforeNames, afterNames);
});

test("transient draft changes do not affect grocery before apply", () => {
  const accepted = deriveWeekGroceryFromAcceptedEntries({
    acceptedEntries: [acceptedEntry({ plan_date: "2026-04-06", recipe_id: "r1", version_id: "v1", servings: 2 })],
    recipeOptions: [
      recipeOption({
        recipeId: "r1",
        recipeTitle: "Accepted Soup",
        versionId: "v1",
        ingredients: [{ name: "2 carrots, diced" }],
      }),
      recipeOption({
        recipeId: "r2",
        recipeTitle: "Draft Pasta",
        versionId: "v2",
        ingredients: [{ name: "8 oz pasta" }],
      }),
    ],
    pantryStaples: [],
  });

  const groceryNames = accepted.groceryPlan.groupedItems
    .flatMap((group) => group.items)
    .map((item) => item.normalized_name)
    .concat(accepted.groceryPlan.flexibleItems.map((item) => item.normalized_name));

  assert.ok(groceryNames.some((name) => name.includes("carrot")));
  assert.ok(!groceryNames.some((name) => name.includes("pasta")));
});

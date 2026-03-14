import test from "node:test";
import assert from "node:assert/strict";
import {
  formatGroceryItemDisplay,
  formatScaledQuantity,
  scaleCanonicalIngredientLine,
  scaleGroceryItemsForServings,
  scaleQuantityForServings,
} from "../../lib/recipes/servings";

test("scaleQuantityForServings scales ingredient quantities proportionally", () => {
  assert.equal(scaleQuantityForServings(2, 4, 6), 3);
  assert.equal(scaleQuantityForServings(1.5, 4, 2), 0.75);
});

test("formatScaledQuantity trims trailing zeros for display", () => {
  assert.equal(formatScaledQuantity(2), "2");
  assert.equal(formatScaledQuantity(1.5), "1.5");
  assert.equal(formatScaledQuantity(0.75), "0.75");
});

test("scaleCanonicalIngredientLine rewrites the displayed quantity while preserving the ingredient text", () => {
  assert.equal(scaleCanonicalIngredientLine("2 tbsp olive oil", 4, 6), "3 tbsp olive oil");
  assert.equal(scaleCanonicalIngredientLine("1 onion, chopped", 2, 4), "2 onion, chopped");
  assert.equal(scaleCanonicalIngredientLine("fresh basil", 2, 4), "fresh basil");
});

test("scaleGroceryItemsForServings adjusts quantities without changing checked state", () => {
  assert.deepEqual(
    scaleGroceryItemsForServings(
      [
        {
          id: "1",
          name: "olive oil",
          normalized_name: "olive oil",
          quantity: 2,
          unit: "tbsp",
          prep: null,
          checked: true,
        },
      ],
      4,
      8
    ),
    [
      {
        id: "1",
        name: "olive oil",
        normalized_name: "olive oil",
        quantity: 4,
        unit: "tbsp",
        prep: null,
        checked: true,
      },
    ]
  );
});

test("formatGroceryItemDisplay avoids duplicating parsed quantity and unit", () => {
  assert.deepEqual(formatGroceryItemDisplay({ name: "24 oz bread", quantity: 24, unit: "oz" }), {
    primary: "24 oz bread",
    secondary: null,
  });
  assert.deepEqual(formatGroceryItemDisplay({ name: "3 cups onion", quantity: 3, unit: "cup" }), {
    primary: "3 cups onion",
    secondary: null,
  });
});

test("formatGroceryItemDisplay flags items with no parsed amount", () => {
  assert.deepEqual(formatGroceryItemDisplay({ name: "broth", quantity: null, unit: null }), {
    primary: "Broth",
    secondary: null,
  });
});

test("formatGroceryItemDisplay normalizes leading capitalization", () => {
  assert.deepEqual(formatGroceryItemDisplay({ name: "quick-pickled shallots", quantity: null, unit: null }), {
    primary: "Quick-pickled shallots",
    secondary: null,
  });
});

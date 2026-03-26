import test from "node:test";
import assert from "node:assert/strict";
import { RECIPE_BENCHMARK_CASES } from "../../lib/ai/recipeBenchmarkCases";

test("no duplicate case IDs", () => {
  const ids = RECIPE_BENCHMARK_CASES.map((c) => c.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, `Duplicate IDs: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(", ")}`);
});

test("all cases have required fields", () => {
  for (const c of RECIPE_BENCHMARK_CASES) {
    assert.ok(c.id, `Missing id`);
    assert.ok(c.prompt, `Case ${c.id}: missing prompt`);
    if (c.category !== "messy") {
      assert.ok(c.expectedDishFamily, `Case ${c.id}: missing expectedDishFamily`);
    }
    assert.ok(typeof c.shouldPass === "boolean", `Case ${c.id}: shouldPass must be boolean`);
  }
});

test("mustHaveClasses and mustNotHaveClasses have no overlap", () => {
  for (const c of RECIPE_BENCHMARK_CASES) {
    const have = new Set(c.mustHaveClasses ?? []);
    const notHave = c.mustNotHaveClasses ?? [];
    const overlap = notHave.filter((cls) => have.has(cls));
    assert.equal(
      overlap.length,
      0,
      `Case ${c.id}: class appears in both mustHave and mustNotHave: ${overlap.join(", ")}`
    );
  }
});

test("macroTargets values are positive when present", () => {
  for (const c of RECIPE_BENCHMARK_CASES) {
    if (!c.macroTargets) continue;
    const m = c.macroTargets;
    if (m.caloriesMax != null) assert.ok(m.caloriesMax > 0, `Case ${c.id}: caloriesMax must be positive`);
    if (m.proteinMinG != null) assert.ok(m.proteinMinG > 0, `Case ${c.id}: proteinMinG must be positive`);
    if (m.carbsMaxG != null) assert.ok(m.carbsMaxG > 0, `Case ${c.id}: carbsMaxG must be positive`);
    if (m.fatMaxG != null) assert.ok(m.fatMaxG > 0, `Case ${c.id}: fatMaxG must be positive`);
  }
});

test("servings are positive integers when present", () => {
  for (const c of RECIPE_BENCHMARK_CASES) {
    if (c.servings == null) continue;
    assert.ok(c.servings > 0 && Number.isInteger(c.servings), `Case ${c.id}: servings must be a positive integer`);
  }
});

test("reject and messy-conflict cases are the only shouldPass=false cases", () => {
  const failing = RECIPE_BENCHMARK_CASES.filter((c) => c.shouldPass === false);
  assert.deepEqual(
    failing.map((c) => c.id),
    [
      "impossible_dessert_macro_01",
      "reject_brownie_highprotein_lowcal_01",
      "reject_smoothie_highprotein_lowcal_01",
      "reject_cookie_lowcal_01",
      "reject_pasta_lowcarb_01",
      "messy_conflict_01",
      "messy_conflict_05",
    ]
  );
});

test("at least one case per major dish category exists", () => {
  const families = new Set(RECIPE_BENCHMARK_CASES.map((c) => c.expectedDishFamily));
  const expected = [
    "custard_flan", "brownie", "cookie", "cheesecake",
    "muffin_quick_bread", "pancake_waffle", "risotto", "stir_fry",
    "fried_rice", "curry", "pasta", "soup_stew", "smoothie",
    "salad", "omelet_frittata", "tacos", "pizza_flatbread", "sandwich_wrap",
  ];
  for (const family of expected) {
    assert.ok(families.has(family), `Missing dish family in benchmark cases: ${family}`);
  }
});

test("dietary constraint cases are present", () => {
  const constrainedCases = RECIPE_BENCHMARK_CASES.filter(
    (c) => c.dietaryConstraints && c.dietaryConstraints.length > 0
  );
  assert.ok(constrainedCases.length >= 3, `Expected at least 3 dietary constraint cases`);
});

test("macro target cases are present", () => {
  const macroCases = RECIPE_BENCHMARK_CASES.filter((c) => c.macroTargets != null);
  assert.ok(macroCases.length >= 3, `Expected at least 3 macro target cases`);
});

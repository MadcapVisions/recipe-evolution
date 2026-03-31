import test from "node:test";
import assert from "node:assert/strict";
import {
  assignIngredientRoles,
  checkRoleCoverage,
  ROLE_LOOKUP,
} from "../../lib/ai/blueprint/ingredientRoles";

test("assignIngredientRoles assigns known ingredients to correct roles", () => {
  const result = assignIngredientRoles(["chicken thigh", "olive oil", "garlic"], "skillet_saute");
  assert.equal(result["chicken thigh"], "protein");
  assert.equal(result["olive oil"], "fat");
  assert.equal(result["garlic"], "aromatic");
});

test("assignIngredientRoles assigns unknown ingredient to null", () => {
  const result = assignIngredientRoles(["zorgblax_unobtainium"], "skillet_saute");
  assert.equal(result["zorgblax_unobtainium"], null);
});

test("assignIngredientRoles handles empty list", () => {
  const result = assignIngredientRoles([], "pasta");
  assert.deepEqual(result, {});
});

test("checkRoleCoverage detects missing required roles", () => {
  // skillet_saute requires protein, fat, aromatic — only fat provided
  const coverage = checkRoleCoverage({ "olive oil": "fat" }, "skillet_saute");
  assert.equal(coverage.covered, false);
  assert.ok(coverage.missingRoles.includes("protein"));
  assert.ok(coverage.missingRoles.includes("aromatic"));
  assert.ok(!coverage.missingRoles.includes("fat"));
});

test("checkRoleCoverage passes when all required roles are present", () => {
  const coverage = checkRoleCoverage(
    { "chicken thigh": "protein", "olive oil": "fat", "garlic": "aromatic" },
    "skillet_saute"
  );
  assert.equal(coverage.covered, true);
  assert.deepEqual(coverage.missingRoles, []);
});

test("checkRoleCoverage uses FALLBACK_BLUEPRINT_RULE for unknown family", () => {
  // fallback requires protein, fat, seasoning
  const coverage = checkRoleCoverage(
    { "chicken": "protein", "butter": "fat", "salt": "seasoning" },
    "unknown_family_xyz"
  );
  assert.equal(coverage.covered, true);
});

test("ROLE_LOOKUP covers core culinary categories", () => {
  assert.equal(ROLE_LOOKUP["butter"], "fat");
  assert.equal(ROLE_LOOKUP["lemon juice"], "acid");
  assert.equal(ROLE_LOOKUP["soy sauce"], "umami");
  assert.equal(ROLE_LOOKUP["onion"], "aromatic");
  assert.equal(ROLE_LOOKUP["pasta"], "base");
  assert.equal(ROLE_LOOKUP["chicken thigh"], "protein");
  assert.equal(ROLE_LOOKUP["chili flakes"], "heat");
  assert.equal(ROLE_LOOKUP["fresh parsley"], "finish");
});

test("assignIngredientRoles is case-insensitive for known ingredients", () => {
  const result = assignIngredientRoles(["Chicken Thigh", "Olive Oil"], "skillet_saute");
  assert.equal(result["Chicken Thigh"], "protein");
  assert.equal(result["Olive Oil"], "fat");
});

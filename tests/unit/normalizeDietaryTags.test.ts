import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDietaryTags } from "../../lib/ai/normalizeDietaryTags";

test("canonical forms map correctly", () => {
  assert.deepEqual(normalizeDietaryTags(["vegan"]), ["vegan"]);
  assert.deepEqual(normalizeDietaryTags(["vegetarian"]), ["vegetarian"]);
  assert.deepEqual(normalizeDietaryTags(["gluten_free"]), ["gluten_free"]);
  assert.deepEqual(normalizeDietaryTags(["dairy_free"]), ["dairy_free"]);
  assert.deepEqual(normalizeDietaryTags(["nut_free"]), ["nut_free"]);
  assert.deepEqual(normalizeDietaryTags(["low_carb"]), ["low_carb"]);
  assert.deepEqual(normalizeDietaryTags(["high_protein"]), ["high_protein"]);
});

test("compact aliases resolve correctly", () => {
  assert.deepEqual(normalizeDietaryTags(["plantbased"]), ["vegan"]);
  assert.deepEqual(normalizeDietaryTags(["glutenfree"]), ["gluten_free"]);
  assert.deepEqual(normalizeDietaryTags(["dairyfree"]), ["dairy_free"]);
  assert.deepEqual(normalizeDietaryTags(["lactosefree"]), ["dairy_free"]);
  assert.deepEqual(normalizeDietaryTags(["lactose_free"]), ["dairy_free"]);
  assert.deepEqual(normalizeDietaryTags(["nutfree"]), ["nut_free"]);
  assert.deepEqual(normalizeDietaryTags(["peanutfree"]), ["nut_free"]);
  assert.deepEqual(normalizeDietaryTags(["peanut_free"]), ["nut_free"]);
  assert.deepEqual(normalizeDietaryTags(["lowcarb"]), ["low_carb"]);
  assert.deepEqual(normalizeDietaryTags(["highprotein"]), ["high_protein"]);
  assert.deepEqual(normalizeDietaryTags(["proteinrich"]), ["high_protein"]);
  assert.deepEqual(normalizeDietaryTags(["protein_rich"]), ["high_protein"]);
});

test("hyphenated and spaced variants resolve correctly", () => {
  assert.deepEqual(normalizeDietaryTags(["plant-based"]), ["vegan"]);
  assert.deepEqual(normalizeDietaryTags(["plant based"]), ["vegan"]);
  assert.deepEqual(normalizeDietaryTags(["gluten-free"]), ["gluten_free"]);
  assert.deepEqual(normalizeDietaryTags(["gluten free"]), ["gluten_free"]);
  assert.deepEqual(normalizeDietaryTags(["dairy-free"]), ["dairy_free"]);
  assert.deepEqual(normalizeDietaryTags(["nut-free"]), ["nut_free"]);
  assert.deepEqual(normalizeDietaryTags(["low-carb"]), ["low_carb"]);
  assert.deepEqual(normalizeDietaryTags(["high-protein"]), ["high_protein"]);
  assert.deepEqual(normalizeDietaryTags(["protein-rich"]), ["high_protein"]);
});

test("convenience aliases resolve correctly", () => {
  assert.deepEqual(normalizeDietaryTags(["keto"]), ["low_carb"]);
  assert.deepEqual(normalizeDietaryTags(["ketogenic"]), ["low_carb"]);
  assert.deepEqual(normalizeDietaryTags(["gf"]), ["gluten_free"]);
  assert.deepEqual(normalizeDietaryTags(["celiac"]), ["gluten_free"]);
  assert.deepEqual(normalizeDietaryTags(["veggie"]), ["vegetarian"]);
  assert.deepEqual(normalizeDietaryTags(["no gluten"]), ["gluten_free"]);
  assert.deepEqual(normalizeDietaryTags(["no dairy"]), ["dairy_free"]);
  assert.deepEqual(normalizeDietaryTags(["no nuts"]), ["nut_free"]);
  assert.deepEqual(normalizeDietaryTags(["no carbs"]), ["low_carb"]);
});

test("unknown tags are silently dropped", () => {
  assert.deepEqual(normalizeDietaryTags(["paleo", "whole30", "organic"]), []);
});

test("case-insensitive matching", () => {
  assert.deepEqual(normalizeDietaryTags(["Vegan"]), ["vegan"]);
  assert.deepEqual(normalizeDietaryTags(["GLUTEN-FREE"]), ["gluten_free"]);
  assert.deepEqual(normalizeDietaryTags(["High-Protein"]), ["high_protein"]);
});

test("duplicates are deduplicated", () => {
  assert.deepEqual(
    normalizeDietaryTags(["vegan", "plant-based", "plantbased"]),
    ["vegan"]
  );
  assert.deepEqual(
    normalizeDietaryTags(["gluten_free", "gluten-free", "gf", "celiac"]),
    ["gluten_free"]
  );
});

test("mixed valid and invalid returns only valid", () => {
  const result = normalizeDietaryTags(["vegan", "junk", "keto", "unknown"]);
  assert.deepEqual(result, ["vegan", "low_carb"]);
});

test("empty input returns empty array", () => {
  assert.deepEqual(normalizeDietaryTags([]), []);
});

test("whitespace is trimmed", () => {
  assert.deepEqual(normalizeDietaryTags(["  vegan  ", " keto "]), ["vegan", "low_carb"]);
});

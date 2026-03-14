import test from "node:test";
import assert from "node:assert/strict";
import { combineMeasuredQuantities, normalizeMeasurementUnit } from "../../lib/recipes/measurements";

test("normalizeMeasurementUnit maps common aliases", () => {
  assert.equal(normalizeMeasurementUnit("tablespoons"), "tbsp");
  assert.equal(normalizeMeasurementUnit("cups"), "cup");
});

test("combineMeasuredQuantities converts compatible volume units", () => {
  assert.deepEqual(
    combineMeasuredQuantities(
      { quantity: 1, unit: "tbsp" },
      { quantity: 3, unit: "tsp" }
    ),
    { quantity: 2, unit: "tbsp" }
  );
});

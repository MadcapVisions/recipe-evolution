import test from "node:test";
import assert from "node:assert/strict";
import {
  RESCUE_SCENARIOS,
  RESCUE_SCENARIO_LABELS,
  RESCUE_SCENARIO_DESCRIPTIONS,
} from "../../lib/ai/coaching/rescueScenarios";
import type { RescueScenario } from "../../lib/ai/coaching/rescueScenarios";

test("RESCUE_SCENARIOS has exactly 11 entries", () => {
  assert.equal(RESCUE_SCENARIOS.length, 11);
});

test("RESCUE_SCENARIOS includes all expected cook-time failure types", () => {
  const expected: RescueScenario[] = [
    "too_salty",
    "too_thin",
    "too_thick",
    "overbrowned_aromatics",
    "underseasoned",
    "too_wet_watery",
    "dry_protein",
    "broken_sauce",
    "texture_not_crisping",
    "dough_batter_too_wet",
    "dough_batter_too_dry",
  ];
  for (const s of expected) {
    assert.ok(RESCUE_SCENARIOS.includes(s), `Missing: ${s}`);
  }
});

test("all scenarios have a label", () => {
  for (const s of RESCUE_SCENARIOS) {
    assert.ok(RESCUE_SCENARIO_LABELS[s], `Missing label: ${s}`);
  }
});

test("all scenarios have a description", () => {
  for (const s of RESCUE_SCENARIOS) {
    assert.ok(RESCUE_SCENARIO_DESCRIPTIONS[s], `Missing description: ${s}`);
    assert.ok(RESCUE_SCENARIO_DESCRIPTIONS[s].length > 10, `Description too short: ${s}`);
  }
});

test("no duplicate scenario values", () => {
  const set = new Set(RESCUE_SCENARIOS);
  assert.equal(set.size, RESCUE_SCENARIOS.length);
});

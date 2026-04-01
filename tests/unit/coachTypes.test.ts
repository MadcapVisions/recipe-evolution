import test from "node:test";
import assert from "node:assert/strict";
import type { CookingCoach, ChefSecret, WatchFor, MistakePrevention, RecoveryMove } from "../../lib/ai/coaching/coachTypes";
import { RESCUE_SCENARIOS, RESCUE_SCENARIO_LABELS, RESCUE_SCENARIO_DESCRIPTIONS } from "../../lib/ai/coaching/rescueScenarios";
import type { RescueScenario } from "../../lib/ai/coaching/rescueScenarios";

test("RESCUE_SCENARIOS contains all expected scenarios", () => {
  assert.ok(RESCUE_SCENARIOS.includes("too_salty"));
  assert.ok(RESCUE_SCENARIOS.includes("dry_protein"));
  assert.ok(RESCUE_SCENARIOS.includes("broken_sauce"));
  assert.ok(RESCUE_SCENARIOS.includes("texture_not_crisping"));
  assert.equal(RESCUE_SCENARIOS.length, 11);
});

test("RESCUE_SCENARIO_LABELS covers all scenarios", () => {
  for (const scenario of RESCUE_SCENARIOS) {
    assert.ok(
      scenario in RESCUE_SCENARIO_LABELS,
      `Missing label for scenario: ${scenario}`
    );
    assert.ok(RESCUE_SCENARIO_LABELS[scenario].length > 0);
  }
});

test("RESCUE_SCENARIO_DESCRIPTIONS covers all scenarios", () => {
  for (const scenario of RESCUE_SCENARIOS) {
    assert.ok(
      scenario in RESCUE_SCENARIO_DESCRIPTIONS,
      `Missing description for scenario: ${scenario}`
    );
    assert.ok(RESCUE_SCENARIO_DESCRIPTIONS[scenario].length > 0);
  }
});

test("CookingCoach shape is structurally valid", () => {
  const coach: CookingCoach = {
    chefSecrets: [],
    watchFors: [],
    mistakePreviews: [],
    recoveryMoves: [],
    generatedFrom: "req-001",
    generatedAt: new Date().toISOString(),
  };
  assert.ok(Array.isArray(coach.chefSecrets));
  assert.ok(Array.isArray(coach.watchFors));
  assert.ok(Array.isArray(coach.mistakePreviews));
  assert.ok(Array.isArray(coach.recoveryMoves));
  assert.equal(typeof coach.generatedFrom, "string");
  assert.equal(typeof coach.generatedAt, "string");
});

test("ChefSecret with step linkage is structurally valid", () => {
  const secret: ChefSecret = {
    text: "Pat the protein completely dry before searing",
    rationale: "Moisture steams the surface instead of searing it",
    stepLinkage: { stepIndex: 0, stepText: "Pat chicken dry" },
  };
  assert.ok(secret.stepLinkage);
  assert.equal(secret.stepLinkage.stepIndex, 0);
});

test("WatchFor with importance levels is valid", () => {
  const watchFor: WatchFor = {
    cue: "Pan should shimmer but not smoke",
    importance: "critical",
  };
  assert.equal(watchFor.importance, "critical");
  assert.equal(watchFor.stepLinkage, undefined);
});

test("RecoveryMove references a valid RescueScenario", () => {
  const move: RecoveryMove = {
    scenario: "dry_protein",
    move: "Slice thinly and serve with sauce spooned over to add moisture",
    familyAware: true,
  };
  const scenario: RescueScenario = move.scenario;
  assert.ok(RESCUE_SCENARIOS.includes(scenario));
});

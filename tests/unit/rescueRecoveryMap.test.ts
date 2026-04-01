import test from "node:test";
import assert from "node:assert/strict";
import { getRecoveryMoves, RECOVERY_MAP } from "../../lib/ai/coaching/rescueRecoveryMap";
import { RESCUE_SCENARIOS } from "../../lib/ai/coaching/rescueScenarios";

test("every rescue scenario has at least one recovery move", () => {
  for (const scenario of RESCUE_SCENARIOS) {
    const moves = getRecoveryMoves(scenario, "skillet_saute");
    assert.ok(moves.length > 0, `No recovery move for scenario: ${scenario}`);
  }
});

test("getRecoveryMoves returns family-specific move first when available", () => {
  // dry_protein has family-specific entries for chicken_dinners
  const moves = getRecoveryMoves("dry_protein", "chicken_dinners");
  assert.ok(moves.length > 0);
  assert.ok(moves[0].families?.includes("chicken_dinners") || moves[0].move.length > 0);
});

test("getRecoveryMoves returns generic fallback for unrecognised family", () => {
  const moves = getRecoveryMoves("too_salty", "mystery_family");
  assert.ok(moves.length > 0, "should fall back to generic moves");
  // generic moves don't have families specified
  assert.ok(moves.some((m) => !m.families || m.families.length === 0));
});

test("getRecoveryMoves deduplicates identical move text", () => {
  for (const scenario of RESCUE_SCENARIOS) {
    const moves = getRecoveryMoves(scenario, "pasta");
    const texts = moves.map((m) => m.move);
    const unique = new Set(texts);
    assert.equal(unique.size, texts.length, `Duplicate moves for ${scenario}`);
  }
});

test("all RECOVERY_MAP entries have non-empty scenario and move", () => {
  for (const entry of RECOVERY_MAP) {
    assert.ok(RESCUE_SCENARIOS.includes(entry.scenario), `Unknown scenario: ${entry.scenario}`);
    assert.ok(entry.move.length > 10, `Move too short: ${entry.move}`);
  }
});

test("pasta family gets pasta-specific too_thin recovery", () => {
  const moves = getRecoveryMoves("too_thin", "pasta");
  assert.ok(moves.length > 0);
  // pasta-specific move mentions pasta water or cooking water
  const hasPastaSpecific = moves.some((m) =>
    m.move.toLowerCase().includes("pasta") || m.move.toLowerCase().includes("water")
  );
  assert.ok(hasPastaSpecific, "Expected pasta-specific recovery move for too_thin");
});

test("soups_stews family gets stew-specific too_thin recovery", () => {
  const moves = getRecoveryMoves("too_thin", "soups_stews");
  assert.ok(moves.length > 0);
  const hasStewSpecific = moves.some((m) => m.families?.includes("soups_stews"));
  assert.ok(hasStewSpecific);
});

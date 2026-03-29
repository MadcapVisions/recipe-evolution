import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  replaySessionCoherenceFixture,
  type SessionCoherenceFixture,
} from "../../lib/ai/evals/sessionCoherenceFixtureReplay";

const FIXTURE_DIR = path.join(process.cwd(), "tests/fixtures/session-coherence");

test("session coherence fixtures replay real drift cases deterministically", () => {
  const fixtureFiles = fs.readdirSync(FIXTURE_DIR).filter((file) => file.endsWith(".json")).sort();
  assert.ok(fixtureFiles.length > 0);

  for (const file of fixtureFiles) {
    const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), "utf8")) as SessionCoherenceFixture;
    const replay = replaySessionCoherenceFixture(fixture);

    if (fixture.kind === "cropped_option_tail") {
      assert.equal(replay.merged_turn_count, fixture.expected.merged_turn_count, `${fixture.id}: merged_turn_count`);
      assert.match(
        String(replay.history_anchor ?? ""),
        new RegExp(fixture.expected.history_anchor_hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        `${fixture.id}: history_anchor_hint`
      );
      assert.match(
        String(replay.active_dish_title ?? ""),
        new RegExp(fixture.expected.active_dish_hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        `${fixture.id}: active_dish_hint`
      );
      assert.equal(replay.last_user_message, fixture.expected.last_user_message, `${fixture.id}: last_user_message`);
    } else {
      assert.deepEqual(replay.contradiction_kinds, fixture.expected.contradiction_kinds, `${fixture.id}: contradiction_kinds`);
      assert.equal(replay.verification_passes, fixture.expected.verification_passes, `${fixture.id}: verification_passes`);
      assert.equal(replay.selected_direction_match, fixture.expected.selected_direction_match, `${fixture.id}: selected_direction_match`);
      assert.equal(replay.required_techniques_present, fixture.expected.required_techniques_present, `${fixture.id}: required_techniques_present`);
      assert.equal(replay.equipment_limits_present, fixture.expected.equipment_limits_present, `${fixture.id}: equipment_limits_present`);
    }
  }
});

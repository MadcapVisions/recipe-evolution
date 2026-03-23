import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { replayRecipeFailureFixture, type RecipeFailureFixture } from "../../lib/ai/evals/failureFixtureReplay";

const FIXTURE_DIR = path.join(process.cwd(), "tests/fixtures/ai-failures");

test("recipe failure fixtures replay through parse, normalization, and structural validation", () => {
  const fixtureFiles = fs.readdirSync(FIXTURE_DIR).filter((file) => file.endsWith(".json")).sort();
  assert.ok(fixtureFiles.length > 0);

  for (const file of fixtureFiles) {
    const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), "utf8")) as RecipeFailureFixture;
    const replay = replayRecipeFailureFixture(fixture);

    assert.equal(replay.parse_success, fixture.expected.parse_success, `${fixture.id}: parse_success`);
    assert.equal(replay.normalization_reason, fixture.expected.normalization_reason, `${fixture.id}: normalization_reason`);
    assert.equal(replay.structural_passes, fixture.expected.structural_passes, `${fixture.id}: structural_passes`);
    assert.equal(replay.normalized_title, fixture.expected.title, `${fixture.id}: normalized_title`);
    if (fixture.expected.outcome != null) {
      assert.equal(replay.derived_outcome, fixture.expected.outcome, `${fixture.id}: derived_outcome`);
    }
    if (fixture.expected.failure_stage != null) {
      assert.equal(replay.derived_failure_stage, fixture.expected.failure_stage, `${fixture.id}: derived_failure_stage`);
    }
  }
});

import fs from "node:fs";
import path from "node:path";
import { resolveAiTaskSettings } from "../lib/ai/taskSettings";
import { replayCiaFailureFixture } from "../lib/ai/evals/ciaFixtureReplay";
import type { CiaFailureFixture } from "../lib/ai/evals/ciaFixtureExport";

const FIXTURE_DIR = path.join(process.cwd(), "tests/fixtures/cia-failures");

async function main() {
  const mode = (process.argv[2] ?? "heuristic").trim();
  const fixtureFiles = fs.existsSync(FIXTURE_DIR)
    ? fs.readdirSync(FIXTURE_DIR).filter((file) => file.endsWith(".json")).sort()
    : [];

  if (fixtureFiles.length === 0) {
    process.stdout.write("no CIA fixtures found\n");
    return;
  }

  const baseSetting = await resolveAiTaskSettings("recipe_cia");
  const taskSetting =
    mode === "ai"
      ? baseSetting
      : {
          ...baseSetting,
          enabled: false,
        };

  let mismatches = 0;
  for (const fileName of fixtureFiles) {
    const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fileName), "utf8")) as CiaFailureFixture;
    const replay = await replayCiaFailureFixture(fixture, { taskSetting });
    const observedDecision = fixture.observed?.decision ?? null;
    const status = observedDecision && replay.decision !== observedDecision ? "MISMATCH" : "ok";
    if (status === "MISMATCH") {
      mismatches += 1;
    }
    process.stdout.write(
      `${status} ${fixture.id} observed=${observedDecision ?? "none"} replay=${replay.decision} confidence=${replay.confidence.toFixed(2)}\n`
    );
  }

  process.stdout.write(`replayed ${fixtureFiles.length} CIA fixture(s); ${mismatches} mismatch(es)\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

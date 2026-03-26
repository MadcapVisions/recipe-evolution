import test from "node:test";
import assert from "node:assert/strict";
import {
  RecipeTelemetry,
  withTelemetryTiming,
} from "../../lib/ai/recipeTelemetry";

// ── RecipeTelemetry.log + getSummary ──────────────────────────────────────────

test("RecipeTelemetry starts with empty events", () => {
  const t = new RecipeTelemetry("req_001");
  const s = t.getSummary();
  assert.equal(s.totalEvents, 0);
  assert.equal(s.accepted, false);
  assert.equal(s.finalStatus, null);
  assert.equal(s.dishFamily, null);
});

test("RecipeTelemetry.log records events and summary aggregates correctly", () => {
  const t = new RecipeTelemetry("req_002");

  t.log({ stage: "dish_family_selection", status: "success", dishFamily: "curry" });
  t.log({
    stage: "ingredient_planning",
    status: "warning",
    issues: [{ code: "LOW_PROTEIN", severity: "warning", message: "protein low" }],
  });
  t.log({ stage: "final_decision", status: "accepted", dishFamily: "curry" });

  const s = t.getSummary();
  assert.equal(s.totalEvents, 3);
  assert.equal(s.accepted, true);
  assert.equal(s.finalStatus, "accepted");
  assert.equal(s.dishFamily, "curry");
  assert.equal(s.warningCount, 1);
  assert.equal(s.errorCount, 0);
  assert.equal(s.retryCount, 0);
  assert.deepEqual(s.stagesSeen, [
    "dish_family_selection",
    "ingredient_planning",
    "final_decision",
  ]);
  assert.equal(s.issueCountsByCode["LOW_PROTEIN"], 1);
});

test("getSummary counts retries correctly", () => {
  const t = new RecipeTelemetry("req_003");
  t.log({ stage: "ingredient_planning", status: "retry" });
  t.log({ stage: "ingredient_planning", status: "retry" });
  t.log({ stage: "ingredient_planning", status: "success" });

  const s = t.getSummary();
  assert.equal(s.retryCount, 2);
});

test("getSummary.dishFamily falls back to first event with a dishFamily", () => {
  const t = new RecipeTelemetry("req_004");
  t.log({ stage: "dish_family_selection", status: "success", dishFamily: "brownie" });
  t.log({ stage: "final_decision", status: "rejected" });

  const s = t.getSummary();
  // finalEvent.dishFamily is null (rejected has no family), but first event does
  assert.equal(s.dishFamily, "brownie");
});

test("getSummary.totalDurationMs sums durationMs across events", () => {
  const t = new RecipeTelemetry("req_005");
  t.log({ stage: "dish_family_selection", status: "success", durationMs: 100 });
  t.log({ stage: "ingredient_planning", status: "success", durationMs: 250 });

  const s = t.getSummary();
  assert.equal(s.totalDurationMs, 350);
});

test("getSummary.totalDurationMs is null when no events have durationMs", () => {
  const t = new RecipeTelemetry("req_006");
  t.log({ stage: "dish_family_selection", status: "success" });

  const s = t.getSummary();
  assert.equal(s.totalDurationMs, null);
});

test("getSummary.issueCountsByCode merges across multiple events", () => {
  const t = new RecipeTelemetry("req_007");
  t.log({
    stage: "ingredient_planning",
    status: "warning",
    issues: [
      { code: "MISSING_CLASS", severity: "warning", message: "a" },
      { code: "MISSING_CLASS", severity: "warning", message: "b" },
    ],
  });
  t.log({
    stage: "full_recipe_validation",
    status: "error",
    issues: [{ code: "MISSING_CLASS", severity: "error", message: "c" }],
  });

  const s = t.getSummary();
  assert.equal(s.issueCountsByCode["MISSING_CLASS"], 3);
});

// ── withTelemetryTiming ───────────────────────────────────────────────────────

test("withTelemetryTiming logs success event with durationMs", async () => {
  const t = new RecipeTelemetry("req_010");

  const result = await withTelemetryTiming(
    t,
    { stage: "ingredient_planning", statusOnSuccess: "success" },
    async () => 42
  );

  assert.equal(result, 42);
  const events = t.getSession().events;
  assert.equal(events.length, 1);
  assert.equal(events[0].stage, "ingredient_planning");
  assert.equal(events[0].status, "success");
  assert.ok(typeof events[0].durationMs === "number" && events[0].durationMs >= 0);
});

test("withTelemetryTiming logs error event and rethrows", async () => {
  const t = new RecipeTelemetry("req_011");

  await assert.rejects(
    () =>
      withTelemetryTiming(
        t,
        { stage: "step_generation", statusOnError: "error" },
        async () => {
          throw new Error("step gen failed");
        }
      ),
    /step gen failed/
  );

  const events = t.getSession().events;
  assert.equal(events.length, 1);
  assert.equal(events[0].status, "error");
  assert.equal(events[0].issues?.[0]?.code, "TELEMETRY_STAGE_EXCEPTION");
  assert.match(events[0].issues?.[0]?.message ?? "", /step gen failed/);
});

test("withTelemetryTiming defaults to 'success' and 'error' statuses", async () => {
  const t = new RecipeTelemetry("req_012");

  await withTelemetryTiming(t, { stage: "dish_family_selection" }, async () => "ok");
  assert.equal(t.getSession().events[0].status, "success");
});

// ── toJson ────────────────────────────────────────────────────────────────────

test("toJson returns parseable JSON with session and summary keys", () => {
  const t = new RecipeTelemetry("req_020");
  t.log({ stage: "dish_family_selection", status: "success" });

  const parsed = JSON.parse(t.toJson());
  assert.ok("session" in parsed);
  assert.ok("summary" in parsed);
  assert.equal(parsed.session.requestId, "req_020");
});

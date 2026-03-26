# Recipe Engine Benchmark Policy

This policy defines how benchmark results are interpreted across suite types so the team can evaluate product quality honestly, distinguish product failures from harness issues, and make release decisions consistently.

This replaces any earlier benchmark logic that blended feasible and reject cases, treated all `regenerate_from_ingredients` outcomes as failures, or used a single turbulence threshold across all suite types.

---

## 1. Suite types

### Smoke
Fast sanity check. One case per major family, one dietary, one macro, one reject, one messy. ~10–15 cases. Use for local validation after code changes.

### Core
Primary pre-merge quality suite. Representative coverage across all categories. ~25–35 cases. Use for normal engineering validation and routine regression protection.

### Full
Broad product-quality suite. All benchmark cases. Use for milestone checks, nightly runs, and release candidate validation.

### Stress
Retry-heavy and variance-prone cases. ~5–15 cases. Known difficult prompts, fallback-heavy routing, planner-retry-heavy families. **Judged on final correctness only — turbulence is expected and not a hard verdict gate.**

---

## 2. Case classification

Every benchmark case must be labeled as exactly one of:

**Feasible** (`shouldPass: true`): system is expected to generate a valid recipe.

**Reject** (`shouldPass: false`): system is expected to reject or fail generation safely.

Reject cases are **not failures** when they end in `regenerate_from_ingredients`, `failed`, or any other explicit safe-reject path. They are failures only if incorrectly accepted.

---

## 3. Status interpretation

| Status | Feasible case | Reject case |
|--------|--------------|-------------|
| `accepted` | ✓ success | ✗ false accept — FAILURE |
| `regenerate_from_ingredients` | ✗ failure | ✓ correct reject |
| `failed` | ✗ failure | ✓ correct reject |
| `timeout_failure` | ✗ failure | failure (harness) |
| `budget_failure` | ✗ failure | failure (harness) |
| `exception` | ✗ failure | failure (harness) |

---

## 4. Core metrics

All metrics must be reported separately for feasible and reject cases.

### Feasible-case metrics (`shouldPass: true`)
- **feasible pass rate** — fraction ending in `accepted`
- **feasible regenerate rate** — fraction ending in `regenerate_from_ingredients` ← this is a true failure metric
- **feasible timeout rate**
- **feasible budget failure rate**
- **family match rate**
- **first-pass success rate**

### Reject-case metrics (`shouldPass: false`)
- **reject accuracy** — fraction correctly not accepted
- **false accept rate** — fraction incorrectly accepted ← BLOCKER if > 0

### Global metrics (all cases)
- dietary violations in accepted recipes
- final class-group violations in accepted recipes
- exception count
- family resolution rate
- average/p50/p90/max duration
- top issue codes
- status distribution

---

## 5. Hard blocker rules

A run is automatically **RED** if any of these fail — these are integrity failures, not tuning issues:

- false accept rate > 0
- dietary violations > 0
- final class-group violations > 0
- exception failures > 0
- reject accuracy < 100%
- timeout failures > 0 (smoke/core/full; stress: informational)

---

## 6. Core and full suite verdict rules

### GREEN (ship-ready)
All blockers pass and:
- feasible expectation match ≥ 85%
- feasible regenerate rate ≤ 15%
- baseline pass rate ≥ 90%
- dietary pass rate ≥ 90%
- family match ≥ 90%
- `STEPGEN_NO_STEPS` ≤ 2

### GREEN + STRONG
GREEN passes and:
- feasible expectation match ≥ 90%
- family match clearly above release threshold
- first-pass success ≥ 75%
- feasible regenerate rate ≤ 10%
- intermediate planner misses ≤ `ceil(total / 5)`

---

## 7. Stress suite verdict rules

Stress suites intentionally contain retry-heavy, variance-prone, and fallback-heavy cases. Intermediate turbulence is expected.

### GREEN
- final failures = 0 (or within explicitly accepted flaky tolerance)
- false accept rate = 0
- dietary violations = 0
- final class-group violations = 0
- timeout failures = 0
- budget failures = 0
- exception failures = 0

### GREEN + STRONG
All GREEN conditions pass, plus:
- no repeated structural failures across the suite
- no unresolved routing failures
- no unresolved harness failures

### Intermediate planner misses in stress suites
**Not a hard verdict gate.** Reported and trended, but only escalated to a verdict problem if they correlate with final failures, timeouts, budget failures, or rising run-to-run instability.

---

## 8. Intermediate planner misses policy

`PLANNER_MISSING_REQUIRED_CLASS_GROUP` events during intermediate attempts (not final output).

**Core/full suites:** Hard STRONG threshold — `ceil(total / 5)`. Signals planner instability if exceeded.

**Stress suites:** Trend-only. Not a blocking threshold unless linked to final failures.

**Rule:** Intermediate planner misses must never be conflated with final class-group violations or final accepted recipe integrity.

---

## 9. Regenerate-rate policy

`regenerate_from_ingredients` must be split by case class.

**Feasible regenerate rate** = only `shouldPass: true` cases ending in `regenerate_from_ingredients`. This is a real failure metric with a threshold.

**Never count reject-case regenerates toward the feasible regenerate rate.** Those are often correct outcomes.

---

## 10. Flaky-case classification

A case is classified only after repeated isolated runs (minimum 5):

| Classification | Pass rate |
|----------------|-----------|
| `stable_pass` | ≥ 4/5 |
| `flaky` | 2–3/5 |
| `broken` | ≤ 1/5 |
| `harness_problem` | repeated timeout/budget/exception pattern |

**Single-run variance must not trigger broad product changes** unless the failure repeats across multiple runs or affects core integrity metrics.

---

## 11. Harness health requirements

A benchmark run is not trustworthy unless:
- timeout and budget failures are within suite thresholds
- exception failures = 0
- per-case results persisted immediately after completion
- resume capability working (completed case IDs skipped)
- budget breach maps to `budget_failure`, not generic `exception`

---

## 12. Reporting requirements

Every benchmark report must include:

- **Feasible vs reject split** — shown separately, never blended
- **Category breakdown** — baseline / dietary / macro / reject / messy
- **Status distribution** — all statuses counted
- **Planner quality** — final violations, intermediate misses, first-pass rate shown separately
- **Top issue codes** — minimum top 10
- **Slowest cases** — for harness tuning

---

## 13. Release decision matrix

| Verdict | Meaning |
|---------|---------|
| **RED** | Any blocker fails |
| **YELLOW** | Blockers pass; GREEN thresholds missed or unresolved structural instability |
| **GREEN** | Blockers pass and GREEN thresholds pass |
| **GREEN + STRONG** | Blockers, GREEN, and STRONG thresholds all pass |

---

## 14. Common mistakes this policy prevents

| Mistake | Correct behavior |
|---------|-----------------|
| Counting intentional rejects in `regenerate_from_ingredients` rate | Split by `shouldPass` |
| Downgrading stress suite for planner retries that recover cleanly | Stress suite: intermediate misses are trend-only |
| Treating single-run variance as a structural bug | Require ≥5 isolated runs before classifying as flaky/broken |
| Budget breach appearing as generic exception | `MODEL_CALL_BUDGET_EXCEEDED` must map to `budget_failure` status |
| Blending feasible and reject metrics in any threshold check | All thresholds must specify which case class they apply to |

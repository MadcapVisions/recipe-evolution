/**
 * Registry of known flaky benchmark cases.
 *
 * Flaky cases are not bugs — they are variance-sensitive cases that pass in
 * isolation but show occasional failures under concurrent load. They are:
 *   - excluded from release blocking
 *   - tracked over time
 *   - only acted on if failure rate worsens, they fail in isolation,
 *     or they represent real user-facing prompt patterns
 *
 * Classification thresholds (5-run isolated baseline):
 *   stable_pass    ≥ 4/5 passes
 *   flaky          2–3/5 passes
 *   broken         ≤ 1/5 passes
 *   harness_problem  repeated timeout/budget/exception pattern
 */

export type FlakyCase = {
  caseId: string;
  category: string;
  classification: "stable_pass" | "flaky" | "broken" | "harness_problem";
  /** Observed pass rate in 5-run isolated baseline (e.g. 5/5, 4/5) */
  isolatedPassRate: string;
  /** Date of last isolated multi-run observation */
  lastObservedAt: string;
  notes: string;
};

export const FLAKY_CASES: FlakyCase[] = [
  {
    caseId: "flan_classic_01",
    category: "baseline",
    classification: "stable_pass",
    isolatedPassRate: "5/5",
    lastObservedAt: "2026-03-25",
    notes:
      "Passes reliably in isolation (5/5). Occasional regenerate_from_ingredients under " +
      "concurrent load. Same family, different prompt variant (flan_coffee_02) passes cleanly. " +
      "Root cause: load-induced model variance, not a planner or feasibility gate bug. " +
      "Do not address unless failure rate worsens or case fails in isolation.",
  },
  {
    caseId: "flan_coffee_02",
    category: "baseline",
    classification: "stable_pass",
    isolatedPassRate: "not yet measured",
    lastObservedAt: "2026-03-25",
    notes:
      "Single regenerate_from_ingredients observed in full suite run under concurrent load. " +
      "Same custard_flan family as flan_classic_01. Likely same load-variance mechanism. " +
      "Run 5× in isolation before treating as flaky.",
  },
  {
    caseId: "pizza_01",
    category: "baseline",
    classification: "stable_pass",
    isolatedPassRate: "not yet measured",
    lastObservedAt: "2026-03-25",
    notes:
      "Single regenerate_from_ingredients observed in full suite run under concurrent load. " +
      "Passes in smoke/core/stress runs. High call count (4–5 calls) suggests step-gen retry " +
      "sensitivity. Run 5× in isolation before treating as flaky.",
  },
];

/** Returns true if a case ID is in the known-flaky registry. */
export function isKnownFlaky(caseId: string): boolean {
  return FLAKY_CASES.some((f) => f.caseId === caseId);
}

/** Returns the flaky record for a case ID, or undefined if not registered. */
export function getFlakyRecord(caseId: string): FlakyCase | undefined {
  return FLAKY_CASES.find((f) => f.caseId === caseId);
}

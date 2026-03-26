/**
 * Benchmark mode configuration.
 *
 * Controls per-case timeouts, model-call budgets, stage timeouts, and retry
 * caps when running the recipe generation pipeline under test conditions.
 *
 * The three levels trade off coverage vs. speed:
 *   fast     — minimal retries, shorter timeouts, best for quick smoke runs
 *   standard — balanced defaults for normal regression benchmarks
 *   deep     — full retries, longer timeouts, for debugging instability
 */

export type BenchmarkModeLevel = "fast" | "standard" | "deep";

export type BenchmarkModeConfig = {
  level: BenchmarkModeLevel;

  // ── Per-case wall-clock limits ────────────────────────────────────────────
  /** Log a soft warning if a case takes longer than this. */
  softTimeoutMs: number;
  /** Abort the case and mark timeout_failure if exceeded. */
  hardTimeoutMs: number;

  // ── Model-call budget ─────────────────────────────────────────────────────
  /**
   * Max total model calls per case (planner + step + repair).
   * Prevents pathological retry loops from dominating run time.
   */
  modelCallBudget: number;

  // ── Retry caps (override orchestrator defaults in benchmark context) ───────
  plannerRepairRetries: number;
  stepRepairRetries: number;
  fullRecipeRepairRetries: number;
  /** Max number of fallback dish families to try before giving up. */
  fallbackFamiliesMax: number;

  // ── Per-stage model-call timeouts ─────────────────────────────────────────
  stageLimits: {
    /** Hard limit per individual planner model call. */
    ingredientPlanningMs: number;
    /** Hard limit per individual step model call. */
    stepGenerationMs: number;
    /** Hard limit per individual repair model call. */
    recipeRepairMs: number;
  };
};

export const BENCHMARK_MODE_CONFIGS: Record<BenchmarkModeLevel, BenchmarkModeConfig> = {
  fast: {
    level: "fast",
    softTimeoutMs: 30_000,
    hardTimeoutMs: 60_000,
    modelCallBudget: 6,
    plannerRepairRetries: 0,
    stepRepairRetries: 0,
    fullRecipeRepairRetries: 0,
    fallbackFamiliesMax: 2,
    stageLimits: {
      ingredientPlanningMs: 15_000,
      stepGenerationMs: 15_000,
      recipeRepairMs: 25_000,
    },
  },
  standard: {
    level: "standard",
    softTimeoutMs: 45_000,
    hardTimeoutMs: 90_000,
    modelCallBudget: 8,
    plannerRepairRetries: 1,
    stepRepairRetries: 1,
    fullRecipeRepairRetries: 1,
    fallbackFamiliesMax: 3,
    stageLimits: {
      ingredientPlanningMs: 20_000,
      stepGenerationMs: 20_000,
      recipeRepairMs: 45_000,
    },
  },
  deep: {
    level: "deep",
    softTimeoutMs: 60_000,
    hardTimeoutMs: 150_000,
    modelCallBudget: 12,
    plannerRepairRetries: 2,
    stepRepairRetries: 2,
    fullRecipeRepairRetries: 2,
    fallbackFamiliesMax: 4,
    stageLimits: {
      ingredientPlanningMs: 30_000,
      stepGenerationMs: 30_000,
      recipeRepairMs: 60_000,
    },
  },
};

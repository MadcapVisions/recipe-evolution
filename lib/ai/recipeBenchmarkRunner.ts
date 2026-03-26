/**
 * Benchmark runner for the recipe generation orchestrator.
 *
 * Single-pass:
 *   const run = await runRecipeBenchmarks({ deps });
 *   console.log(formatRecipeBenchmarkSummary(run));
 *
 * Multi-pass consistency:
 *   const report = await runRecipeBenchmarksMultiPass({ deps, runs: 3 });
 *   console.log(formatMultiPassReport(report));
 */

import {
  orchestrateRecipeGeneration,
  type RecipeGenerationDependencies,
  type RecipeGenerationResult,
} from "./recipeGenerationOrchestrator";
import {
  RECIPE_BENCHMARK_CASES,
  type RecipeBenchmarkCase,
  type BenchmarkCategory,
  type BenchmarkSuiteName,
} from "./recipeBenchmarkCases";
import type { RecipeTelemetrySummary } from "./recipeTelemetry";
import type { BenchmarkModeConfig } from "./benchmarkMode";

// ── Result types ──────────────────────────────────────────────────────────────

export type RecipeBenchmarkCaseResult = {
  caseId: string;
  prompt: string;
  category: BenchmarkCategory | undefined;
  /** Whether the case is expected to produce a valid recipe (shouldPass=true) or be rejected. */
  shouldPass: boolean;
  expectedDishFamily: string;
  actualDishFamily: string | null;
  status: RecipeGenerationResult["status"] | "exception" | "timeout_failure" | "budget_failure";
  success: boolean;
  /** true if actualDishFamily === expectedDishFamily, or expectedDishFamily is "" */
  familyMatched: boolean;
  passExpectationMet: boolean;
  mustHaveViolations: string[];
  mustNotHaveViolations: string[];
  finalClassGroupViolations: string[][];
  intermediatePlannerMisses: number;
  plannerFirstPassSucceeded: boolean;
  issueCodes: string[];
  telemetrySummary: RecipeTelemetrySummary | null;
  durationMs: number;
  // Harness signals
  softTimeoutExceeded: boolean;
  hardTimeoutExceeded: boolean;
  budgetExceeded: boolean;
  modelCallsUsed: number;
  error?: string;
};

export type RecipeBenchmarkRun = {
  startedAt: string;
  finishedAt: string;
  totalCases: number;
  results: RecipeBenchmarkCaseResult[];
  summary: RecipeBenchmarkSummary;
};

export type CategoryStats = {
  total: number;
  passed: number;
  expectationMatched: number;
  familyMatched: number;
};

export type SlowCaseEntry = {
  caseId: string;
  durationMs: number;
  status: string;
  modelCallsUsed: number;
  intermediatePlannerMisses: number;
};

export type AcceptanceCriteriaCheck = {
  label: string;
  tier: "blocker" | "ship" | "strong";
  passed: boolean;
  actual: string;
  threshold: string;
};

export type AcceptanceCriteriaResult = {
  verdict: "green" | "yellow" | "red";
  strong: boolean;
  checks: AcceptanceCriteriaCheck[];
};

export type RecipeBenchmarkSummary = {
  totalCases: number;
  passed: number;
  failed: number;
  exceptions: number;
  timeoutFailures: number;
  budgetFailures: number;
  familyMatchRate: number;
  successRate: number;
  expectationMatchRate: number;
  averageDurationMs: number;
  p50DurationMs: number;
  p90DurationMs: number;
  maxDurationMs: number;
  averageStageCount: number;
  issueCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  byCategory: Partial<Record<BenchmarkCategory, CategoryStats>>;
  worstDishFamilies: string[];
  finalClassGroupFailureCount: number;
  intermediateClassGroupMissCount: number;
  firstPassSuccessRate: number;
  slowestCases: SlowCaseEntry[];
  acceptance: AcceptanceCriteriaResult;
};

// ── Multi-pass types ──────────────────────────────────────────────────────────

export type MultiPassRunRecord = {
  run: number;
  passed: boolean;
  status: string;
  durationMs: number;
};

export type CaseStabilityClass =
  | "stable_pass"    // passes >= 80%
  | "stable_reject"  // expected reject, correct >= 80%
  | "flaky"          // passes 40–79%
  | "broken"         // passes < 40%
  | "harness_problem"; // timeouts/budgets in >= 40% of runs

export type MultiPassCaseResult = {
  caseId: string;
  category: BenchmarkCategory | undefined;
  runs: MultiPassRunRecord[];
  passedAllRuns: boolean;
  failedAllRuns: boolean;
  isUnstable: boolean;
  stability: CaseStabilityClass;
  lastResult: RecipeBenchmarkCaseResult;
};

export type MultiPassBenchmarkReport = {
  runCount: number;
  startedAt: string;
  finishedAt: string;
  caseResults: MultiPassCaseResult[];
  perRunSummaries: RecipeBenchmarkSummary[];
  consistencyRate: number;
  unstableCaseIds: string[];
  finalRun: RecipeBenchmarkRun;
};

// ── Runner params ─────────────────────────────────────────────────────────────

export type RecipeBenchmarkRunParams = {
  deps: RecipeGenerationDependencies;
  /** Subset of case IDs to run. Runs all cases if omitted. */
  caseIds?: string[];
  /** Case IDs to skip (already completed — used for resume). */
  skipCaseIds?: Set<string>;
  /** Max cases to run in parallel. Default: 2. */
  concurrency?: number;
  /** Benchmark mode config for timeouts, budgets, and retry caps. */
  benchmarkMode?: BenchmarkModeConfig;
  /**
   * Suite name — affects verdict logic.
   * Stress suites skip the intermediate-planner-misses STRONG gate;
   * turbulence is expected and reported as trend-only.
   */
  suiteName?: BenchmarkSuiteName;
  /** Called after each case completes. */
  onCaseComplete?: (result: RecipeBenchmarkCaseResult) => void;
  /** Called when a case exceeds the soft timeout threshold. */
  onSoftTimeout?: (caseId: string, elapsedMs: number) => void;
};

// ── Timeout utilities ─────────────────────────────────────────────────────────

async function withStageTimeout<T>(
  promise: Promise<T>,
  ms: number,
  code: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const race = Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(Object.assign(new Error(`Stage timeout: ${code}`), { code })),
        ms
      );
    }),
  ]);
  try {
    return await race;
  } finally {
    clearTimeout(timer!);
  }
}

// ── Benchmark deps wrapper ────────────────────────────────────────────────────

function wrapDepsForBenchmark(
  baseDeps: RecipeGenerationDependencies,
  config: BenchmarkModeConfig,
  budget: { used: number }
): RecipeGenerationDependencies {
  type ModelFn<TArgs extends unknown[], TRet> = (...args: TArgs) => Promise<TRet>;

  function wrap<TArgs extends unknown[], TRet>(
    fn: ModelFn<TArgs, TRet>,
    timeoutMs: number,
    timeoutCode: string
  ): ModelFn<TArgs, TRet> {
    return async (...args: TArgs): Promise<TRet> => {
      budget.used++;
      if (budget.used > config.modelCallBudget) {
        throw Object.assign(
          new Error(`Model call budget exceeded (limit: ${config.modelCallBudget})`),
          { code: "MODEL_CALL_BUDGET_EXCEEDED" }
        );
      }
      return withStageTimeout(fn(...args), timeoutMs, timeoutCode);
    };
  }

  return {
    ...baseDeps,
    callPlannerModel: wrap(
      baseDeps.callPlannerModel,
      config.stageLimits.ingredientPlanningMs,
      "PLANNER_STAGE_TIMEOUT"
    ),
    callStepModel: wrap(
      baseDeps.callStepModel,
      config.stageLimits.stepGenerationMs,
      "STEP_STAGE_TIMEOUT"
    ),
    callRepairModel: wrap(
      baseDeps.callRepairModel,
      config.stageLimits.recipeRepairMs,
      "REPAIR_STAGE_TIMEOUT"
    ),
  };
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runRecipeBenchmarks(
  params: RecipeBenchmarkRunParams
): Promise<RecipeBenchmarkRun> {
  const {
    deps,
    caseIds,
    skipCaseIds,
    concurrency = 2,
    benchmarkMode,
    suiteName,
    onCaseComplete,
    onSoftTimeout,
  } = params;

  const startedAt = new Date().toISOString();

  let cases = caseIds
    ? RECIPE_BENCHMARK_CASES.filter((c) => caseIds.includes(c.id))
    : RECIPE_BENCHMARK_CASES;

  if (skipCaseIds?.size) {
    cases = cases.filter((c) => !skipCaseIds.has(c.id));
  }

  const results: RecipeBenchmarkCaseResult[] = [];

  for (let i = 0; i < cases.length; i += concurrency) {
    const batch = cases.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((c) => runSingleCaseWithGuards(c, deps, benchmarkMode, onSoftTimeout))
    );
    for (const r of batchResults) {
      results.push(r);
      onCaseComplete?.(r);
    }
  }

  const finishedAt = new Date().toISOString();
  const summary = buildSummary(results, suiteName);

  return { startedAt, finishedAt, totalCases: cases.length, results, summary };
}

export type MultiPassRunParams = RecipeBenchmarkRunParams & {
  runs: number;
  onRunComplete?: (runIndex: number, run: RecipeBenchmarkRun) => void;
};

export async function runRecipeBenchmarksMultiPass(
  params: MultiPassRunParams
): Promise<MultiPassBenchmarkReport> {
  const { runs, onRunComplete, ...singlePassParams } = params;
  const startedAt = new Date().toISOString();

  const allRuns: RecipeBenchmarkRun[] = [];
  for (let i = 0; i < runs; i++) {
    const run = await runRecipeBenchmarks(singlePassParams);
    allRuns.push(run);
    onRunComplete?.(i, run);
  }

  const finalRun = allRuns[allRuns.length - 1]!;
  const allCaseIds = finalRun.results.map((r) => r.caseId);

  const caseResults: MultiPassCaseResult[] = allCaseIds.map((caseId) => {
    const runRecords: MultiPassRunRecord[] = allRuns.map((run, idx) => {
      const r = run.results.find((x) => x.caseId === caseId);
      return {
        run: idx + 1,
        passed: r ? isFullPass(r) : false,
        status: r?.status ?? "missing",
        durationMs: r?.durationMs ?? 0,
      };
    });

    const passCount = runRecords.filter((r) => r.passed).length;
    const timeoutOrBudget = runRecords.filter(
      (r) => r.status === "timeout_failure" || r.status === "budget_failure"
    ).length;

    const passRate = passCount / runs;
    const harnessRate = timeoutOrBudget / runs;
    const lastResult = finalRun.results.find((r) => r.caseId === caseId)!;
    const isExpectedReject = !(lastResult.telemetrySummary != null
      ? (lastResult.category === "reject")
      : false);

    let stability: CaseStabilityClass;
    if (harnessRate >= 0.4) {
      stability = "harness_problem";
    } else if (lastResult.category === "reject" && passRate >= 0.8) {
      stability = "stable_reject";
    } else if (passRate >= 0.8) {
      stability = "stable_pass";
    } else if (passRate >= 0.4) {
      stability = "flaky";
    } else {
      stability = "broken";
    }

    void isExpectedReject;

    return {
      caseId,
      category: lastResult.category,
      runs: runRecords,
      passedAllRuns: passCount === runs,
      failedAllRuns: passCount === 0,
      isUnstable: passCount > 0 && passCount < runs,
      stability,
      lastResult,
    };
  });

  const consistentCases = caseResults.filter((c) => c.passedAllRuns).length;
  const consistencyRate = allCaseIds.length > 0 ? consistentCases / allCaseIds.length : 0;
  const unstableCaseIds = caseResults.filter((c) => c.isUnstable).map((c) => c.caseId);

  const finalSummaryWithConsistency = buildSummaryWithConsistency(
    finalRun.results,
    { consistencyRate },
    singlePassParams.suiteName
  );

  const finishedAt = new Date().toISOString();

  return {
    runCount: runs,
    startedAt,
    finishedAt,
    caseResults,
    perRunSummaries: allRuns.map((r) => r.summary),
    consistencyRate,
    unstableCaseIds,
    finalRun: { ...finalRun, summary: finalSummaryWithConsistency },
  };
}

// ── Single-case runner with timeout and budget guards ─────────────────────────

async function runSingleCaseWithGuards(
  benchCase: RecipeBenchmarkCase,
  deps: RecipeGenerationDependencies,
  benchmarkMode: BenchmarkModeConfig | undefined,
  onSoftTimeout?: (caseId: string, elapsedMs: number) => void
): Promise<RecipeBenchmarkCaseResult> {
  if (!benchmarkMode) {
    return runSingleCase(benchCase, deps);
  }

  const budget = { used: 0 };
  const wrappedDeps = wrapDepsForBenchmark(deps, benchmarkMode, budget);

  const started = Date.now();
  let softTimeoutExceeded = false;
  let hardTimeoutExceeded = false;

  // Soft timeout warning
  const softTimer = setTimeout(() => {
    softTimeoutExceeded = true;
    onSoftTimeout?.(benchCase.id, Date.now() - started);
  }, benchmarkMode.softTimeoutMs);

  // Hard timeout: races against case execution
  let hardTimer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<RecipeBenchmarkCaseResult>((resolve) => {
    hardTimer = setTimeout(() => {
      hardTimeoutExceeded = true;
      resolve(makeHarnessFailure(benchCase, "timeout_failure", "BENCHMARK_CASE_TIMEOUT", Date.now() - started, budget.used, true, false));
    }, benchmarkMode.hardTimeoutMs);
  });

  const caseInput = buildBenchmarkCaseInput(benchCase, benchmarkMode);

  try {
    const result = await Promise.race([
      runSingleCase(benchCase, wrappedDeps, caseInput).then((r) => {
        // Annotate with harness signals
        r.softTimeoutExceeded = softTimeoutExceeded;
        r.hardTimeoutExceeded = hardTimeoutExceeded;
        r.modelCallsUsed = budget.used;
        // Budget exceeded error surfaces as an exception — remap to budget_failure
        if (r.status === "exception" && r.issueCodes.includes("MODEL_CALL_BUDGET_EXCEEDED")) {
          r.status = "budget_failure";
          r.budgetExceeded = true;
        }
        return r;
      }),
      timeoutPromise,
    ]);
    return result;
  } finally {
    clearTimeout(softTimer);
    clearTimeout(hardTimer!);
  }
}

function buildBenchmarkCaseInput(
  benchCase: RecipeBenchmarkCase,
  config: BenchmarkModeConfig
): Partial<Parameters<typeof orchestrateRecipeGeneration>[0]> {
  return {
    maxIngredientRepairRetries: config.plannerRepairRetries,
    maxStepRepairRetries: config.stepRepairRetries,
    maxRecipeRepairRetries: config.fullRecipeRepairRetries,
    maxFallbackFamilies: config.fallbackFamiliesMax,
    creativityMode: "safe",
  };
}

function makeHarnessFailure(
  benchCase: RecipeBenchmarkCase,
  status: "timeout_failure" | "budget_failure",
  code: string,
  durationMs: number,
  modelCallsUsed: number,
  hardTimeoutExceeded: boolean,
  budgetExceeded: boolean
): RecipeBenchmarkCaseResult {
  return {
    caseId: benchCase.id,
    prompt: benchCase.prompt,
    category: benchCase.category,
    shouldPass: benchCase.shouldPass ?? true,
    expectedDishFamily: benchCase.expectedDishFamily,
    actualDishFamily: null,
    status,
    success: false,
    familyMatched: false,
    passExpectationMet: !(benchCase.shouldPass ?? true),
    mustHaveViolations: benchCase.mustHaveClasses ?? [],
    mustNotHaveViolations: [],
    finalClassGroupViolations: [],
    intermediatePlannerMisses: 0,
    plannerFirstPassSucceeded: false,
    issueCodes: [code],
    telemetrySummary: null,
    durationMs,
    softTimeoutExceeded: false,
    hardTimeoutExceeded,
    budgetExceeded,
    modelCallsUsed,
    error: code,
  };
}

async function runSingleCase(
  benchCase: RecipeBenchmarkCase,
  deps: RecipeGenerationDependencies,
  inputOverrides?: Partial<Parameters<typeof orchestrateRecipeGeneration>[0]>
): Promise<RecipeBenchmarkCaseResult> {
  const started = Date.now();

  try {
    const result = await orchestrateRecipeGeneration(
      {
        userIntent: benchCase.prompt,
        titleHint: benchCase.titleHint ?? null,
        dishHint: benchCase.dishHint ?? null,
        dietaryConstraints: benchCase.dietaryConstraints ?? [],
        macroTargets: benchCase.macroTargets ?? null,
        servings: benchCase.servings ?? null,
        availableIngredients: benchCase.availableIngredients ?? [],
        preferredIngredients: benchCase.preferredIngredients ?? [],
        forbiddenIngredients: benchCase.forbiddenIngredients ?? [],
        creativityMode: "safe",
        requestId: `bench_${benchCase.id}_${Date.now()}`,
        ...inputOverrides,
      },
      deps
    );

    const durationMs = Date.now() - started;
    const actualDishFamily = result.dishFamily?.key ?? null;
    const familyMatched =
      benchCase.expectedDishFamily === "" ||
      actualDishFamily === benchCase.expectedDishFamily;
    const passExpectationMet = (benchCase.shouldPass ?? true) === result.success;

    const ingredientClasses = result.recipe
      ? collectIngredientClasses(result)
      : new Set<string>();
    const mustHaveViolations = result.recipe
      ? (benchCase.mustHaveClasses ?? []).filter((cls) => !ingredientClasses.has(cls))
      : [];
    const mustNotHaveViolations = (benchCase.mustNotHaveClasses ?? []).filter(
      (cls) => ingredientClasses.has(cls)
    );

    const issueCodes = collectIssueCodes(result);
    const finalClassGroupViolations = collectFinalClassGroupViolations(result);
    const intermediatePlannerMisses = countIntermediatePlannerMisses(result);

    return {
      caseId: benchCase.id,
      prompt: benchCase.prompt,
      category: benchCase.category,
      shouldPass: benchCase.shouldPass ?? true,
      expectedDishFamily: benchCase.expectedDishFamily,
      actualDishFamily,
      status: result.status,
      success: result.success,
      familyMatched,
      passExpectationMet,
      mustHaveViolations,
      mustNotHaveViolations,
      finalClassGroupViolations,
      intermediatePlannerMisses,
      plannerFirstPassSucceeded: intermediatePlannerMisses === 0,
      issueCodes,
      telemetrySummary: result.telemetry.summary,
      durationMs,
      softTimeoutExceeded: false,
      hardTimeoutExceeded: false,
      budgetExceeded: false,
      modelCallsUsed: 0, // overwritten by guard wrapper when benchmarkMode is active
    };
  } catch (err) {
    // Capture structured error code if present (e.g. MODEL_CALL_BUDGET_EXCEEDED from budget guard)
    const errCode: string =
      err != null && typeof (err as Record<string, unknown>).code === "string"
        ? ((err as Record<string, unknown>).code as string)
        : "BENCHMARK_EXCEPTION";
    return {
      caseId: benchCase.id,
      prompt: benchCase.prompt,
      category: benchCase.category,
      shouldPass: benchCase.shouldPass ?? true,
      expectedDishFamily: benchCase.expectedDishFamily,
      actualDishFamily: null,
      status: "exception",
      success: false,
      familyMatched: false,
      passExpectationMet: !(benchCase.shouldPass ?? true),
      mustHaveViolations: benchCase.mustHaveClasses ?? [],
      mustNotHaveViolations: [],
      finalClassGroupViolations: [],
      intermediatePlannerMisses: 0,
      plannerFirstPassSucceeded: false,
      issueCodes: [errCode],
      telemetrySummary: null,
      durationMs: Date.now() - started,
      softTimeoutExceeded: false,
      hardTimeoutExceeded: false,
      budgetExceeded: false,
      modelCallsUsed: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectFinalClassGroupViolations(result: RecipeGenerationResult): string[][] {
  if (!result.recipe || !result.dishFamily) return [];
  const ingredientClasses = collectIngredientClasses(result);
  return (result.dishFamily.requiredClassGroups ?? []).filter(
    (group) => !group.some((cls) => ingredientClasses.has(cls))
  );
}

function countIntermediatePlannerMisses(result: RecipeGenerationResult): number {
  const INTERMEDIATE_STAGES = new Set(["ingredient_planning", "ingredient_plan_repair"]);
  let count = 0;
  for (const event of result.telemetry.session.events) {
    if (!INTERMEDIATE_STAGES.has(event.stage)) continue;
    for (const issue of event.issues ?? []) {
      if (issue.code === "PLANNER_MISSING_REQUIRED_CLASS_GROUP") count += 1;
    }
  }
  return count;
}

function collectIngredientClasses(result: RecipeGenerationResult): Set<string> {
  const classes = new Set<string>();
  for (const ing of result.recipe?.ingredients ?? []) {
    for (const cls of ing.classes ?? []) classes.add(cls);
  }
  return classes;
}

function collectIssueCodes(result: RecipeGenerationResult): string[] {
  const codes: string[] = [];
  for (const event of result.telemetry.session.events) {
    for (const issue of event.issues ?? []) codes.push(issue.code);
  }
  return Array.from(new Set(codes));
}

export function isFullPass(r: RecipeBenchmarkCaseResult): boolean {
  return (
    r.passExpectationMet &&
    r.familyMatched &&
    r.mustHaveViolations.length === 0 &&
    r.mustNotHaveViolations.length === 0 &&
    r.status !== "timeout_failure" &&
    r.status !== "budget_failure"
  );
}

function buildCategoryStats(
  results: RecipeBenchmarkCaseResult[],
  category: BenchmarkCategory
): CategoryStats {
  const group = results.filter((r) => r.category === category);
  return {
    total: group.length,
    passed: group.filter(isFullPass).length,
    expectationMatched: group.filter((r) => r.passExpectationMet).length,
    familyMatched: group.filter((r) => r.familyMatched).length,
  };
}

function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const idx = Math.min(
    sortedMs.length - 1,
    Math.floor((p / 100) * sortedMs.length)
  );
  return sortedMs[idx]!;
}

function buildAcceptanceCriteria(
  results: RecipeBenchmarkCaseResult[],
  issueCounts: Record<string, number>,
  statusCounts: Record<string, number>,
  multiPassData?: { consistencyRate: number },
  suiteName?: BenchmarkSuiteName
): AcceptanceCriteriaResult {
  // Stress suites are judged primarily on final correctness.
  // Intermediate planner turbulence is expected; it is reported but not a hard STRONG gate.
  const isStressSuite = suiteName === "stress";
  const total = results.length;
  const expectationMatched = results.filter((r) => r.passExpectationMet).length;
  const expectationRate = total > 0 ? expectationMatched / total : 0;
  const familyMatchCount = results.filter((r) => r.familyMatched).length;

  const dietaryViolations = results.filter(
    (r) => r.category === "dietary" && r.mustNotHaveViolations.length > 0
  ).length;

  // Feasible vs reject split — use shouldPass, not category, for unambiguous classification
  const rejectCases = results.filter((r) => !r.shouldPass);
  const feasibleCases = results.filter((r) => r.shouldPass);
  const rejectCorrect = rejectCases.filter((r) => !r.success).length;
  const falseAccepts = rejectCases.filter((r) => r.success).length;
  const rejectAccuracy = rejectCases.length > 0 ? rejectCorrect / rejectCases.length : 1;

  const stepgenNoSteps = issueCounts["STEPGEN_NO_STEPS"] ?? 0;
  // Feasible regenerate rate: only shouldPass=true cases (intentional rejects excluded)
  const feasibleRegenerateCount = feasibleCases.filter(
    (r) => r.status === "regenerate_from_ingredients"
  ).length;
  const feasibleRegenerateRate =
    feasibleCases.length > 0 ? feasibleRegenerateCount / feasibleCases.length : 0;
  const timeoutCount = results.filter((r) => r.status === "timeout_failure").length;
  const budgetCount = results.filter((r) => r.status === "budget_failure").length;

  const finalClassGroupFailures = results.filter(
    (r) => r.success && r.finalClassGroupViolations.length > 0
  ).length;

  const intermediateClassGroupMisses = results.reduce(
    (sum, r) => sum + r.intermediatePlannerMisses,
    0
  );

  const baselineStats = buildCategoryStats(results, "baseline");
  const dietaryStats = buildCategoryStats(results, "dietary");
  const baselinePassRate =
    baselineStats.total > 0 ? baselineStats.passed / baselineStats.total : 1;
  const dietaryPassRate =
    dietaryStats.total > 0 ? dietaryStats.passed / dietaryStats.total : 1;

  const firstPassSucceeded = results.filter((r) => r.plannerFirstPassSucceeded).length;
  const firstPassRate = total > 0 ? firstPassSucceeded / total : 1;
  const intermediateMissThreshold = Math.max(5, Math.ceil(total / 5));

  const checks: AcceptanceCriteriaCheck[] = [
    // ── BLOCKER ────────────────────────────────────────────────────────────
    {
      label: "expectation-match ≥80%",
      tier: "blocker",
      passed: expectationRate >= 0.80,
      actual: `${expectationMatched}/${total} (${Math.round(expectationRate * 100)}%)`,
      threshold: "80%",
    },
    {
      label: "dietary violations = 0",
      tier: "blocker",
      passed: dietaryViolations === 0,
      actual: String(dietaryViolations),
      threshold: "0",
    },
    {
      label: "reject accuracy = 100%",
      tier: "blocker",
      passed: rejectAccuracy === 1,
      actual: `${rejectCorrect}/${rejectCases.length} (${Math.round(rejectAccuracy * 100)}%)`,
      threshold: "100%",
    },
    {
      label: "false accept rate = 0",
      tier: "blocker",
      passed: falseAccepts === 0,
      actual: String(falseAccepts),
      threshold: "0",
    },
    {
      label: "timeout failures = 0",
      tier: "blocker",
      passed: timeoutCount === 0,
      actual: String(timeoutCount),
      threshold: "0",
    },
    // ── SHIP (GREEN) ──────────────────────────────────────────────────────
    {
      label: "overall expectation-match ≥85%",
      tier: "ship",
      passed: expectationRate >= 0.85,
      actual: `${expectationMatched}/${total} (${Math.round(expectationRate * 100)}%)`,
      threshold: "85%",
    },
    {
      // Stress suites have tiny category slices — category pass rate is not a meaningful ship gate there.
      label: "baseline pass rate ≥90%",
      tier: "ship",
      passed: isStressSuite ? true : baselinePassRate >= 0.90,
      actual: `${baselineStats.passed}/${baselineStats.total} (${Math.round(baselinePassRate * 100)}%)`,
      threshold: isStressSuite ? "n/a (stress)" : "90%",
    },
    {
      label: "dietary pass rate ≥90%",
      tier: "ship",
      passed: isStressSuite ? true : dietaryPassRate >= 0.90,
      actual: `${dietaryStats.passed}/${dietaryStats.total} (${Math.round(dietaryPassRate * 100)}%)`,
      threshold: isStressSuite ? "n/a (stress)" : "90%",
    },
    {
      label: "final class-group violations = 0",
      tier: "ship",
      passed: finalClassGroupFailures === 0,
      actual: String(finalClassGroupFailures),
      threshold: "0",
    },
    {
      label: "STEPGEN_NO_STEPS ≤2",
      tier: "ship",
      passed: stepgenNoSteps <= 2,
      actual: String(stepgenNoSteps),
      threshold: "≤2",
    },
    {
      label: "feasible regenerate rate ≤15%",
      tier: "ship",
      passed: feasibleRegenerateRate <= 0.15,
      actual: `${feasibleRegenerateCount}/${feasibleCases.length} (${Math.round(feasibleRegenerateRate * 100)}%)`,
      threshold: "≤15%",
    },
    {
      label: "budget failures = 0",
      tier: "ship",
      passed: budgetCount === 0,
      actual: String(budgetCount),
      threshold: "0",
    },
    // ── STRONG ────────────────────────────────────────────────────────────
    {
      label: "overall expectation-match ≥90%",
      tier: "strong",
      passed: expectationRate >= 0.90,
      actual: `${expectationMatched}/${total} (${Math.round(expectationRate * 100)}%)`,
      threshold: "90%",
    },
    {
      label: `family match ≥${Math.round(total * 0.85)}/${total}`,
      tier: "strong",
      passed: familyMatchCount >= Math.round(total * 0.85),
      actual: `${familyMatchCount}/${total}`,
      threshold: `${Math.round(total * 0.85)}/${total}`,
    },
    {
      label: "feasible regenerate rate ≤10%",
      tier: "strong",
      passed: feasibleRegenerateRate <= 0.10,
      actual: `${feasibleRegenerateCount}/${feasibleCases.length} (${Math.round(feasibleRegenerateRate * 100)}%)`,
      threshold: "≤10%",
    },
    {
      label: "first-pass planner success ≥75%",
      tier: "strong",
      passed: firstPassRate >= 0.75,
      actual: `${firstPassSucceeded}/${total} (${Math.round(firstPassRate * 100)}%)`,
      threshold: "75%",
    },
    {
      // Stress suites: turbulence expected — report as trend-only, not a hard gate.
      // Core/full suites: hard STRONG threshold.
      label: isStressSuite
        ? `intermediate planner misses (trend, stress)`
        : `intermediate planner misses ≤${intermediateMissThreshold} (stability)`,
      tier: "strong",
      passed: isStressSuite ? true : intermediateClassGroupMisses <= intermediateMissThreshold,
      actual: String(intermediateClassGroupMisses),
      threshold: isStressSuite ? "trend-only" : `≤${intermediateMissThreshold}`,
    },
    ...(multiPassData != null
      ? [
          {
            label: "consistency ≥90% (GREEN)",
            tier: "ship" as const,
            passed: multiPassData.consistencyRate >= 0.90,
            actual: `${Math.round(multiPassData.consistencyRate * 100)}%`,
            threshold: "90%",
          },
          {
            label: "consistency ≥93% (STRONG)",
            tier: "strong" as const,
            passed: multiPassData.consistencyRate >= 0.93,
            actual: `${Math.round(multiPassData.consistencyRate * 100)}%`,
            threshold: "93%",
          },
        ]
      : []),
  ];

  const blockersFail = checks.some((c) => c.tier === "blocker" && !c.passed);
  const shipFail = checks.some((c) => c.tier === "ship" && !c.passed);
  const strongPass = checks.filter((c) => c.tier === "strong").every((c) => c.passed);

  const verdict = blockersFail ? "red" : shipFail ? "yellow" : "green";
  return { verdict, strong: !blockersFail && !shipFail && strongPass, checks };
}

function buildSummary(
  results: RecipeBenchmarkCaseResult[],
  suiteName?: BenchmarkSuiteName
): RecipeBenchmarkSummary {
  return buildSummaryWithConsistency(results, undefined, suiteName);
}

function buildSummaryWithConsistency(
  results: RecipeBenchmarkCaseResult[],
  multiPassData?: { consistencyRate: number },
  suiteName?: BenchmarkSuiteName
): RecipeBenchmarkSummary {
  const total = results.length;
  if (total === 0) {
    return {
      totalCases: 0, passed: 0, failed: 0, exceptions: 0,
      timeoutFailures: 0, budgetFailures: 0,
      familyMatchRate: 0, successRate: 0, expectationMatchRate: 0,
      averageDurationMs: 0, p50DurationMs: 0, p90DurationMs: 0, maxDurationMs: 0,
      averageStageCount: 0, issueCounts: {}, statusCounts: {}, byCategory: {},
      worstDishFamilies: [], finalClassGroupFailureCount: 0,
      intermediateClassGroupMissCount: 0, firstPassSuccessRate: 0,
      slowestCases: [],
      acceptance: { verdict: "red", strong: false, checks: [] },
    };
  }

  const passed = results.filter(isFullPass).length;
  const exceptions = results.filter((r) => r.status === "exception").length;
  const timeoutFailures = results.filter((r) => r.status === "timeout_failure").length;
  const budgetFailures = results.filter((r) => r.status === "budget_failure").length;
  const failed = total - passed;

  const familyMatched = results.filter((r) => r.familyMatched).length;
  const successCount = results.filter((r) => r.success).length;
  const expectationMatched = results.filter((r) => r.passExpectationMet).length;

  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const avgDuration = durations.reduce((s, d) => s + d, 0) / total;
  const avgStages =
    results.reduce((s, r) => s + (r.telemetrySummary?.stagesSeen.length ?? 0), 0) / total;

  const issueCounts: Record<string, number> = {};
  for (const r of results) {
    for (const code of r.issueCodes) issueCounts[code] = (issueCounts[code] ?? 0) + 1;
  }

  const statusCounts: Record<string, number> = {};
  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }

  const failedFamilies = new Set<string>();
  for (const r of results) {
    if (!r.familyMatched || r.mustHaveViolations.length > 0 || r.mustNotHaveViolations.length > 0) {
      if (r.expectedDishFamily) failedFamilies.add(r.expectedDishFamily);
    }
  }

  const ALL_CATEGORIES: BenchmarkCategory[] = ["baseline", "dietary", "macro", "reject", "messy"];
  const byCategory: Partial<Record<BenchmarkCategory, CategoryStats>> = {};
  for (const cat of ALL_CATEGORIES) {
    const stats = buildCategoryStats(results, cat);
    if (stats.total > 0) byCategory[cat] = stats;
  }

  const finalClassGroupFailureCount = results.filter(
    (r) => r.success && r.finalClassGroupViolations.length > 0
  ).length;
  const intermediateClassGroupMissCount = results.reduce(
    (sum, r) => sum + r.intermediatePlannerMisses,
    0
  );
  const firstPassSucceeded = results.filter((r) => r.plannerFirstPassSucceeded).length;

  // Slowest cases
  const slowestCases: SlowCaseEntry[] = [...results]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10)
    .map((r) => ({
      caseId: r.caseId,
      durationMs: r.durationMs,
      status: r.status,
      modelCallsUsed: r.modelCallsUsed,
      intermediatePlannerMisses: r.intermediatePlannerMisses,
    }));

  const acceptance = buildAcceptanceCriteria(results, issueCounts, statusCounts, multiPassData, suiteName);

  return {
    totalCases: total,
    passed,
    failed,
    exceptions,
    timeoutFailures,
    budgetFailures,
    familyMatchRate: familyMatched / total,
    successRate: successCount / total,
    expectationMatchRate: expectationMatched / total,
    averageDurationMs: Math.round(avgDuration),
    p50DurationMs: percentile(durations, 50),
    p90DurationMs: percentile(durations, 90),
    maxDurationMs: durations[durations.length - 1] ?? 0,
    averageStageCount: Math.round(avgStages * 10) / 10,
    issueCounts,
    statusCounts,
    byCategory,
    worstDishFamilies: Array.from(failedFamilies),
    finalClassGroupFailureCount,
    intermediateClassGroupMissCount,
    firstPassSuccessRate: firstPassSucceeded / total,
    slowestCases,
    acceptance,
  };
}

// ── Formatters ─────────────────────────────────────────────────────────────────

export function formatRecipeBenchmarkSummary(run: RecipeBenchmarkRun): string {
  const s = run.summary;
  const lines: string[] = [
    `Recipe Benchmark Run — ${run.startedAt}`,
    `═════════════════════════════════════════════`,
    `Cases:        ${s.totalCases}`,
    `Passed:       ${s.passed} (${pct(s.passed, s.totalCases)})`,
    `Failed:       ${s.failed} (${pct(s.failed, s.totalCases)})`,
    `Exceptions:   ${s.exceptions}`,
    ...(s.timeoutFailures > 0 ? [`Timeouts:     ${s.timeoutFailures}  ⚠`] : []),
    ...(s.budgetFailures > 0 ? [`Budget-fail:  ${s.budgetFailures}  ⚠`] : []),
    ``,
    `Family match: ${Math.round(s.familyMatchRate * s.totalCases)}/${s.totalCases} (${Math.round(s.familyMatchRate * 100)}%)`,
    `Success rate: ${Math.round(s.successRate * 100)}%`,
    `Expectation:  ${Math.round(s.expectationMatchRate * 100)}%`,
    `First-pass:   ${Math.round(s.firstPassSuccessRate * 100)}%`,
    `Avg duration: ${s.averageDurationMs}ms  p50:${s.p50DurationMs}ms  p90:${s.p90DurationMs}ms  max:${s.maxDurationMs}ms`,
    `Avg stages:   ${s.averageStageCount}`,
  ];

  appendFeasibleRejectSplit(lines, run.results);
  appendCategoryBreakdown(lines, s);
  appendPlannerQuality(lines, s);
  appendStatusDistribution(lines, s);
  appendTopIssues(lines, s);
  appendSlowCases(lines, s);
  appendAcceptanceCriteria(lines, s);
  appendFailingFamilies(lines, s);
  appendHarnessWarnings(lines, s);
  appendPerCaseResults(lines, run.results);

  return lines.join("\n");
}

export function formatMultiPassReport(report: MultiPassBenchmarkReport): string {
  const lines: string[] = [
    `Recipe Benchmark — Multi-Pass Report (${report.runCount} runs)`,
    `═════════════════════════════════════════════`,
    `Started:      ${report.startedAt}`,
    `Finished:     ${report.finishedAt}`,
    ``,
    `Consistency:  ${Math.round(report.consistencyRate * 100)}% (${report.caseResults.filter((c) => c.passedAllRuns).length}/${report.caseResults.length} pass all runs)`,
    `Unstable:     ${report.unstableCaseIds.length} case(s)`,
  ];

  lines.push(``, `Per-run summary:`);
  lines.push(
    `  ${"RUN".padEnd(5)}  ${"PASS".padEnd(8)}  ${"EXPECT%".padEnd(10)}  ${"FAMILY%".padEnd(10)}  ${"TIMEOUT".padEnd(8)}  VERDICT`
  );
  lines.push(`  ${"─".repeat(60)}`);
  for (let i = 0; i < report.perRunSummaries.length; i++) {
    const s = report.perRunSummaries[i]!;
    const verdict =
      s.acceptance.verdict === "green"
        ? s.acceptance.strong ? "GREEN+STRONG" : "GREEN"
        : s.acceptance.verdict === "yellow" ? "YELLOW" : "RED";
    lines.push(
      `  ${String(i + 1).padEnd(5)}  ${`${s.passed}/${s.totalCases}`.padEnd(8)}  ${`${Math.round(s.expectationMatchRate * 100)}%`.padEnd(10)}  ${`${Math.round(s.familyMatchRate * 100)}%`.padEnd(10)}  ${String(s.timeoutFailures).padEnd(8)}  ${verdict}`
    );
  }

  // Stability breakdown
  const byClass: Record<CaseStabilityClass, string[]> = {
    stable_pass: [], stable_reject: [], flaky: [], broken: [], harness_problem: [],
  };
  for (const c of report.caseResults) byClass[c.stability].push(c.caseId);

  lines.push(``, `Stability classification:`);
  lines.push(`  stable_pass:     ${byClass.stable_pass.length}`);
  lines.push(`  stable_reject:   ${byClass.stable_reject.length}`);
  lines.push(`  flaky:           ${byClass.flaky.length}${byClass.flaky.length ? "  → " + byClass.flaky.join(", ") : ""}`);
  lines.push(`  broken:          ${byClass.broken.length}${byClass.broken.length ? "  → " + byClass.broken.join(", ") : ""}`);
  lines.push(`  harness_problem: ${byClass.harness_problem.length}${byClass.harness_problem.length ? "  → " + byClass.harness_problem.join(", ") : ""}`);

  if (report.unstableCaseIds.length) {
    lines.push(``, `Unstable cases (mixed pass/fail):`);
    for (const caseId of report.unstableCaseIds) {
      const c = report.caseResults.find((x) => x.caseId === caseId)!;
      const history = c.runs.map((r) => (r.passed ? "✓" : "✗")).join(" ");
      lines.push(`  UNSTABLE_CASE: ${caseId.padEnd(38)} ${history}`);
    }
  }

  lines.push(``, `Final run summary (run ${report.runCount}):`);
  lines.push(formatRecipeBenchmarkSummary(report.finalRun));

  return lines.join("\n");
}

// ── Formatter helpers ──────────────────────────────────────────────────────────

function appendFeasibleRejectSplit(lines: string[], results: RecipeBenchmarkCaseResult[]): void {
  const feasible = results.filter((r) => r.shouldPass);
  const reject = results.filter((r) => !r.shouldPass);

  const feasiblePassed = feasible.filter(isFullPass).length;
  const feasibleRegenerate = feasible.filter((r) => r.status === "regenerate_from_ingredients").length;
  const feasibleTimeout = feasible.filter((r) => r.status === "timeout_failure").length;

  const rejectCorrect = reject.filter((r) => !r.success).length;
  const falseAccepts = reject.filter((r) => r.success).length;

  lines.push(``, `Feasible cases (shouldPass=true):  ${feasible.length}`);
  lines.push(`  pass:       ${feasiblePassed}/${feasible.length} (${pct(feasiblePassed, feasible.length)})`);
  lines.push(`  regenerate: ${feasibleRegenerate}/${feasible.length} (${pct(feasibleRegenerate, feasible.length)})  ← failure`);
  if (feasibleTimeout > 0) lines.push(`  timeout:    ${feasibleTimeout}/${feasible.length}  ← failure`);

  if (reject.length > 0) {
    lines.push(`Reject cases (shouldPass=false):   ${reject.length}`);
    lines.push(`  correct reject: ${rejectCorrect}/${reject.length}`);
    if (falseAccepts > 0) lines.push(`  false accept:   ${falseAccepts}/${reject.length}  ← FAILURE`);
  }
}

function appendCategoryBreakdown(lines: string[], s: RecipeBenchmarkSummary): void {
  if (Object.keys(s.byCategory).length === 0) return;
  lines.push(``, `Category breakdown:`);
  const catOrder: BenchmarkCategory[] = ["baseline", "dietary", "macro", "reject", "messy"];
  for (const cat of catOrder) {
    const stats = s.byCategory[cat];
    if (!stats) continue;
    lines.push(
      `  ${cat.padEnd(16)} pass:${stats.passed}/${stats.total} (${pct(stats.passed, stats.total)})  family:${stats.familyMatched}/${stats.total}  expect:${stats.expectationMatched}/${stats.total}`
    );
  }
}

function appendPlannerQuality(lines: string[], s: RecipeBenchmarkSummary): void {
  lines.push(``, `Planner quality:`);
  lines.push(`  Final class-group violations:   ${s.finalClassGroupFailureCount}`);
  lines.push(`  Intermediate planner misses:    ${s.intermediateClassGroupMissCount}`);
  lines.push(`  First-pass success rate:        ${Math.round(s.firstPassSuccessRate * 100)}%`);
}

function appendStatusDistribution(lines: string[], s: RecipeBenchmarkSummary): void {
  const entries = Object.entries(s.statusCounts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return;
  lines.push(``, `Status distribution:`);
  for (const [status, count] of entries) {
    lines.push(`  ${count.toString().padStart(3)}x  ${status}`);
  }
}

function appendTopIssues(lines: string[], s: RecipeBenchmarkSummary): void {
  const top = Object.entries(s.issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  if (!top.length) return;
  lines.push(``, `Top issue codes:`);
  for (const [code, count] of top) {
    lines.push(`  ${count.toString().padStart(3)}x  ${code}`);
  }
}

function appendSlowCases(lines: string[], s: RecipeBenchmarkSummary): void {
  if (!s.slowestCases.length) return;
  lines.push(``, `Slowest cases (top 10):`);
  lines.push(`  ${"CASE".padEnd(38)}  ${"STATUS".padEnd(28)}  ${"DURATION".padEnd(10)}  CALLS  RETRIES`);
  lines.push(`  ${"─".repeat(95)}`);
  for (const c of s.slowestCases) {
    lines.push(
      `  ${c.caseId.padEnd(38)}  ${c.status.padEnd(28)}  ${`${(c.durationMs / 1000).toFixed(1)}s`.padEnd(10)}  ${String(c.modelCallsUsed).padEnd(5)}  ${c.intermediatePlannerMisses}`
    );
  }
}

function appendAcceptanceCriteria(lines: string[], s: RecipeBenchmarkSummary): void {
  lines.push(``, `Acceptance criteria:`);
  lines.push(`  ${"TIER".padEnd(8)}  ${"CHECK".padEnd(42)}  ${"ACTUAL".padEnd(22)}  THRESHOLD`);
  lines.push(`  ${"─".repeat(8)}  ${"─".repeat(42)}  ${"─".repeat(22)}  ${"─".repeat(10)}`);
  for (const check of s.acceptance.checks) {
    const mark = check.passed ? "✓" : "✗";
    lines.push(
      `  ${mark} ${check.tier.toUpperCase().padEnd(8)}  ${check.label.padEnd(42)}  ${check.actual.padEnd(22)}  ${check.threshold}`
    );
  }
  const verdictStr =
    s.acceptance.verdict === "green"
      ? s.acceptance.strong ? "GREEN + STRONG" : "GREEN (ship ready)"
      : s.acceptance.verdict === "yellow" ? "YELLOW (fixable)"
      : "RED (blocker)";
  lines.push(``, `  Verdict: ${verdictStr}`);
}

function appendFailingFamilies(lines: string[], s: RecipeBenchmarkSummary): void {
  if (!s.worstDishFamilies.length) return;
  lines.push(``, `Failing dish families:`);
  for (const f of s.worstDishFamilies) lines.push(`  • ${f}`);
}

function appendHarnessWarnings(lines: string[], s: RecipeBenchmarkSummary): void {
  const warnings: string[] = [];
  if (s.timeoutFailures > 0)
    warnings.push(`${s.timeoutFailures} TIMEOUT failure(s) — consider increasing hardTimeoutMs or investigating hang`);
  if (s.budgetFailures > 0)
    warnings.push(`${s.budgetFailures} BUDGET failure(s) — consider increasing modelCallBudget or reducing retries`);
  if (s.exceptions > 0)
    warnings.push(`${s.exceptions} EXCEPTION(s) — check logs`);
  if (!warnings.length) return;
  lines.push(``, `Harness warnings:`);
  for (const w of warnings) lines.push(`  ⚠  ${w}`);
}

function appendPerCaseResults(lines: string[], results: RecipeBenchmarkCaseResult[]): void {
  lines.push(``, `Per-case results:`);
  const catOrder: (BenchmarkCategory | undefined)[] = [
    "baseline", "dietary", "macro", "reject", "messy", undefined,
  ];
  for (const cat of catOrder) {
    const group = results.filter((r) => r.category === cat);
    if (!group.length) continue;
    lines.push(`  ── ${cat ?? "uncategorized"} ──`);
    for (const r of group) {
      const flags: string[] = [];
      if (!r.familyMatched) flags.push(`family:got ${r.actualDishFamily ?? "null"}`);
      if (r.mustHaveViolations.length) flags.push(`missing:${r.mustHaveViolations.join(",")}`);
      if (r.mustNotHaveViolations.length) flags.push(`forbidden:${r.mustNotHaveViolations.join(",")}`);
      if (r.hardTimeoutExceeded) flags.push("TIMEOUT");
      if (r.budgetExceeded) flags.push("BUDGET");
      if (!r.plannerFirstPassSucceeded) flags.push(`planner-retry:${r.intermediatePlannerMisses}`);
      if (r.error && r.status === "exception") flags.push(`err:${r.error.slice(0, 60)}`);
      const mark = isFullPass(r) ? "✓" : "✗";
      lines.push(
        `    ${mark} ${r.caseId.padEnd(36)} ${r.status.padEnd(28)} ${flags.join(" | ")}`
      );
    }
  }
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

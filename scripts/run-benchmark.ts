/**
 * Live recipe generation benchmark.
 *
 * Usage:
 *   npx tsx scripts/run-benchmark.ts
 *   npx tsx scripts/run-benchmark.ts --suite smoke
 *   npx tsx scripts/run-benchmark.ts --suite full --benchmark-mode deep
 *   npx tsx scripts/run-benchmark.ts --suite messy --runs 3
 *   npx tsx scripts/run-benchmark.ts --only-case flan_classic_01
 *   npx tsx scripts/run-benchmark.ts --only-category baseline
 *   npx tsx scripts/run-benchmark.ts --resume --run-id 2024-01-01T12-00-00
 *   npx tsx scripts/run-benchmark.ts --only-failures --run-id 2024-01-01T12-00-00
 *
 * Defaults: --suite core --benchmark-mode standard --concurrency 2
 *
 * Persistence (when --output-dir is set or by default):
 *   <output-dir>/manifest.json          run metadata
 *   <output-dir>/cases/<id>.json        per-case result
 *   <output-dir>/events.jsonl           streaming event log
 *   <output-dir>/summary.json           final summary
 *
 * Legacy flags still supported:
 *   --all              equivalent to --suite full
 *   --category <cat>   equivalent to --suite <cat>
 *   --cases <id,...>   explicit case ID list
 *   --save-artifacts [dir]
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import {
  runRecipeBenchmarks,
  runRecipeBenchmarksMultiPass,
  formatRecipeBenchmarkSummary,
  formatMultiPassReport,
  type RecipeBenchmarkCaseResult,
} from "../lib/ai/recipeBenchmarkRunner";
import { buildGenerationDeps } from "../lib/ai/repairAdapters";
import {
  RECIPE_BENCHMARK_CASES,
  BENCHMARK_SUITE_CASE_IDS,
  type BenchmarkSuiteName,
} from "../lib/ai/recipeBenchmarkCases";
import {
  BENCHMARK_MODE_CONFIGS,
  type BenchmarkModeLevel,
  type BenchmarkModeConfig,
} from "../lib/ai/benchmarkMode";

// ── Load .env.local ─────────────────────────────────────────────────────────
try {
  const envLines = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n");
  for (const line of envLines) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) {
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // allow shell env to provide vars
}

// ── Parse args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function flag(name: string): boolean {
  return args.includes(name);
}
function arg(name: string): string | null {
  const idx = args.indexOf(name);
  return idx !== -1 ? (args[idx + 1] ?? null) : null;
}

// Suite selection (new)
const suiteArg = arg("--suite") as BenchmarkSuiteName | null;

// Benchmark mode (new)
const modeArg = arg("--benchmark-mode") as BenchmarkModeLevel | null;
const benchmarkMode: BenchmarkModeConfig | undefined =
  modeArg && modeArg in BENCHMARK_MODE_CONFIGS
    ? BENCHMARK_MODE_CONFIGS[modeArg]
    : BENCHMARK_MODE_CONFIGS["standard"];

// Resume / filtering (new)
const resumeFlag = flag("--resume");
const onlyFailuresFlag = flag("--only-failures");
const fromCaseArg = arg("--from-case");
const onlyCaseArg = arg("--only-case");

// Run identity / output (new)
const runIdArg = arg("--run-id");
const outputDirArg = arg("--output-dir");
const jsonFlag = flag("--json");

// Concurrency / runs
const concurrency = parseInt(arg("--concurrency") ?? "2", 10);
const runs = parseInt(arg("--runs") ?? "1", 10);

// Legacy flags
const runAll = flag("--all");
const casesArg = arg("--cases");
const explicitCases = casesArg ? casesArg.split(",").map((s) => s.trim()) : null;
const categoryFilter = arg("--category");
const artifactsDirLegacy = (() => {
  const idx = args.indexOf("--save-artifacts");
  if (idx === -1) return null;
  const next = args[idx + 1];
  return next && !next.startsWith("--")
    ? resolve(process.cwd(), next)
    : resolve(process.cwd(), "benchmark-artifacts");
})();

// ── Resolve output directory ─────────────────────────────────────────────────
const runId = runIdArg ?? new Date().toISOString().replace(/[:.]/g, "-");
const outputBase = outputDirArg
  ? resolve(process.cwd(), outputDirArg)
  : artifactsDirLegacy
  ? artifactsDirLegacy
  : resolve(process.cwd(), "benchmark-artifacts", runId);

// ── Resolve suite → case IDs ─────────────────────────────────────────────────
function resolveSuiteCaseIds(suite: BenchmarkSuiteName | null): string[] | undefined {
  if (!suite || suite === "full") return undefined; // all cases

  // Category suites: filter RECIPE_BENCHMARK_CASES by .category
  const categoryNames: BenchmarkSuiteName[] = ["baseline", "dietary", "macro", "reject", "messy"];
  if (categoryNames.includes(suite)) {
    return RECIPE_BENCHMARK_CASES.filter((c) => c.category === suite).map((c) => c.id);
  }

  // Named suites (smoke, core, stress)
  const ids = BENCHMARK_SUITE_CASE_IDS[suite];
  if (ids) return ids;

  console.warn(`[warn] Unknown suite "${suite}", running all cases.`);
  return undefined;
}

// ── Determine which cases to run ─────────────────────────────────────────────
let caseIds: string[] | undefined;

if (onlyCaseArg) {
  caseIds = [onlyCaseArg];
} else if (explicitCases) {
  caseIds = explicitCases;
} else if (runAll) {
  caseIds = undefined;
} else if (categoryFilter) {
  // Legacy --category flag
  caseIds = RECIPE_BENCHMARK_CASES.filter((c) => c.category === categoryFilter).map((c) => c.id);
  if (!caseIds.length) {
    console.warn(`[warn] No cases found for category "${categoryFilter}"`);
    process.exit(0);
  }
} else if (suiteArg) {
  caseIds = resolveSuiteCaseIds(suiteArg);
} else {
  // Default: core suite
  caseIds = BENCHMARK_SUITE_CASE_IDS["core"];
}

// ── Apply --from-case (skip all cases before this one in run order) ──────────
if (fromCaseArg && caseIds) {
  const idx = caseIds.indexOf(fromCaseArg);
  if (idx === -1) {
    console.warn(`[warn] --from-case "${fromCaseArg}" not found in resolved case list. Ignoring.`);
  } else {
    caseIds = caseIds.slice(idx);
  }
}

// ── Resume: load already-completed case IDs from persisted files ─────────────
function loadCompletedCaseIds(dir: string): Set<string> {
  const casesDir = join(dir, "cases");
  if (!existsSync(casesDir)) return new Set();
  const completed = new Set<string>();
  for (const file of readdirSync(casesDir)) {
    if (!file.endsWith(".json")) continue;
    // filename pattern: <caseId>.json  or  <caseId>__run-N.json
    const caseId = file.replace(/(__run-\d+)?\.json$/, "");
    completed.add(caseId);
  }
  return completed;
}

function loadFailedCaseIds(dir: string): string[] {
  const summaryPath = join(dir, "summary.json");
  if (!existsSync(summaryPath)) {
    console.error(`[error] --only-failures requires a previous run summary at ${summaryPath}`);
    process.exit(1);
  }
  try {
    const summary = JSON.parse(readFileSync(summaryPath, "utf-8"));
    // summary.json stores the full RecipeBenchmarkRun
    const results: Array<{ caseId: string; passExpectationMet: boolean; familyMatched: boolean; mustHaveViolations: string[]; mustNotHaveViolations: string[]; status: string }> =
      summary.results ?? [];
    return results
      .filter((r) => {
        const allGood =
          r.passExpectationMet &&
          r.familyMatched &&
          !r.mustHaveViolations?.length &&
          !r.mustNotHaveViolations?.length &&
          r.status !== "timeout_failure" &&
          r.status !== "budget_failure";
        return !allGood;
      })
      .map((r) => r.caseId);
  } catch {
    console.error(`[error] Could not parse summary.json at ${summaryPath}`);
    process.exit(1);
  }
}

let skipCaseIds: Set<string> | undefined;

if (onlyFailuresFlag) {
  // Re-run only failed cases from a previous run
  const failedIds = loadFailedCaseIds(outputBase);
  if (!failedIds.length) {
    console.log("[info] No failed cases found in previous run. Nothing to re-run.");
    process.exit(0);
  }
  // Intersect with existing caseIds filter if any
  caseIds = caseIds ? failedIds.filter((id) => caseIds!.includes(id)) : failedIds;
  console.log(`[resume] Re-running ${caseIds.length} failed case(s) from previous run.`);
} else if (resumeFlag) {
  skipCaseIds = loadCompletedCaseIds(outputBase);
  if (skipCaseIds.size) {
    console.log(`[resume] Skipping ${skipCaseIds.size} already-completed case(s).`);
  }
}

// ── Final case list for display ───────────────────────────────────────────────
const allCases = caseIds
  ? RECIPE_BENCHMARK_CASES.filter((c) => caseIds!.includes(c.id))
  : RECIPE_BENCHMARK_CASES;
const totalToRun = skipCaseIds
  ? allCases.filter((c) => !skipCaseIds!.has(c.id)).length
  : allCases.length;

// ── Persistence helpers ───────────────────────────────────────────────────────
function ensureOutputDir(): void {
  mkdirSync(join(outputBase, "cases"), { recursive: true });
}

function appendEvent(event: Record<string, unknown>): void {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n";
    const { appendFileSync } = require("fs") as typeof import("fs");
    appendFileSync(join(outputBase, "events.jsonl"), line, "utf-8");
  } catch {
    // non-fatal
  }
}

function saveCaseResult(result: RecipeBenchmarkCaseResult, runIndex = 1): void {
  try {
    ensureOutputDir();
    const suffix = runs > 1 ? `__run-${runIndex}` : "";
    const path = join(outputBase, "cases", `${result.caseId}${suffix}.json`);
    writeFileSync(path, JSON.stringify(result, null, 2), "utf-8");
  } catch (e) {
    console.warn(`[warn] Could not save case result: ${e}`);
  }
}

function saveManifest(meta: Record<string, unknown>): void {
  try {
    ensureOutputDir();
    writeFileSync(join(outputBase, "manifest.json"), JSON.stringify(meta, null, 2), "utf-8");
  } catch (e) {
    console.warn(`[warn] Could not save manifest: ${e}`);
  }
}

function saveSummary(data: unknown): void {
  try {
    ensureOutputDir();
    writeFileSync(join(outputBase, "summary.json"), JSON.stringify(data, null, 2), "utf-8");
    console.log(`\n[artifact] summary.json → ${outputBase}`);
  } catch (e) {
    console.warn(`[warn] Could not save summary: ${e}`);
  }
}

// ── Live progress callback ────────────────────────────────────────────────────
function makeCaseCompleteCallback(runLabel: string, runIndex = 1) {
  return (result: RecipeBenchmarkCaseResult) => {
    const allGood =
      result.passExpectationMet &&
      result.familyMatched &&
      !result.mustHaveViolations.length &&
      !result.mustNotHaveViolations.length &&
      result.status !== "timeout_failure" &&
      result.status !== "budget_failure";
    const mark = allGood ? "✓" : "✗";
    const duration = `${(result.durationMs / 1000).toFixed(1)}s`;
    const family = result.actualDishFamily ?? "null";
    const flags: string[] = [];
    if (!result.familyMatched) flags.push(`expected:${result.expectedDishFamily}`);
    if (result.mustHaveViolations.length) flags.push(`missing:${result.mustHaveViolations.join(",")}`);
    if (result.mustNotHaveViolations.length) flags.push(`forbidden:${result.mustNotHaveViolations.join(",")}`);
    if (result.softTimeoutExceeded) flags.push("soft_timeout");
    if (result.status === "timeout_failure") flags.push("HARD_TIMEOUT");
    if (result.status === "budget_failure") flags.push("BUDGET_EXCEEDED");
    if (result.error) flags.push(`err:${result.error.slice(0, 60)}`);
    console.log(
      `  ${mark} [${runLabel}] ${result.caseId.padEnd(36)} ${result.status.padEnd(28)} family:${family.padEnd(20)} ${duration.padStart(6)}  calls:${result.modelCallsUsed}${flags.length ? "  " + flags.join(" | ") : ""}`
    );

    saveCaseResult(result, runIndex);
    appendEvent({ type: "case_complete", caseId: result.caseId, run: runIndex, pass: allGood, status: result.status, durationMs: result.durationMs });
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
void (async () => {
  const effectiveSuite = suiteArg ?? (runAll ? "full" : categoryFilter ?? "core");
  const effectiveMode = modeArg ?? "standard";

  console.log(`\nRecipe Generation Benchmark`);
  console.log(`Suite: ${effectiveSuite} | Mode: ${effectiveMode} | Cases: ${totalToRun} | Concurrency: ${concurrency} | Runs: ${runs}`);
  if (onlyCaseArg) console.log(`Only case: ${onlyCaseArg}`);
  if (resumeFlag) console.log(`Resume: ${outputBase}`);
  if (onlyFailuresFlag) console.log(`Failures-only re-run from: ${outputBase}`);
  console.log(`Output: ${outputBase}`);
  console.log(`─────────────────────────────────────────────\n`);

  saveManifest({
    runId,
    suite: effectiveSuite,
    benchmarkMode: effectiveMode,
    startedAt: new Date().toISOString(),
    totalCases: totalToRun,
    concurrency,
    runs,
    resume: resumeFlag,
    onlyFailures: onlyFailuresFlag,
  });

  appendEvent({ type: "run_start", runId, suite: effectiveSuite, mode: effectiveMode, totalCases: totalToRun });

  const deps = buildGenerationDeps();

  if (runs > 1) {
    // Multi-pass consistency mode
    const report = await runRecipeBenchmarksMultiPass({
      deps,
      caseIds,
      skipCaseIds,
      concurrency,
      runs,
      benchmarkMode,
      suiteName: suiteArg ?? undefined,
      onRunComplete: (runIndex, run) => {
        const s = run.summary;
        const verdict = s.acceptance.verdict === "green"
          ? (s.acceptance.strong ? "GREEN+STRONG" : "GREEN")
          : s.acceptance.verdict === "yellow" ? "YELLOW" : "RED";
        console.log(`\n  ── Run ${runIndex + 1}/${runs} complete: ${s.passed}/${s.totalCases} passed (${Math.round(s.expectationMatchRate * 100)}% expect) — ${verdict}`);
        appendEvent({ type: "run_complete", run: runIndex + 1, passed: s.passed, total: s.totalCases, verdict });
        if (jsonFlag || outputDirArg) {
          try {
            ensureOutputDir();
            writeFileSync(
              join(outputBase, `run-${runIndex + 1}-of-${runs}.json`),
              JSON.stringify(run, null, 2),
              "utf-8"
            );
          } catch { /* non-fatal */ }
        }
      },
      onCaseComplete: makeCaseCompleteCallback(`run?`),
      onSoftTimeout: (caseId, elapsedMs) => {
        console.warn(`  [soft_timeout] ${caseId} — ${(elapsedMs / 1000).toFixed(1)}s`);
        appendEvent({ type: "soft_timeout", caseId, elapsedMs });
      },
    });

    const formatted = formatMultiPassReport(report);
    console.log("\n" + formatted);

    if (jsonFlag || outputDirArg) saveSummary(report);
    appendEvent({ type: "benchmark_done", consistencyRate: report.consistencyRate, unstable: report.unstableCaseIds });
  } else {
    // Single-pass mode
    const run = await runRecipeBenchmarks({
      deps,
      caseIds,
      skipCaseIds,
      concurrency,
      benchmarkMode,
      suiteName: suiteArg ?? undefined,
      onCaseComplete: makeCaseCompleteCallback("1", 1),
      onSoftTimeout: (caseId, elapsedMs) => {
        console.warn(`  [soft_timeout] ${caseId} — ${(elapsedMs / 1000).toFixed(1)}s`);
        appendEvent({ type: "soft_timeout", caseId, elapsedMs });
      },
    });

    const formatted = formatRecipeBenchmarkSummary(run);
    console.log("\n" + formatted);

    if (jsonFlag || outputDirArg) saveSummary(run);
    appendEvent({ type: "benchmark_done", passed: run.summary.passed, total: run.summary.totalCases });
  }
})();

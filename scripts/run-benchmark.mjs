/**
 * Live recipe generation benchmark.
 *
 * Runs a subset (or all) of RECIPE_BENCHMARK_CASES through the full
 * orchestrateRecipeGeneration pipeline with real LLM calls.
 *
 * Usage:
 *   node --import tsx/esm scripts/run-benchmark.mjs
 *   node --import tsx/esm scripts/run-benchmark.mjs --all
 *   node --import tsx/esm scripts/run-benchmark.mjs --cases flan_classic_01,brownie_01
 *   node --import tsx/esm scripts/run-benchmark.mjs --concurrency 3
 */

import { readFileSync } from "fs";
import { resolve } from "path";

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
const runAll = args.includes("--all");

const casesIdx = args.indexOf("--cases");
const explicitCases = casesIdx !== -1 ? args[casesIdx + 1]?.split(",").map((s) => s.trim()) : null;

const concIdx = args.indexOf("--concurrency");
const concurrency = concIdx !== -1 ? parseInt(args[concIdx + 1], 10) : 1;

// ── Default subset: one case per major dish family ───────────────────────────
const DEFAULT_CASE_IDS = [
  "flan_classic_01",        // custard_flan
  "brownie_01",             // brownie
  "risotto_01",             // risotto — savory, no sweetener
  "chicken_stir_fry_01",   // stir_fry
  "pasta_high_protein_01", // pasta + macro targets
  "vegan_curry_01",        // curry + dietary constraint + macro
  "impossible_dessert_macro_01", // shouldPass=false edge case
];

// ── Imports (tsx resolves TS) ─────────────────────────────────────────────────
const { runRecipeBenchmarks, formatRecipeBenchmarkSummary } = await import(
  "../lib/ai/recipeBenchmarkRunner.ts"
);
const { buildGenerationDeps } = await import("../lib/ai/repairAdapters.ts");
const { RECIPE_BENCHMARK_CASES } = await import("../lib/ai/recipeBenchmarkCases.ts");

// ── Determine which cases to run ─────────────────────────────────────────────
let caseIds;
if (runAll) {
  caseIds = undefined; // all
} else if (explicitCases) {
  caseIds = explicitCases;
} else {
  // Filter to IDs that actually exist in the case list
  const available = new Set(RECIPE_BENCHMARK_CASES.map((c) => c.id));
  caseIds = DEFAULT_CASE_IDS.filter((id) => available.has(id));
  if (caseIds.length < DEFAULT_CASE_IDS.length) {
    const missing = DEFAULT_CASE_IDS.filter((id) => !available.has(id));
    console.warn(`[warn] Some default case IDs not found: ${missing.join(", ")}`);
  }
}

const totalToRun = caseIds
  ? caseIds.length
  : RECIPE_BENCHMARK_CASES.length;

console.log(`\nRecipe Generation Benchmark`);
console.log(`Cases: ${totalToRun} | Concurrency: ${concurrency}`);
console.log(`─────────────────────────────────────────────\n`);

// ── Run ───────────────────────────────────────────────────────────────────────
const run = await runRecipeBenchmarks({
  deps: buildGenerationDeps(),
  caseIds,
  concurrency,
  onCaseComplete: (result) => {
    const mark = result.passExpectationMet && result.familyMatched && !result.mustHaveViolations.length && !result.mustNotHaveViolations.length ? "✓" : "✗";
    const duration = `${(result.durationMs / 1000).toFixed(1)}s`;
    const family = result.actualDishFamily ?? "null";
    const flags = [];
    if (!result.familyMatched) flags.push(`expected:${result.expectedDishFamily}`);
    if (result.mustHaveViolations.length) flags.push(`missing:${result.mustHaveViolations.join(",")}`);
    if (result.mustNotHaveViolations.length) flags.push(`forbidden:${result.mustNotHaveViolations.join(",")}`);
    if (result.error) flags.push(`err:${result.error.slice(0, 60)}`);
    console.log(
      `  ${mark} ${result.caseId.padEnd(34)} ${result.status.padEnd(30)} family:${family.padEnd(20)} ${duration.padStart(6)}  ${flags.join(" | ")}`
    );
  },
});

console.log("\n" + formatRecipeBenchmarkSummary(run));

/**
 * User simulation suite runner.
 *
 * Runs the USER_SIMULATION_SUITE through the full orchestration pipeline and
 * produces a human-reviewable output focused on:
 *   - intent fit (did it pick a sensible family?)
 *   - recipe plausibility (does the output feel right?)
 *   - constraint respect (did it honor obvious signals?)
 *   - failure mode (wrong family, ignored constraints, etc.)
 *
 * This is NOT a pass/fail correctness runner. It produces review artifacts.
 *
 * Usage:
 *   npx tsx scripts/run-simulation.ts
 *   npx tsx scripts/run-simulation.ts --intent-type pantry
 *   npx tsx scripts/run-simulation.ts --intent-type ambiguous
 *   npx tsx scripts/run-simulation.ts --difficulty hard
 *   npx tsx scripts/run-simulation.ts --ids sim_pantry_01,sim_multi_03
 *   npx tsx scripts/run-simulation.ts --intent-type multi_intent --output-dir sim-results
 */

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { orchestrateRecipeGeneration } from "../lib/ai/recipeGenerationOrchestrator";
import { buildGenerationDeps } from "../lib/ai/repairAdapters";
import {
  USER_SIMULATION_SUITE,
  getSimCasesByIntent,
  getSimCasesByDifficulty,
  type UserSimCase,
  type SimIntentType,
  type SimDifficulty,
} from "../lib/ai/userSimulationSuite";

// ── Load .env.local ─────────────────────────────────────────────────────────
try {
  const envLines = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n");
  for (const line of envLines) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) {
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
} catch { /* shell env */ }

// ── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name: string) { return args.includes(name); }
function arg(name: string): string | null {
  const idx = args.indexOf(name);
  return idx !== -1 ? (args[idx + 1] ?? null) : null;
}

const intentFilter = arg("--intent-type") as SimIntentType | null;
const difficultyFilter = arg("--difficulty") as SimDifficulty | null;
const idsArg = arg("--ids");
const explicitIds = idsArg ? idsArg.split(",").map((s) => s.trim()) : null;
const concurrency = parseInt(arg("--concurrency") ?? "2", 10);
const outputDirArg = arg("--output-dir");
const jsonFlag = flag("--json");

// ── Select cases ─────────────────────────────────────────────────────────────
let cases: UserSimCase[];
if (explicitIds) {
  cases = USER_SIMULATION_SUITE.filter((c) => explicitIds.includes(c.id));
} else if (intentFilter) {
  cases = getSimCasesByIntent(intentFilter);
} else if (difficultyFilter) {
  cases = getSimCasesByDifficulty(difficultyFilter);
} else {
  cases = USER_SIMULATION_SUITE;
}

if (!cases.length) {
  console.error("[error] No simulation cases matched the given filters.");
  process.exit(1);
}

// ── Output setup ─────────────────────────────────────────────────────────────
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputBase = outputDirArg
  ? resolve(process.cwd(), outputDirArg)
  : resolve(process.cwd(), "simulation-artifacts", runId);

function ensureOutputDir(): void {
  mkdirSync(outputBase, { recursive: true });
}

// ── Result type ───────────────────────────────────────────────────────────────
type SimResult = {
  id: string;
  prompt: string;
  intentType: SimIntentType;
  difficulty: SimDifficulty;
  notes?: string;
  resolvedFamily: string | null;
  recipeTitle: string | null;
  ingredientPreview: string[];
  stepCount: number;
  status: string;
  durationMs: number;
  modelCalls: number;
  plannerRetries: number;
  issueCodes: string[];
  error?: string;
  // Review signals
  familyResolved: boolean;
  producedRecipe: boolean;
  /** Case is flagged as acceptable to not resolve — needs clarification flow, not a resolver fix. */
  acceptableUnresolved: boolean;
};

// ── Run one case ──────────────────────────────────────────────────────────────
async function runSimCase(simCase: UserSimCase, deps: ReturnType<typeof buildGenerationDeps>): Promise<SimResult> {
  const started = Date.now();
  try {
    const result = await orchestrateRecipeGeneration(
      {
        userIntent: simCase.prompt,
        titleHint: null,
        dishHint: null,
        dietaryConstraints: [],
        macroTargets: null,
        servings: 2,
        availableIngredients: [],
        preferredIngredients: [],
        forbiddenIngredients: [],
        creativityMode: "safe",
        requestId: `sim_${simCase.id}_${Date.now()}`,
        maxFallbackFamilies: 3,
      },
      deps
    );

    const durationMs = Date.now() - started;
    const ingredients = result.recipe?.ingredients ?? [];
    const ingredientPreview = ingredients.slice(0, 5).map((i) => i.ingredientName);

    // Count planner retries from telemetry
    const plannerRetries = result.telemetry.session.events.filter(
      (e) => e.stage === "ingredient_plan_repair"
    ).length;

    // Collect issue codes
    const issueCodes = Array.from(
      new Set(result.telemetry.session.events.flatMap((e) => (e.issues ?? []).map((i) => i.code)))
    );

    return {
      id: simCase.id,
      prompt: simCase.prompt,
      intentType: simCase.intentType,
      difficulty: simCase.difficulty,
      notes: simCase.notes,
      resolvedFamily: result.dishFamily?.key ?? null,
      recipeTitle: result.recipe?.title ?? null,
      ingredientPreview,
      stepCount: result.recipe?.steps?.length ?? 0,
      status: result.status,
      durationMs,
      modelCalls: 0, // not instrumented separately in sim runner
      plannerRetries,
      issueCodes,
      familyResolved: result.dishFamily != null,
      producedRecipe: result.recipe != null,
      acceptableUnresolved: simCase.acceptableUnresolved ?? false,
    };
  } catch (err) {
    return {
      id: simCase.id,
      prompt: simCase.prompt,
      intentType: simCase.intentType,
      difficulty: simCase.difficulty,
      notes: simCase.notes,
      resolvedFamily: null,
      recipeTitle: null,
      ingredientPreview: [],
      stepCount: 0,
      status: "exception",
      durationMs: Date.now() - started,
      modelCalls: 0,
      plannerRetries: 0,
      issueCodes: ["EXCEPTION"],
      error: err instanceof Error ? err.message : String(err),
      familyResolved: false,
      producedRecipe: false,
      acceptableUnresolved: simCase.acceptableUnresolved ?? false,
    };
  }
}

// ── Format one result ─────────────────────────────────────────────────────────
function formatResult(r: SimResult, idx: number, total: number): string {
  const statusMark = r.producedRecipe ? "✓" : "✗";
  const familyMark = r.familyResolved ? r.resolvedFamily! : "UNRESOLVED";
  const dur = `${(r.durationMs / 1000).toFixed(1)}s`;
  const retries = r.plannerRetries > 0 ? `  retries:${r.plannerRetries}` : "";
  const lines = [
    `${statusMark} [${idx}/${total}] ${r.id}  (${r.intentType} / ${r.difficulty})`,
    `  prompt:      "${r.prompt}"`,
    `  family:      ${familyMark}`,
    `  title:       ${r.recipeTitle ?? "—"}`,
    `  ingredients: ${r.ingredientPreview.length ? r.ingredientPreview.join(", ") : "—"}`,
    `  steps:       ${r.stepCount}`,
    `  status:      ${r.status}  ${dur}${retries}`,
  ];
  if (r.notes) lines.push(`  note:        ${r.notes}`);
  if (r.error) lines.push(`  error:       ${r.error.slice(0, 100)}`);
  if (r.issueCodes.length) lines.push(`  issues:      ${r.issueCodes.slice(0, 5).join(", ")}`);
  return lines.join("\n");
}

// ── Review packet ─────────────────────────────────────────────────────────────
function buildReviewPacket(results: SimResult[]): string {
  const total = results.length;
  const resolved = results.filter((r) => r.familyResolved).length;
  const produced = results.filter((r) => r.producedRecipe).length;
  const failed = results.filter((r) => !r.producedRecipe).length;
  const unresolved = results.filter((r) => !r.familyResolved);
  const exceptions = results.filter((r) => r.status === "exception");
  const regenerates = results.filter((r) => r.status === "regenerate_from_ingredients");

  // ── Scorecard ──────────────────────────────────────────────────────────────
  const acceptableUnresolvedCount = unresolved.filter((r) => r.acceptableUnresolved).length;
  const trueRoutingFailureCount   = unresolved.filter((r) => !r.acceptableUnresolved).length;
  // Downstream = resolved family but failed to produce recipe (planner/feasibility)
  const downstreamFailureCount    = results.filter((r) => r.familyResolved && !r.producedRecipe).length;

  const avgMs = results.reduce((s, r) => s + r.durationMs, 0) / total;
  const sortedMs = [...results].map((r) => r.durationMs).sort((a, b) => a - b);
  const p90 = sortedMs[Math.floor(sortedMs.length * 0.9)] ?? 0;

  const byFamily: Record<string, number> = {};
  for (const r of results) {
    if (r.resolvedFamily) byFamily[r.resolvedFamily] = (byFamily[r.resolvedFamily] ?? 0) + 1;
  }
  const topFamilies = Object.entries(byFamily).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const issueTotals: Record<string, number> = {};
  for (const r of results) {
    for (const code of r.issueCodes) issueTotals[code] = (issueTotals[code] ?? 0) + 1;
  }
  const topIssues = Object.entries(issueTotals).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const pct = (n: number, d: number) => d > 0 ? `${Math.round(n / d * 100)}%` : "n/a";

  const lines: string[] = [
    `Simulation Review Packet`,
    `═════════════════════════════════════════════`,
    `Cases:         ${total}`,
    ``,
    `── Scorecard ────────────────────────────────`,
    `resolver_success_rate:      ${resolved}/${total} (${pct(resolved, total)})`,
    `recipe_production_rate:     ${produced}/${total} (${pct(produced, total)})`,
    `acceptable_unresolved:      ${acceptableUnresolvedCount}  (needs clarification flow — not a resolver bug)`,
    `downstream_failures:        ${downstreamFailureCount}  (resolved family, planner/feasibility failed)`,
    `true_routing_failures:      ${trueRoutingFailureCount}  (resolver bug — must be zero before launch)`,
    ``,
    `── Run stats ─────────────────────────────────`,
    `Failed total:  ${failed}  (regenerate:${regenerates.length}  exception:${exceptions.length})`,
    `Avg duration:  ${Math.round(avgMs)}ms   p90:${Math.round(p90)}ms`,
    ``,
    `Family distribution (top 10):`,
    ...topFamilies.map(([f, n]) => `  ${n.toString().padStart(3)}x  ${f}`),
    ``,
    `Top issue codes:`,
    ...topIssues.map(([c, n]) => `  ${n.toString().padStart(3)}x  ${c}`),
  ];

  if (unresolved.length) {
    const acceptableGroup = unresolved.filter((r) => r.acceptableUnresolved);
    const trueFailGroup   = unresolved.filter((r) => !r.acceptableUnresolved && !r.issueCodes.includes("EXCEPTION"));
    const exceptionGroup  = unresolved.filter((r) => r.issueCodes.includes("EXCEPTION"));

    lines.push(``, `Unresolved family (${unresolved.length} cases) — grouped by reason:`);

    if (trueFailGroup.length) {
      lines.push(`  [true routing failure — ${trueFailGroup.length}]  ← fix before launch`);
      for (const r of trueFailGroup) {
        lines.push(`    ${r.id.padEnd(26)}  "${r.prompt.slice(0, 60)}"`);
      }
    }
    if (acceptableGroup.length) {
      lines.push(`  [acceptable unresolved — ${acceptableGroup.length}]  ← needs clarification/recommendation flow`);
      for (const r of acceptableGroup) {
        lines.push(`    ${r.id.padEnd(26)}  "${r.prompt.slice(0, 60)}"`);
      }
    }
    if (exceptionGroup.length) {
      lines.push(`  [transient exception — ${exceptionGroup.length}]`);
      for (const r of exceptionGroup) {
        lines.push(`    ${r.id.padEnd(26)}  "${r.prompt.slice(0, 60)}"  err:${(r.error ?? "").slice(0, 60)}`);
      }
    }
  }

  if (regenerates.length) {
    lines.push(``, `Regenerated (could not produce recipe) — (${regenerates.length} cases):`);
    for (const r of regenerates) {
      lines.push(`  ${r.id.padEnd(28)}  family:${r.resolvedFamily ?? "null"}  "${r.prompt.slice(0, 60)}"`);
    }
  }

  // Flag potential weak outputs: produced but family looks off for the prompt
  const suspectFamilies = results.filter(
    (r) => r.producedRecipe && ["stir_fry", "omelet_frittata"].includes(r.resolvedFamily ?? "") &&
      !r.prompt.toLowerCase().includes("stir") && !r.prompt.toLowerCase().includes("egg")
  );
  if (suspectFamilies.length) {
    lines.push(``, `Potentially generic routing (stir_fry/omelet as default fallback) — review manually:`);
    for (const r of suspectFamilies) {
      lines.push(`  ${r.id.padEnd(28)}  → ${r.resolvedFamily}  "${r.prompt.slice(0, 60)}"`);
    }
  }

  return lines.join("\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────
void (async () => {
  const filter = intentFilter ? `intent:${intentFilter}` :
    difficultyFilter ? `difficulty:${difficultyFilter}` :
    explicitIds ? `ids:${explicitIds.join(",")}` : "all";

  console.log(`\nSimulation Suite Runner`);
  console.log(`Cases: ${cases.length} | Filter: ${filter} | Concurrency: ${concurrency}`);
  console.log(`Output: ${outputBase}`);
  console.log(`─────────────────────────────────────────────\n`);

  const deps = buildGenerationDeps();
  const results: SimResult[] = [];
  let completed = 0;

  for (let i = 0; i < cases.length; i += concurrency) {
    const batch = cases.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((c) => runSimCase(c, deps)));
    for (const r of batchResults) {
      results.push(r);
      completed++;
      console.log(formatResult(r, completed, cases.length));
      console.log();
    }
  }

  const packet = buildReviewPacket(results);
  console.log("\n" + packet);

  if (jsonFlag || outputDirArg) {
    ensureOutputDir();
    writeFileSync(join(outputBase, "results.json"), JSON.stringify(results, null, 2), "utf-8");
    writeFileSync(join(outputBase, "review-packet.txt"), packet, "utf-8");
    console.log(`\n[artifact] ${outputBase}`);
  }
})();

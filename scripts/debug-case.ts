/**
 * Debug runner: executes a single benchmark case and prints the full pipeline
 * output — planner ingredients with resolved classes, validation issues at each
 * stage, and the final decision.
 *
 * Usage:
 *   npx tsx --require ./scripts/_mock-server-only.cjs scripts/debug-case.ts <caseId>
 *
 * Example:
 *   npx tsx --require ./scripts/_mock-server-only.cjs scripts/debug-case.ts vegan_curry_01
 */

import { readFileSync } from "fs";
import { resolve } from "path";
try {
  const envLines = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n");
  for (const line of envLines) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
} catch { /* allow shell env */ }

import { RECIPE_BENCHMARK_CASES } from "../lib/ai/recipeBenchmarkCases";
import { orchestrateRecipeGeneration } from "../lib/ai/recipeGenerationOrchestrator";
import { buildGenerationDeps } from "../lib/ai/repairAdapters";
import { classifyIngredient } from "../lib/ai/ingredientClassifier";

const caseId = process.argv[2];
if (!caseId) {
  console.error("Usage: debug-case.ts <caseId>");
  process.exit(1);
}

const benchCase = RECIPE_BENCHMARK_CASES.find((c) => c.id === caseId);
if (!benchCase) {
  console.error(`Case "${caseId}" not found. Available:`);
  console.error(RECIPE_BENCHMARK_CASES.map((c) => `  ${c.id}`).join("\n"));
  process.exit(1);
}

void (async () => {
  console.log(`\n=== Debug: ${benchCase.id} ===`);
  console.log(`Prompt: ${benchCase.prompt}`);
  if (benchCase.dietaryConstraints?.length)
    console.log(`Dietary: ${benchCase.dietaryConstraints.join(", ")}`);
  if (benchCase.macroTargets)
    console.log(`Macros: ${JSON.stringify(benchCase.macroTargets)}`);
  console.log();

  const deps = buildGenerationDeps();

  // Monkey-patch callPlannerModel to capture output
  let plannerAttempts: Array<{ attempt: number; ingredients: Array<{ name: string; classes: string[] }> }> = [];
  let plannerCallCount = 0;
  const origPlanner = deps.callPlannerModel;
  deps.callPlannerModel = async (payload) => {
    plannerCallCount++;
    const attempt = plannerCallCount;
    const result = await origPlanner(payload);
    const enriched = (result.ingredients ?? []).map((ing) => ({
      name: ing.ingredientName,
      quantity: ing.quantity,
      unit: ing.unit,
      grams: ing.grams,
      llmClasses: ing.classes ?? [],
      classifierClasses: classifyIngredient(ing.ingredientName),
    }));
    plannerAttempts.push({
      attempt,
      ingredients: enriched.map((e) => ({
        name: e.name,
        qty: e.quantity != null ? `${e.quantity} ${e.unit ?? ""}`.trim() : e.grams != null ? `${e.grams}g` : "(no qty)",
        classes: Array.from(new Set([...e.llmClasses, ...e.classifierClasses])),
      })),
    });
    return result;
  };

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
      requestId: `debug_${caseId}_${Date.now()}`,
    },
    deps
  );

  // Print planner attempts
  for (const pa of plannerAttempts) {
    console.log(`--- Planner attempt ${pa.attempt} ---`);
    for (const ing of pa.ingredients) {
      const qtyStr = (ing as { qty?: string }).qty ?? "(no qty)";
      console.log(`  ${ing.name.padEnd(40)} ${qtyStr.padEnd(15)} [${ing.classes.join(", ")}]`);
    }
    console.log();
  }

  // Print telemetry events with issues
  console.log("--- Pipeline events ---");
  for (const event of result.telemetry.session.events) {
    const issues = event.issues?.length
      ? "\n" + event.issues.map((i) => `    [${i.severity}] ${i.code}: ${i.message}`).join("\n")
      : "";
    console.log(`  ${event.stage} → ${event.status}${issues}`);
  }

  // Final result
  console.log(`\n--- Final result ---`);
  console.log(`Status: ${result.status}`);
  console.log(`Success: ${result.success}`);
  if (result.recipe) {
    console.log(`\nIngredients:`);
    for (const ing of result.recipe.ingredients) {
      console.log(`  ${ing.ingredientName}`);
    }
  }
})();

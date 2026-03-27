import assert from "node:assert/strict";
import {
  CHEF_EXPECTED_RULES_SEED,
  CHEF_FIX_STRATEGIES_SEED,
  CHEF_RULES_SEED,
  DEFAULT_CHEF_SCORE_PROFILES,
} from "../lib/ai/chefCatalog";
import { analyzeRecipeForChefScore, applyChefFixActions, calculateChefScore, compareChefScores, generateChefFixes } from "../lib/ai/chefScoring";
import { CHEF_CATALOG_FIXTURES } from "./chef-catalog-fixtures";

const ACCEPTANCE_FIXTURE_IDS = [
  "cookies_fragile",
  "grilled_skin_on_chicken",
  "low_fat_dairy_sauce",
  "pasta_basic",
  "mushroom_garlic_saute",
];

function profileForCategory(category: string) {
  return (
    DEFAULT_CHEF_SCORE_PROFILES.find((profile) => profile.recipeCategory === category) ??
    DEFAULT_CHEF_SCORE_PROFILES.find((profile) => profile.recipeCategory === "general")!
  );
}

function normalizeStringArray(values: unknown[], key: "name" | "text") {
  return values
    .map((value) => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object" && typeof (value as Record<string, unknown>)[key] === "string") {
        return (value as Record<string, string>)[key];
      }
      return "";
    })
    .filter((value) => value.length > 0);
}

async function main() {
  const fixtures = CHEF_CATALOG_FIXTURES.filter((fixture) => ACCEPTANCE_FIXTURE_IDS.includes(fixture.id));
  assert.equal(fixtures.length, ACCEPTANCE_FIXTURE_IDS.length, "Acceptance fixtures are incomplete.");

  for (const fixture of fixtures) {
    const analysis = analyzeRecipeForChefScore({
      recipeTitle: fixture.title,
      ingredients: fixture.ingredients,
      steps: fixture.steps,
    });
    const baseScore = calculateChefScore({
      recipeTitle: fixture.title,
      ingredients: fixture.ingredients,
      steps: fixture.steps,
      rules: CHEF_RULES_SEED,
      expectedRules: CHEF_EXPECTED_RULES_SEED,
      profile: profileForCategory(analysis.recipeCategory),
    });
    const fixes = generateChefFixes({
      score: baseScore,
      mode: "reliability",
      strategies: CHEF_FIX_STRATEGIES_SEED,
    });

    assert.ok(fixes.fixes.length > 0, `${fixture.id}: expected at least one Chef Fix suggestion`);
    assert.ok(fixes.projectedDelta >= 0, `${fixture.id}: projected delta should not be negative`);

    const preview = applyChefFixActions(
      {
        title: fixture.title,
        ingredients: fixture.ingredients,
        steps: fixture.steps,
        notes: null,
      },
      fixes.fixes.flatMap((fix) => fix.actions)
    );

    assert.ok(
      JSON.stringify(preview.steps) !== JSON.stringify(fixture.steps) ||
        JSON.stringify(preview.ingredients) !== JSON.stringify(fixture.ingredients) ||
        preview.notes !== null,
      `${fixture.id}: applying fixes should change the recipe content`
    );

    const improvedScore = calculateChefScore({
      recipeTitle: fixture.title,
      ingredients: normalizeStringArray(preview.ingredients as unknown[], "name"),
      steps: normalizeStringArray(preview.steps as unknown[], "text"),
      rules: CHEF_RULES_SEED,
      expectedRules: CHEF_EXPECTED_RULES_SEED,
      profile: profileForCategory(analysis.recipeCategory),
    });
    const comparison = compareChefScores(baseScore, improvedScore);
    assert.ok(improvedScore.totalScore >= baseScore.totalScore, `${fixture.id}: expected score to improve or hold`);

    console.log(
      `${fixture.id}: ${baseScore.totalScore} -> ${improvedScore.totalScore} (${comparison.delta >= 0 ? "+" : ""}${comparison.delta})`
    );
    if (comparison.improvedAreas.length > 0) {
      console.log(`  improved: ${comparison.improvedAreas.join(", ")}`);
    }
    if (fixes.fixes[0]?.targetReasons?.length) {
      console.log(`  top fix targets: ${fixes.fixes[0].targetReasons.join(" | ")}`);
    }
  }

  console.log("Chef acceptance flow passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

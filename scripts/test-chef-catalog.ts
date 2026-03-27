import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  CHEF_EXPECTED_RULES_SEED,
  CHEF_FIX_STRATEGIES_SEED,
  CHEF_RULES_SEED,
  DEFAULT_CHEF_SCORE_PROFILES,
  type ChefExpectedRuleRecord,
  type ChefFixStrategyRecord,
  type ChefRuleRecord,
  type ChefScoreProfileRecord,
} from "../lib/ai/chefCatalog";
import { analyzeRecipeForChefScore, calculateChefScore, generateChefFixes } from "../lib/ai/chefScoring";
import { type ChefEditAction } from "../lib/ai/chefIntelligence";
import { CHEF_CATALOG_FIXTURES } from "./chef-catalog-fixtures";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function scoreProfileForCategory(profiles: ChefScoreProfileRecord[], category: string) {
  return profiles.find((profile) => profile.recipeCategory === category) ?? profiles.find((profile) => profile.recipeCategory === "general");
}

function diffKeys(current: string[], expected: string[]) {
  const currentSet = new Set(current);
  const expectedSet = new Set(expected);
  return {
    extra: current.filter((key) => !expectedSet.has(key)).sort(),
    missing: expected.filter((key) => !currentSet.has(key)).sort(),
  };
}

async function loadCatalog() {
  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [rulesResult, expectationsResult, profilesResult, fixStrategiesResult] = await Promise.all([
    supabase
      .from("chef_rules")
      .select("id, rule_key, title, category, subcategory, layer, trigger_conditions, exclusion_conditions, rule_type, severity, user_explanation, failure_if_missing, action_type, action_payload_template, expected_score_impact, confidence, applicability, priority"),
    supabase.from("chef_category_expectations").select("recipe_category, expectation_key, description, bucket, impact"),
    supabase.from("chef_score_profiles").select("recipe_category, flavor_weight, technique_weight, texture_weight, harmony_weight, clarity_weight, risk_weight, extras_weight"),
    supabase.from("chef_fix_strategies").select("issue_key, category, title, description, expected_score_impact, priority, action_template"),
  ]);

  if (rulesResult.error) throw rulesResult.error;
  if (expectationsResult.error) throw expectationsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (fixStrategiesResult.error) throw fixStrategiesResult.error;

  const rules: ChefRuleRecord[] = (rulesResult.data ?? []).map((row) => ({
    id: String(row.id),
    ruleKey: String(row.rule_key),
    title: String(row.title),
    category: String(row.category),
    subcategory: typeof row.subcategory === "string" ? row.subcategory : null,
    layer: row.layer as ChefRuleRecord["layer"],
    triggerConditions: (row.trigger_conditions as ChefRuleRecord["triggerConditions"]) ?? {},
    exclusionConditions: (row.exclusion_conditions as ChefRuleRecord["exclusionConditions"]) ?? {},
    ruleType: row.rule_type as ChefRuleRecord["ruleType"],
    severity: row.severity as ChefRuleRecord["severity"],
    userExplanation: String(row.user_explanation ?? ""),
    failureIfMissing: typeof row.failure_if_missing === "string" ? row.failure_if_missing : null,
    actionType: (typeof row.action_type === "string" ? row.action_type : null) as ChefRuleRecord["actionType"],
    actionPayloadTemplate: row.action_payload_template && typeof row.action_payload_template === "object" ? (row.action_payload_template as Record<string, unknown>) : null,
    expectedScoreImpact: typeof row.expected_score_impact === "number" ? row.expected_score_impact : 0,
    confidence: typeof row.confidence === "number" ? row.confidence : 0.8,
    applicability: row.applicability as ChefRuleRecord["applicability"],
    priority: typeof row.priority === "number" ? row.priority : 1,
  }));

  const expectations: ChefExpectedRuleRecord[] = (expectationsResult.data ?? []).map((row) => ({
    category: String(row.recipe_category),
    key: String(row.expectation_key),
    description: String(row.description),
    bucket: row.bucket as ChefExpectedRuleRecord["bucket"],
    impact: typeof row.impact === "number" ? row.impact : 0,
  }));

  const profiles: ChefScoreProfileRecord[] = (profilesResult.data ?? []).map((row) => ({
    recipeCategory: String(row.recipe_category),
    flavorWeight: Number(row.flavor_weight),
    techniqueWeight: Number(row.technique_weight),
    textureWeight: Number(row.texture_weight),
    harmonyWeight: Number(row.harmony_weight),
    clarityWeight: Number(row.clarity_weight),
    riskWeight: Number(row.risk_weight),
    extrasWeight: Number(row.extras_weight),
  }));

  const fixStrategies: ChefFixStrategyRecord[] = (fixStrategiesResult.data ?? []).map((row) => ({
    issueKey: String(row.issue_key),
    category: row.category as ChefFixStrategyRecord["category"],
    title: String(row.title),
    description: String(row.description),
    expectedScoreImpact: typeof row.expected_score_impact === "number" ? row.expected_score_impact : 0,
    priority: typeof row.priority === "number" ? row.priority : 1,
    actions: Array.isArray(row.action_template) ? (row.action_template as ChefEditAction[]) : [],
  }));

  return { rules, expectations, profiles, fixStrategies };
}

async function main() {
  const { rules, expectations, profiles, fixStrategies } = await loadCatalog();

  assert.ok(rules.length >= 100, "Expected at least 100 chef rules in the DB.");
  assert.ok(expectations.length >= 14, "Expected chef category expectations in the DB.");
  assert.ok(profiles.length >= 1, "Expected chef score profiles in the DB.");
  assert.ok(fixStrategies.length >= 10, "Expected chef fix strategies in the DB.");

  const ruleDiff = diffKeys(
    rules.map((rule) => rule.ruleKey),
    CHEF_RULES_SEED.map((rule) => rule.ruleKey)
  );
  const expectationDiff = diffKeys(
    expectations.map((rule) => `${rule.category}:${rule.key}`),
    CHEF_EXPECTED_RULES_SEED.map((rule) => `${rule.category}:${rule.key}`)
  );
  const profileDiff = diffKeys(
    profiles.map((profile) => profile.recipeCategory),
    DEFAULT_CHEF_SCORE_PROFILES.map((profile) => profile.recipeCategory)
  );
  const fixDiff = diffKeys(
    fixStrategies.map((strategy) => strategy.issueKey),
    CHEF_FIX_STRATEGIES_SEED.map((strategy) => strategy.issueKey)
  );

  assert.deepEqual(ruleDiff, { extra: [], missing: [] }, `Chef rule drift detected: ${JSON.stringify(ruleDiff)}`);
  assert.deepEqual(expectationDiff, { extra: [], missing: [] }, `Chef expectation drift detected: ${JSON.stringify(expectationDiff)}`);
  assert.deepEqual(profileDiff, { extra: [], missing: [] }, `Chef profile drift detected: ${JSON.stringify(profileDiff)}`);
  assert.deepEqual(fixDiff, { extra: [], missing: [] }, `Chef fix drift detected: ${JSON.stringify(fixDiff)}`);

  for (const fixture of CHEF_CATALOG_FIXTURES) {
    if (!fixture.scoreRange) {
      continue;
    }
    const analysis = analyzeRecipeForChefScore({
      recipeTitle: fixture.title,
      ingredients: fixture.ingredients,
      steps: fixture.steps,
    });
    const profile = scoreProfileForCategory(profiles, analysis.recipeCategory);
    assert.ok(profile, `Missing score profile for ${analysis.recipeCategory}`);

    const score = calculateChefScore({
      recipeTitle: fixture.title,
      ingredients: fixture.ingredients,
      steps: fixture.steps,
      rules,
      expectedRules: expectations,
      profile,
    });
    const fixes = generateChefFixes({ score, strategies: fixStrategies, mode: "reliability" });

    assert.ok(
      score.totalScore >= fixture.scoreRange[0] && score.totalScore <= fixture.scoreRange[1],
      `${fixture.id} score ${score.totalScore} outside expected range ${fixture.scoreRange.join("-")}`
    );

    if (fixture.expectedTopFix) {
      assert.equal(fixes.fixes[0]?.issueKey, fixture.expectedTopFix, `${fixture.id} unexpected top fix`);
    }
    if (fixture.expectedFixesInclude?.length) {
      const fixKeys = fixes.fixes.map((fix) => fix.issueKey);
      for (const expectedFix of fixture.expectedFixesInclude) {
        assert.ok(fixKeys.includes(expectedFix), `${fixture.id} missing expected fix ${expectedFix}`);
      }
    }
    if (fixture.expectedFixesExclude?.length) {
      const fixKeys = fixes.fixes.map((fix) => fix.issueKey);
      for (const unexpectedFix of fixture.expectedFixesExclude) {
        assert.ok(!fixKeys.includes(unexpectedFix), `${fixture.id} should not include fix ${unexpectedFix}`);
      }
    }
    if (fixture.expectedRiskFlag) {
      assert.ok(score.riskFlags.some((flag) => fixture.expectedRiskFlag!.test(flag)), `${fixture.id} missing expected risk flag`);
    }
    if (fixture.expectNoConflicts) {
      assert.equal(score.conflicts.length, 0, `${fixture.id} should not produce catalog conflicts`);
    }
  }

  console.log("Chef catalog regression checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

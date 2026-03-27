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

const SUPPORTED_ACTION_TYPES: ChefEditAction["type"][] = [
  "add_step",
  "modify_step",
  "insert_doneness_cue",
  "insert_rest_time",
  "insert_storage_tip",
  "insert_make_ahead_tip",
  "add_note",
  "add_chef_insight",
  "add_checklist_item",
];

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function bucketProfileForCategory(profiles: ChefScoreProfileRecord[], category: string) {
  return profiles.find((profile) => profile.recipeCategory === category) ?? profiles.find((profile) => profile.recipeCategory === "general") ?? DEFAULT_CHEF_SCORE_PROFILES[0];
}

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}

function byKeyCount<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function diffKeys(current: string[], expected: string[]) {
  const currentSet = new Set(current);
  const expectedSet = new Set(expected);
  return {
    extra: current.filter((key) => !expectedSet.has(key)).sort(),
    missing: expected.filter((key) => !currentSet.has(key)).sort(),
  };
}

function printSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

function readinessAssessment(input: {
  ruleDiff: { extra: string[]; missing: string[] };
  expectationDiff: { extra: string[]; missing: string[] };
  profileDiff: { extra: string[]; missing: string[] };
  fixDiff: { extra: string[]; missing: string[] };
  duplicateRuleKeys: string[];
  unsupportedRuleActionTypes: string[];
  unsupportedFixActionTypes: string[];
  deadRules: string[];
  conflictCount: number;
  topMissedExpectations: Array<[string, number]>;
}) {
  const blockers: string[] = [];
  const cautions: string[] = [];

  if (input.ruleDiff.extra.length || input.ruleDiff.missing.length) blockers.push("rule drift");
  if (input.expectationDiff.extra.length || input.expectationDiff.missing.length) blockers.push("expectation drift");
  if (input.profileDiff.extra.length || input.profileDiff.missing.length) blockers.push("profile drift");
  if (input.fixDiff.extra.length || input.fixDiff.missing.length) blockers.push("fix drift");
  if (input.duplicateRuleKeys.length) blockers.push("duplicate rule keys");
  if (input.unsupportedRuleActionTypes.length) blockers.push("unsupported rule actions");
  if (input.unsupportedFixActionTypes.length) blockers.push("unsupported fix actions");
  if (input.deadRules.length > 0) blockers.push("dead rules");
  if (input.conflictCount > 0) blockers.push("rule conflicts");

  const repeatedTeachingPressure = input.topMissedExpectations.filter(([, count]) => count >= 2).map(([key]) => key);
  if (repeatedTeachingPressure.length > 0) {
    cautions.push(`repeated misses: ${repeatedTeachingPressure.join(", ")}`);
  }

  return {
    readyToStopExpanding: blockers.length === 0,
    blockers,
    cautions,
    recommendation:
      blockers.length === 0
        ? "Catalog structure is stable. Shift focus to product integration, UI presentation, and only add rules for clear new blind spots."
        : "Keep iterating on the catalog until drift, dead rules, and conflicts are eliminated.",
  };
}

async function main() {
  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [rulesResult, expectationsResult, profilesResult, fixStrategiesResult] = await Promise.all([
    supabase
      .from("chef_rules")
      .select("id, rule_key, title, category, subcategory, layer, trigger_conditions, exclusion_conditions, rule_type, severity, user_explanation, failure_if_missing, action_type, action_payload_template, expected_score_impact, confidence, applicability, priority")
      .order("priority", { ascending: false }),
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
    layer: (row.layer as ChefRuleRecord["layer"]) ?? "foundation",
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
    applicability: (row.applicability as ChefRuleRecord["applicability"]) ?? "conditional",
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

  const duplicateRuleKeys = [...byKeyCount(rules, (rule) => rule.ruleKey).entries()].filter(([, count]) => count > 1).map(([key]) => key);
  const unsupportedRuleActionTypes = dedupe(
    rules
      .map((rule) => rule.actionType)
      .filter((value): value is NonNullable<ChefRuleRecord["actionType"]> => value !== null)
      .filter((value) => !SUPPORTED_ACTION_TYPES.includes(value))
  );
  const unsupportedFixActionTypes = dedupe(
    fixStrategies.flatMap((strategy) => strategy.actions.map((action) => action.type)).filter((value) => !SUPPORTED_ACTION_TYPES.includes(value))
  );
  const expectationCategoriesWithoutProfiles = dedupe(
    expectations.map((rule) => rule.category).filter((category) => !profiles.some((profile) => profile.recipeCategory === category))
  );
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

  printSection("Catalog Integrity");
  console.log(`Rules in DB: ${rules.length}`);
  console.log(`Expected rules in DB: ${expectations.length}`);
  console.log(`Score profiles in DB: ${profiles.length}`);
  console.log(`Fix strategies in DB: ${fixStrategies.length}`);
  console.log(`Seed drift: rules ${rules.length - CHEF_RULES_SEED.length >= 0 ? "+" : ""}${rules.length - CHEF_RULES_SEED.length} vs code seed, expectations ${expectations.length - CHEF_EXPECTED_RULES_SEED.length >= 0 ? "+" : ""}${expectations.length - CHEF_EXPECTED_RULES_SEED.length} vs code seed, fixes ${fixStrategies.length - CHEF_FIX_STRATEGIES_SEED.length >= 0 ? "+" : ""}${fixStrategies.length - CHEF_FIX_STRATEGIES_SEED.length} vs code seed`);
  console.log(`Duplicate rule keys: ${duplicateRuleKeys.length ? duplicateRuleKeys.join(", ") : "none"}`);
  console.log(`Unsupported rule action types: ${unsupportedRuleActionTypes.length ? unsupportedRuleActionTypes.join(", ") : "none"}`);
  console.log(`Unsupported fix action types: ${unsupportedFixActionTypes.length ? unsupportedFixActionTypes.join(", ") : "none"}`);
  console.log(`Expectation categories without profiles: ${expectationCategoriesWithoutProfiles.length ? expectationCategoriesWithoutProfiles.join(", ") : "none"}`);
  console.log(`Extra rule keys vs seed: ${ruleDiff.extra.length ? ruleDiff.extra.join(", ") : "none"}`);
  console.log(`Missing rule keys vs seed: ${ruleDiff.missing.length ? ruleDiff.missing.join(", ") : "none"}`);
  console.log(`Extra expectations vs seed: ${expectationDiff.extra.length ? expectationDiff.extra.join(", ") : "none"}`);
  console.log(`Missing expectations vs seed: ${expectationDiff.missing.length ? expectationDiff.missing.join(", ") : "none"}`);
  console.log(`Extra profiles vs seed: ${profileDiff.extra.length ? profileDiff.extra.join(", ") : "none"}`);
  console.log(`Missing profiles vs seed: ${profileDiff.missing.length ? profileDiff.missing.join(", ") : "none"}`);
  console.log(`Extra fixes vs seed: ${fixDiff.extra.length ? fixDiff.extra.join(", ") : "none"}`);
  console.log(`Missing fixes vs seed: ${fixDiff.missing.length ? fixDiff.missing.join(", ") : "none"}`);

  const matchedRuleCounts = new Map<string, number>();
  const conflictMessages: string[] = [];
  const allMissedExpectationKeys: string[] = [];

  printSection("Fixture Results");
  for (const fixture of CHEF_CATALOG_FIXTURES) {
    const analysis = analyzeRecipeForChefScore({
      recipeTitle: fixture.title,
      ingredients: fixture.ingredients,
      steps: fixture.steps,
      tags: fixture.tags ?? [],
    });
    const profile = bucketProfileForCategory(profiles, analysis.recipeCategory);
    const score = calculateChefScore({
      recipeTitle: fixture.title,
      ingredients: fixture.ingredients,
      steps: fixture.steps,
      tags: fixture.tags ?? [],
      rules,
      expectedRules: expectations,
      profile,
    });
    const fixes = generateChefFixes({ score, strategies: fixStrategies, mode: "reliability" });

    for (const rule of score.matchedRules) {
      matchedRuleCounts.set(rule.ruleKey, (matchedRuleCounts.get(rule.ruleKey) ?? 0) + 1);
    }
    allMissedExpectationKeys.push(...score.missedExpectedRules.map((rule) => `${analysis.recipeCategory}:${rule.key}`));
    conflictMessages.push(...score.conflicts.map((conflict) => `${fixture.id}:${conflict.type}:${conflict.message}`));

    console.log(`\n[${fixture.id}] ${fixture.title}`);
    console.log(`Category: ${analysis.recipeCategory}`);
    console.log(`Score: ${score.totalScore} (${score.scoreBand})`);
    console.log(`Matched rules: ${score.matchedRules.slice(0, 8).map((rule) => rule.ruleKey).join(", ") || "none"}`);
    console.log(`Missed expectations: ${score.missedExpectedRules.map((rule) => rule.key).join(", ") || "none"}`);
    console.log(`Conflicts: ${score.conflicts.map((conflict) => conflict.message).join(" | ") || "none"}`);
    console.log(`Top fixes: ${fixes.fixes.map((fix) => `${fix.issueKey}(+${fix.estimatedImpact})`).join(", ") || "none"}`);
  }

  const deadRules = rules.filter((rule) => !matchedRuleCounts.has(rule.ruleKey)).map((rule) => rule.ruleKey);
  const topMatchedRules = [...matchedRuleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topMissedExpectations = [...byKeyCount(allMissedExpectationKeys, (item) => item).entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const layerCoverage = [...byKeyCount(rules.filter((rule) => matchedRuleCounts.has(rule.ruleKey)), (rule) => rule.layer).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const readiness = readinessAssessment({
    ruleDiff,
    expectationDiff,
    profileDiff,
    fixDiff,
    duplicateRuleKeys,
    unsupportedRuleActionTypes,
    unsupportedFixActionTypes,
    deadRules,
    conflictCount: conflictMessages.length,
    topMissedExpectations,
  });

  printSection("Coverage Summary");
  console.log(`Rules never matched by fixture set: ${deadRules.length}`);
  console.log(deadRules.slice(0, 30).join(", ") || "none");
  console.log(`Layer coverage: ${layerCoverage.map(([layer, count]) => `${layer}(${count})`).join(", ") || "none"}`);
  console.log(`Top matched rules: ${topMatchedRules.map(([key, count]) => `${key}(${count})`).join(", ") || "none"}`);
  console.log(`Top missed expectations: ${topMissedExpectations.map(([key, count]) => `${key}(${count})`).join(", ") || "none"}`);
  console.log(`Conflict count: ${conflictMessages.length}`);
  if (conflictMessages.length > 0) {
    console.log(conflictMessages.join("\n"));
  }

  printSection("Offramp");
  console.log(`Ready to stop expanding: ${readiness.readyToStopExpanding ? "yes" : "no"}`);
  console.log(`Blockers: ${readiness.blockers.length ? readiness.blockers.join(", ") : "none"}`);
  console.log(`Cautions: ${readiness.cautions.length ? readiness.cautions.join(" | ") : "none"}`);
  console.log(`Recommendation: ${readiness.recommendation}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

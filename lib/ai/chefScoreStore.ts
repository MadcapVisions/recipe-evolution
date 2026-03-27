import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CHEF_EXPECTED_RULES_SEED,
  CHEF_FIX_STRATEGIES_SEED,
  CHEF_RULES_SEED,
  DEFAULT_CHEF_SCORE_PROFILES,
  type ChefExpectedRuleRecord,
  type ChefRuleRecord,
  type ChefScoreProfileRecord,
} from "./chefCatalog";
import { analyzeRecipeForChefScore, applyChefFixActions, calculateChefScore, compareChefScores, generateChefFixes, type ChefScoreResult } from "./chefScoring";

type OwnedVersionRecord = {
  recipeId: string;
  recipeVersionId: string;
  recipeTitle: string;
  dishFamily: string | null;
  ingredients: string[];
  steps: string[];
  notes: string | null;
  servings: number | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  difficulty: string | null;
  ownerId: string;
};

function safeJson(value: unknown) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

export async function getOwnedRecipeVersion(
  supabase: SupabaseClient,
  ownerId: string,
  recipeVersionId: string
): Promise<OwnedVersionRecord | null> {
  const { data: version, error: versionError } = await supabase
    .from("recipe_versions")
    .select("id, recipe_id, ingredients_json, steps_json, notes, servings, prep_time_min, cook_time_min, difficulty")
    .eq("id", recipeVersionId)
    .maybeSingle();

  if (versionError || !version) {
    return null;
  }

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, owner_id, title, dish_family")
    .eq("id", version.recipe_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (recipeError || !recipe) {
    return null;
  }

  const ingredients = Array.isArray(version.ingredients_json)
    ? version.ingredients_json
        .map((item) =>
          typeof (item as { name?: unknown })?.name === "string" ? ((item as { name: string }).name ?? "") : ""
        )
        .filter(Boolean)
    : [];
  const steps = Array.isArray(version.steps_json)
    ? version.steps_json
        .map((item) =>
          typeof (item as { text?: unknown })?.text === "string" ? ((item as { text: string }).text ?? "") : ""
        )
        .filter(Boolean)
    : [];

  return {
    recipeId: version.recipe_id as string,
    recipeVersionId,
    recipeTitle: recipe.title as string,
    dishFamily: (recipe.dish_family as string | null | undefined) ?? null,
    ingredients,
    steps,
    notes: typeof version.notes === "string" ? version.notes : null,
    servings: typeof version.servings === "number" ? version.servings : null,
    prepTimeMin: typeof version.prep_time_min === "number" ? version.prep_time_min : null,
    cookTimeMin: typeof version.cook_time_min === "number" ? version.cook_time_min : null,
    difficulty: typeof version.difficulty === "string" ? version.difficulty : null,
    ownerId,
  };
}

export async function loadChefRules(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("chef_rules")
    .select("id, rule_key, title, category, subcategory, layer, trigger_conditions, exclusion_conditions, rule_type, severity, user_explanation, failure_if_missing, action_type, action_payload_template, expected_score_impact, confidence, applicability, priority")
    .order("priority", { ascending: false });

  if (error || !data || data.length === 0) {
    return CHEF_RULES_SEED;
  }

  return data.map((row) => ({
    id: row.id as string,
    ruleKey: typeof row.rule_key === "string" ? row.rule_key : String(row.id),
    title: row.title as string,
    category: row.category as string,
    subcategory: typeof row.subcategory === "string" ? row.subcategory : null,
    layer:
      row.layer === "foundation" ||
      row.layer === "technique" ||
      row.layer === "ingredient" ||
      row.layer === "dish" ||
      row.layer === "risk" ||
      row.layer === "upgrade"
        ? row.layer
        : "foundation",
    triggerConditions: (row.trigger_conditions as Record<string, boolean | string | string[]>) ?? {},
    exclusionConditions: (row.exclusion_conditions as Record<string, boolean | string | string[]>) ?? {},
    ruleType: row.rule_type as "mandatory" | "recommended" | "warning",
    severity:
      row.severity === "low" ||
      row.severity === "medium" ||
      row.severity === "high" ||
      row.severity === "critical"
        ? row.severity
        : "medium",
    userExplanation:
      typeof row.user_explanation === "string" && row.user_explanation.trim().length > 0
        ? row.user_explanation
        : "",
    failureIfMissing: typeof row.failure_if_missing === "string" ? row.failure_if_missing : null,
    actionType: typeof row.action_type === "string" ? (row.action_type as ChefRuleRecord["actionType"]) : null,
    actionPayloadTemplate:
      row.action_payload_template && typeof row.action_payload_template === "object"
        ? (row.action_payload_template as Record<string, unknown>)
        : null,
    expectedScoreImpact: typeof row.expected_score_impact === "number" ? row.expected_score_impact : 0,
    confidence: typeof row.confidence === "number" ? row.confidence : 0.8,
    applicability:
      row.applicability === "broad" || row.applicability === "conditional" || row.applicability === "niche"
        ? row.applicability
        : "conditional",
    priority: typeof row.priority === "number" ? row.priority : 1,
  }));
}

export async function loadChefExpectedRules(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("chef_category_expectations")
    .select("recipe_category, expectation_key, description, bucket, impact")
    .order("recipe_category", { ascending: true });

  if (error || !data || data.length === 0) {
    return CHEF_EXPECTED_RULES_SEED;
  }

  return data.map((row) => ({
    category: row.recipe_category as string,
    key: row.expectation_key as string,
    description: row.description as string,
    bucket: row.bucket as ChefExpectedRuleRecord["bucket"],
    impact: typeof row.impact === "number" ? row.impact : 0,
  }));
}

export async function loadChefScoreProfiles(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("chef_score_profiles")
    .select("recipe_category, flavor_weight, technique_weight, texture_weight, harmony_weight, clarity_weight, risk_weight, extras_weight");

  if (error || !data || data.length === 0) {
    return DEFAULT_CHEF_SCORE_PROFILES;
  }

  return data.map((row) => ({
    recipeCategory: row.recipe_category as string,
    flavorWeight: typeof row.flavor_weight === "number" ? row.flavor_weight : 20,
    techniqueWeight: typeof row.technique_weight === "number" ? row.technique_weight : 20,
    textureWeight: typeof row.texture_weight === "number" ? row.texture_weight : 15,
    harmonyWeight: typeof row.harmony_weight === "number" ? row.harmony_weight : 15,
    clarityWeight: typeof row.clarity_weight === "number" ? row.clarity_weight : 10,
    riskWeight: typeof row.risk_weight === "number" ? row.risk_weight : 10,
    extrasWeight: typeof row.extras_weight === "number" ? row.extras_weight : 10,
  }));
}

export async function loadChefFixStrategies(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("chef_fix_strategies")
    .select("issue_key, category, title, description, expected_score_impact, priority, action_template");

  if (error || !data || data.length === 0) {
    return CHEF_FIX_STRATEGIES_SEED;
  }

  return data.map((row) => ({
    issueKey: row.issue_key as string,
    category: row.category as "reliability" | "quality" | "teaching",
    title: row.title as string,
    description: row.description as string,
    expectedScoreImpact: typeof row.expected_score_impact === "number" ? row.expected_score_impact : 0,
    priority: typeof row.priority === "number" ? row.priority : 1,
    actions: Array.isArray(row.action_template) ? (row.action_template as typeof CHEF_FIX_STRATEGIES_SEED[number]["actions"]) : [],
  }));
}

export async function persistChefScore(
  supabase: SupabaseClient,
  ownerId: string,
  recipeVersionId: string,
  score: ChefScoreResult
) {
  await supabase.from("recipe_analysis").upsert(
    {
      recipe_version_id: recipeVersionId,
      recipe_id: score.analysis.recipeId,
      owner_id: ownerId,
      analysis_json: safeJson(score.analysis),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "recipe_version_id" }
  );

  await supabase.from("recipe_scores").upsert(
    {
      recipe_version_id: recipeVersionId,
      owner_id: ownerId,
      total_score: score.totalScore,
      flavor_score: score.subscores.flavor,
      technique_score: score.subscores.technique,
      texture_score: score.subscores.texture,
      harmony_score: score.subscores.harmony,
      clarity_score: score.subscores.clarity,
      risk_score: score.subscores.risk,
      extras_score: score.subscores.extras,
      score_band: score.scoreBand,
      summary: score.summary,
      improvement_priorities: safeJson(score.improvementPriorities) ?? [],
      risk_flags: safeJson(score.riskFlags) ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "recipe_version_id" }
  );

  await supabase.from("recipe_score_factors").delete().eq("recipe_version_id", recipeVersionId).eq("owner_id", ownerId);
  if (score.factors.length > 0) {
    await supabase.from("recipe_score_factors").insert(
      score.factors.map((factor) => ({
        recipe_version_id: recipeVersionId,
        owner_id: ownerId,
        factor_type: factor.factorType,
        factor_key: factor.factorKey,
        impact: factor.impact,
        explanation: factor.explanation,
        bucket: factor.bucket,
      }))
    );
  }
}

export async function calculateAndPersistChefScore(
  supabase: SupabaseClient,
  ownerId: string,
  recipeVersionId: string
) {
  const version = await getOwnedRecipeVersion(supabase, ownerId, recipeVersionId);
  if (!version) {
    return null;
  }
  const [rules, expectedRules, profiles] = await Promise.all([
    loadChefRules(supabase),
    loadChefExpectedRules(supabase),
    loadChefScoreProfiles(supabase),
  ]);
  const analysis = analyzeRecipeForChefScore({
    recipeTitle: version.recipeTitle,
    ingredients: version.ingredients,
    steps: version.steps,
    recipeVersionId,
    recipeId: version.recipeId,
    tags: version.dishFamily ? [version.dishFamily] : [],
  });
  const profile =
    profiles.find((entry) => entry.recipeCategory === analysis.recipeCategory) ??
    profiles.find((entry) => entry.recipeCategory === "general") ??
    DEFAULT_CHEF_SCORE_PROFILES[0];
  const score = calculateChefScore({
    recipeTitle: version.recipeTitle,
    ingredients: version.ingredients,
    steps: version.steps,
    recipeVersionId,
    recipeId: version.recipeId,
    tags: version.dishFamily ? [version.dishFamily] : [],
    rules,
    expectedRules,
    profile,
  });
  await persistChefScore(supabase, ownerId, recipeVersionId, score);
  return { version, score };
}

export async function compareChefScoresForVersions(
  supabase: SupabaseClient,
  ownerId: string,
  baseVersionId: string,
  candidateVersionId: string
) {
  const [base, candidate] = await Promise.all([
    calculateAndPersistChefScore(supabase, ownerId, baseVersionId),
    calculateAndPersistChefScore(supabase, ownerId, candidateVersionId),
  ]);
  if (!base || !candidate) {
    return null;
  }
  return compareChefScores(base.score, candidate.score);
}

export async function generateAndPersistChefFixes(
  supabase: SupabaseClient,
  ownerId: string,
  recipeVersionId: string,
  mode?: "reliability" | "flavor" | "expert"
) {
  const scored = await calculateAndPersistChefScore(supabase, ownerId, recipeVersionId);
  if (!scored) {
    return null;
  }
  const strategies = await loadChefFixStrategies(supabase);
  const fixes = generateChefFixes({ score: scored.score, mode, strategies });
  return { ...scored, fixes };
}

export { applyChefFixActions };

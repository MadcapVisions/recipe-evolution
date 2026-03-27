import {
  CHEF_EXPECTED_RULES_SEED,
  CHEF_FIX_STRATEGIES_SEED,
  CHEF_RULES_SEED,
  DEFAULT_CHEF_SCORE_PROFILES,
} from "../lib/ai/chefCatalog";

function sqlString(value: string | null) {
  if (value == null) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function sqlTuple(values: string[]) {
  return `(${values.join(", ")})`;
}

function printChefRules() {
  const values = CHEF_RULES_SEED.map((rule) => {
    return sqlTuple([
      sqlString(rule.id),
      sqlString(rule.ruleKey),
      sqlString(rule.title),
      sqlString(rule.category),
      sqlString(rule.subcategory),
      sqlString(rule.layer),
      sqlJson(rule.triggerConditions),
      sqlJson(rule.exclusionConditions),
      sqlString(rule.ruleType),
      sqlString(rule.severity),
      sqlString(rule.userExplanation),
      sqlString(rule.failureIfMissing),
      sqlString(rule.actionType),
      rule.actionPayloadTemplate ? sqlJson(rule.actionPayloadTemplate) : "NULL",
      String(rule.expectedScoreImpact),
      String(rule.confidence),
      sqlString(rule.applicability),
      String(rule.priority),
    ]);
  }).join(",\n");

  const allowedRuleKeys = CHEF_RULES_SEED.map((rule) => sqlString(rule.ruleKey)).join(", ");

  return `delete from public.chef_rules
where rule_key not in (${allowedRuleKeys});

insert into public.chef_rules (
  id,
  rule_key,
  title,
  category,
  subcategory,
  layer,
  trigger_conditions,
  exclusion_conditions,
  rule_type,
  severity,
  user_explanation,
  failure_if_missing,
  action_type,
  action_payload_template,
  expected_score_impact,
  confidence,
  applicability,
  priority
) values
${values}
on conflict (rule_key) do update set
  title = excluded.title,
  category = excluded.category,
  subcategory = excluded.subcategory,
  layer = excluded.layer,
  trigger_conditions = excluded.trigger_conditions,
  exclusion_conditions = excluded.exclusion_conditions,
  rule_type = excluded.rule_type,
  severity = excluded.severity,
  user_explanation = excluded.user_explanation,
  failure_if_missing = excluded.failure_if_missing,
  action_type = excluded.action_type,
  action_payload_template = excluded.action_payload_template,
  expected_score_impact = excluded.expected_score_impact,
  confidence = excluded.confidence,
  applicability = excluded.applicability,
  priority = excluded.priority;`;
}

function printExpectations() {
  const values = CHEF_EXPECTED_RULES_SEED.map((rule) => {
    return sqlTuple([
      sqlString(rule.category),
      sqlString(rule.key),
      sqlString(rule.description),
      sqlString(rule.bucket),
      String(rule.impact),
    ]);
  }).join(",\n");

  const allowedExpectationKeys = CHEF_EXPECTED_RULES_SEED.map((rule) => sqlTuple([rule.category, rule.key])).join(", ");

  return `delete from public.chef_category_expectations
where (recipe_category, expectation_key) not in (${allowedExpectationKeys});

insert into public.chef_category_expectations (
  recipe_category,
  expectation_key,
  description,
  bucket,
  impact
) values
${values}
on conflict (recipe_category, expectation_key) do update set
  description = excluded.description,
  bucket = excluded.bucket,
  impact = excluded.impact;`;
}

function printProfiles() {
  const values = DEFAULT_CHEF_SCORE_PROFILES.map((profile) => {
    return sqlTuple([
      sqlString(profile.recipeCategory),
      String(profile.flavorWeight),
      String(profile.techniqueWeight),
      String(profile.textureWeight),
      String(profile.harmonyWeight),
      String(profile.clarityWeight),
      String(profile.riskWeight),
      String(profile.extrasWeight),
    ]);
  }).join(",\n");

  const allowedProfileCategories = DEFAULT_CHEF_SCORE_PROFILES.map((profile) => sqlString(profile.recipeCategory)).join(", ");

  return `delete from public.chef_score_profiles
where recipe_category not in (${allowedProfileCategories});

insert into public.chef_score_profiles (
  recipe_category,
  flavor_weight,
  technique_weight,
  texture_weight,
  harmony_weight,
  clarity_weight,
  risk_weight,
  extras_weight
) values
${values}
on conflict (recipe_category) do update set
  flavor_weight = excluded.flavor_weight,
  technique_weight = excluded.technique_weight,
  texture_weight = excluded.texture_weight,
  harmony_weight = excluded.harmony_weight,
  clarity_weight = excluded.clarity_weight,
  risk_weight = excluded.risk_weight,
  extras_weight = excluded.extras_weight;`;
}

function printFixStrategies() {
  const values = CHEF_FIX_STRATEGIES_SEED.map((strategy) => {
    const primaryAction = strategy.actions[0]?.type ?? "add_note";
    return sqlTuple([
      sqlString(strategy.issueKey),
      sqlString(strategy.category),
      sqlString(strategy.title),
      sqlString(strategy.description),
      sqlString(primaryAction),
      sqlJson(strategy.actions),
      String(strategy.expectedScoreImpact),
      String(strategy.priority),
    ]);
  }).join(",\n");

  const allowedIssueKeys = CHEF_FIX_STRATEGIES_SEED.map((strategy) => sqlString(strategy.issueKey)).join(", ");

  return `delete from public.chef_fix_strategies
where issue_key not in (${allowedIssueKeys});

insert into public.chef_fix_strategies (
  issue_key,
  category,
  title,
  description,
  fix_action_type,
  action_template,
  expected_score_impact,
  priority
) values
${values}
on conflict (issue_key) do update set
  category = excluded.category,
  title = excluded.title,
  description = excluded.description,
  fix_action_type = excluded.fix_action_type,
  action_template = excluded.action_template,
  expected_score_impact = excluded.expected_score_impact,
  priority = excluded.priority;`;
}

process.stdout.write(`${printChefRules()}\n\n${printExpectations()}\n\n${printProfiles()}\n\n${printFixStrategies()}\n`);

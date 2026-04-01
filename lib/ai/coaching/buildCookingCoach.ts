import type { CulinaryBlueprint } from "../blueprint/blueprintTypes";
import type { IngredientRole } from "../blueprint/blueprintTypes";
import type { MethodPlan } from "../method/planMethod";
import type { ResolvedCookingIntent } from "../intent/intentTypes";
import type { RecipeDraft } from "../../recipes/recipeDraft";
import type {
  CookingCoach,
  ChefSecret,
  WatchFor,
  MistakePrevention,
  RecoveryMove,
  StepLinkage,
} from "./coachTypes";
import type { CoachRule, CoachRuleContext } from "./chefRules";
import { evaluateCoachRules, resolveRuleText } from "./chefRules";
import { getFamilyCoachRules } from "./familyCoachingRules";
import { getRecoveryMoves } from "./rescueRecoveryMap";
import type { RescueScenario } from "./rescueScenarios";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a CookingCoach from structured inputs.
 *
 * Rule-based and deterministic — same inputs produce the same output.
 * No LLM call. Authority: see docs/decisions/m3-authority-boundaries.md
 */
export function buildCookingCoach(
  intent: ResolvedCookingIntent,
  blueprint: CulinaryBlueprint,
  recipe: RecipeDraft,
  methodPlan: MethodPlan
): CookingCoach {
  const ctx = buildRuleContext(blueprint);
  const rules = getFamilyCoachRules(blueprint.dishFamily);
  const applicable = evaluateCoachRules(rules, ctx);

  const chefSecrets = assembleChefSecrets(applicable, ctx, recipe, 2);
  const watchFors = assembleWatchFors(applicable, ctx, recipe, 4);
  const mistakePreviews = assembleMistakePreviews(applicable, ctx, 3);
  const recoveryMoves = assembleRecoveryMoves(blueprint, recipe);

  return {
    chefSecrets,
    watchFors,
    mistakePreviews,
    recoveryMoves,
    generatedFrom: intent.requestId,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Rule context builder
// ---------------------------------------------------------------------------

function buildRuleContext(blueprint: CulinaryBlueprint): CoachRuleContext {
  const ingredientRoles: IngredientRole[] = [];
  for (const component of blueprint.components) {
    for (const ing of component.ingredients) {
      if (!ingredientRoles.includes(ing.role)) {
        ingredientRoles.push(ing.role);
      }
    }
  }
  return {
    family: blueprint.dishFamily,
    primaryMethod: blueprint.primaryMethod,
    richnessLevel: blueprint.richnessLevel,
    ingredientRoles,
  };
}

// ---------------------------------------------------------------------------
// Assembly helpers
// ---------------------------------------------------------------------------

function resolveStepLinkage(
  rule: CoachRule,
  recipe: RecipeDraft
): StepLinkage | undefined {
  if (rule.stepHint === undefined) return undefined;
  const steps = recipe.steps;
  if (!steps || steps.length === 0) return undefined;
  if (rule.stepHint === "first") {
    return { stepIndex: 0, stepText: steps[0]?.text };
  }
  if (rule.stepHint === "last") {
    const last = steps.length - 1;
    return { stepIndex: last, stepText: steps[last]?.text };
  }
  if (typeof rule.stepHint === "number" && rule.stepHint < steps.length) {
    return { stepIndex: rule.stepHint, stepText: steps[rule.stepHint]?.text };
  }
  return undefined;
}

function assembleChefSecrets(
  rules: CoachRule[],
  ctx: CoachRuleContext,
  recipe: RecipeDraft,
  max: number
): ChefSecret[] {
  return rules
    .filter((r) => r.outputType === "chef_secret")
    .slice(0, max)
    .map((r) => ({
      text: resolveRuleText(r, ctx),
      rationale: r.rationale,
      stepLinkage: resolveStepLinkage(r, recipe),
    }));
}

function assembleWatchFors(
  rules: CoachRule[],
  ctx: CoachRuleContext,
  recipe: RecipeDraft,
  max: number
): WatchFor[] {
  return rules
    .filter((r) => r.outputType === "watch_for")
    .slice(0, max)
    .map((r) => ({
      cue: resolveRuleText(r, ctx),
      importance: deriveImportance(r.priority),
      stepLinkage: resolveStepLinkage(r, recipe),
    }));
}

function assembleMistakePreviews(
  rules: CoachRule[],
  ctx: CoachRuleContext,
  max: number
): MistakePrevention[] {
  return rules
    .filter((r) => r.outputType === "mistake_prevention")
    .slice(0, max)
    .map((r) => {
      // text is the mistake description; rationale is the prevention rationale
      return {
        mistake: resolveRuleText(r, ctx),
        prevention: r.rationale,
        importance: deriveImportance(r.priority),
      };
    });
}

function deriveImportance(priority: number): "critical" | "important" | "nice_to_know" {
  if (priority >= 9) return "critical";
  if (priority >= 6) return "important";
  return "nice_to_know";
}

// ---------------------------------------------------------------------------
// Recovery move assembly (Task 9 — integrated from rescueRecoveryMap)
// ---------------------------------------------------------------------------

/** Scenarios to check based on what the recipe/blueprint contains */
function inferLikelyScenarios(
  blueprint: CulinaryBlueprint,
  _recipe: RecipeDraft
): RescueScenario[] {
  const scenarios: RescueScenario[] = [];
  const family = blueprint.dishFamily;
  const hasProtein = blueprint.components.some((c) =>
    c.ingredients.some((i) => i.role === "protein")
  );
  const hasSauce = blueprint.components.some(
    (c) => c.purpose === "sauce"
  );

  // Universal scenarios for all recipes
  scenarios.push("underseasoned");
  scenarios.push("too_salty");

  // Protein-bearing dishes
  if (hasProtein) {
    scenarios.push("dry_protein");
  }

  // Sauce-bearing dishes
  if (hasSauce) {
    scenarios.push("broken_sauce");
    scenarios.push("too_thin");
    scenarios.push("too_thick");
  }

  // Family-specific scenarios
  if (family === "soups_stews") {
    scenarios.push("too_wet_watery");
    if (!scenarios.includes("too_thin")) scenarios.push("too_thin");
    if (!scenarios.includes("too_thick")) scenarios.push("too_thick");
  }
  if (family === "pasta") {
    if (!scenarios.includes("too_thin")) scenarios.push("too_thin");
    if (!scenarios.includes("too_thick")) scenarios.push("too_thick");
  }
  if (family === "skillet_saute" || family === "chicken_dinners") {
    scenarios.push("texture_not_crisping");
    scenarios.push("overbrowned_aromatics");
  }
  if (family === "sheet_pan" || family === "roasted_vegetables") {
    scenarios.push("texture_not_crisping");
    scenarios.push("too_wet_watery");
  }
  if (family === "baked_casseroles") {
    scenarios.push("dough_batter_too_wet");
    scenarios.push("dough_batter_too_dry");
  }

  // Deduplicate while preserving order
  return Array.from(new Set(scenarios));
}

function assembleRecoveryMoves(
  blueprint: CulinaryBlueprint,
  recipe: RecipeDraft
): RecoveryMove[] {
  const scenarios = inferLikelyScenarios(blueprint, recipe);
  const moves: RecoveryMove[] = [];

  for (const scenario of scenarios.slice(0, 3)) {
    const entries = getRecoveryMoves(scenario, blueprint.dishFamily);
    if (entries.length > 0) {
      const best = entries[0];
      moves.push({
        scenario,
        move: best.move,
        familyAware: !!(best.families && best.families.length > 0),
      });
    }
  }

  return moves;
}

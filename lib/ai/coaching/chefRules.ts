import type { IngredientRole } from "../blueprint/blueprintTypes";
import type { CoachRuleOutputType } from "./coachRuleTypes";

export type { CoachRuleOutputType };

// ---------------------------------------------------------------------------
// Rule categories
// ---------------------------------------------------------------------------

export type CoachRuleCategory =
  | "universal"
  | "family_specific"
  | "dish_pattern"
  | "mistake_prevention"
  | "recovery"
  | "finish"
  | "watch_for";

// ---------------------------------------------------------------------------
// Applicability — rules can be scoped to families, methods, or ingredient roles
// ---------------------------------------------------------------------------

export type CoachRuleApplicability = {
  /** If provided, rule only applies when blueprint.dishFamily is in this list */
  families?: string[];
  /** If provided, rule only applies when blueprint.primaryMethod contains one of these */
  methods?: string[];
  /** If provided, rule only applies when recipe has an ingredient with one of these roles */
  roles?: IngredientRole[];
};

// ---------------------------------------------------------------------------
// Rule context — derived from inputs at evaluation time
// ---------------------------------------------------------------------------

export type CoachRuleContext = {
  family: string;
  primaryMethod: string;
  richnessLevel: string;
  /** Flat list of ingredient roles present in the recipe */
  ingredientRoles: IngredientRole[];
};

// ---------------------------------------------------------------------------
// Coach rule
// ---------------------------------------------------------------------------

export type CoachRule = {
  id: string;
  category: CoachRuleCategory;
  outputType: CoachRuleOutputType;
  applicability: CoachRuleApplicability;
  rationale: string;
  priority: number;
  /**
   * The coaching text. A string literal or a function that receives the
   * context and returns a string (for rules that need to reference family/method).
   */
  text: string | ((ctx: CoachRuleContext) => string);
  /** Optional zero-based step hint — a downstream assembler may use this for step linkage */
  stepHint?: "first" | "last" | number;
};

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

/**
 * Filter a rule set to those applicable for the given context.
 * Returns rules sorted by priority descending (highest first).
 */
export function evaluateCoachRules(
  rules: CoachRule[],
  ctx: CoachRuleContext
): CoachRule[] {
  return rules
    .filter((rule) => isApplicable(rule.applicability, ctx))
    .sort((a, b) => b.priority - a.priority);
}

function isApplicable(
  applicability: CoachRuleApplicability,
  ctx: CoachRuleContext
): boolean {
  if (
    applicability.families &&
    applicability.families.length > 0 &&
    !applicability.families.includes(ctx.family)
  ) {
    return false;
  }
  if (applicability.methods && applicability.methods.length > 0) {
    const methodLower = ctx.primaryMethod.toLowerCase();
    const matched = applicability.methods.some((m) =>
      methodLower.includes(m.toLowerCase())
    );
    if (!matched) return false;
  }
  if (applicability.roles && applicability.roles.length > 0) {
    const hasRole = applicability.roles.some((r) =>
      ctx.ingredientRoles.includes(r)
    );
    if (!hasRole) return false;
  }
  return true;
}

/**
 * Resolve a rule's text — handles both string and function forms.
 */
export function resolveRuleText(rule: CoachRule, ctx: CoachRuleContext): string {
  return typeof rule.text === "function" ? rule.text(ctx) : rule.text;
}

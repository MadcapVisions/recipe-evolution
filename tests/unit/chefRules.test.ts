import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCoachRules, resolveRuleText } from "../../lib/ai/coaching/chefRules";
import type { CoachRule, CoachRuleContext } from "../../lib/ai/coaching/chefRules";

function makeCtx(overrides: Partial<CoachRuleContext> = {}): CoachRuleContext {
  return {
    family: "skillet_saute",
    primaryMethod: "sear",
    richnessLevel: "moderate",
    ingredientRoles: ["protein", "aromatic", "fat"],
    ...overrides,
  };
}

const RULE_A: CoachRule = {
  id: "universal-dry-protein",
  category: "universal",
  outputType: "chef_secret",
  applicability: { roles: ["protein"] },
  rationale: "Moisture prevents searing",
  priority: 10,
  text: "Pat protein completely dry before applying heat",
};

const RULE_B: CoachRule = {
  id: "pasta-salt-water",
  category: "family_specific",
  outputType: "watch_for",
  applicability: { families: ["pasta"] },
  rationale: "Pasta water salinity affects final seasoning",
  priority: 8,
  text: "Water should taste as salty as the sea",
};

const RULE_C: CoachRule = {
  id: "sear-smoke-watch",
  category: "watch_for",
  outputType: "watch_for",
  applicability: { methods: ["sear"] },
  rationale: "Pan temp signal",
  priority: 9,
  text: (ctx) => `For ${ctx.family}: pan should shimmer but not smoke`,
};

test("evaluateCoachRules returns only applicable rules", () => {
  const ctx = makeCtx();
  const results = evaluateCoachRules([RULE_A, RULE_B, RULE_C], ctx);
  // RULE_A applies (has protein role), RULE_B does not (pasta family only), RULE_C applies (sear method)
  assert.equal(results.length, 2);
  assert.ok(results.some((r) => r.id === "universal-dry-protein"));
  assert.ok(results.some((r) => r.id === "sear-smoke-watch"));
  assert.ok(!results.some((r) => r.id === "pasta-salt-water"));
});

test("evaluateCoachRules returns rules sorted by priority descending", () => {
  const ctx = makeCtx();
  const results = evaluateCoachRules([RULE_A, RULE_C], ctx);
  assert.ok(results[0].priority >= results[1].priority);
});

test("evaluateCoachRules applies family filter correctly", () => {
  const ctx = makeCtx({ family: "pasta" });
  const results = evaluateCoachRules([RULE_A, RULE_B, RULE_C], ctx);
  // RULE_B applies (pasta family), RULE_A applies (has protein role), RULE_C doesn't (no sear method)
  assert.ok(results.some((r) => r.id === "pasta-salt-water"));
  assert.ok(results.some((r) => r.id === "universal-dry-protein"));
});

test("evaluateCoachRules applies method filter correctly", () => {
  const ctx = makeCtx({ primaryMethod: "bake", family: "baked_casseroles" });
  const results = evaluateCoachRules([RULE_A, RULE_B, RULE_C], ctx);
  // RULE_C requires sear method — should not appear
  assert.ok(!results.some((r) => r.id === "sear-smoke-watch"));
});

test("evaluateCoachRules returns empty when no rules match", () => {
  const ctx = makeCtx({ family: "pasta", ingredientRoles: [], primaryMethod: "boil" });
  const results = evaluateCoachRules([RULE_B], ctx);
  assert.equal(results.length, 1); // RULE_B applies by family
  const results2 = evaluateCoachRules([RULE_A], makeCtx({ ingredientRoles: [] }));
  assert.equal(results2.length, 0); // RULE_A needs protein role
});

test("resolveRuleText returns string literal directly", () => {
  const ctx = makeCtx();
  assert.equal(resolveRuleText(RULE_A, ctx), "Pat protein completely dry before applying heat");
});

test("resolveRuleText calls function with context", () => {
  const ctx = makeCtx({ family: "skillet_saute" });
  const text = resolveRuleText(RULE_C, ctx);
  assert.ok(text.includes("skillet_saute"));
  assert.ok(text.includes("shimmer"));
});

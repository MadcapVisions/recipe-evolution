import test from "node:test";
import assert from "node:assert/strict";
import {
  getFamilyCoachRules,
  UNIVERSAL_COACH_RULES,
  LAUNCH_COACHING_FAMILY_KEYS,
} from "../../lib/ai/coaching/familyCoachingRules";

const ALL_LAUNCH_FAMILIES = [
  "skillet_saute",
  "pasta",
  "soups_stews",
  "sheet_pan",
  "chicken_dinners",
  "rice_grain_bowls",
  "roasted_vegetables",
  "baked_casseroles",
] as const;

test("LAUNCH_COACHING_FAMILY_KEYS contains all 8 launch families", () => {
  assert.equal(LAUNCH_COACHING_FAMILY_KEYS.length, 8);
  for (const family of ALL_LAUNCH_FAMILIES) {
    assert.ok(LAUNCH_COACHING_FAMILY_KEYS.includes(family), `Missing family: ${family}`);
  }
});

test("UNIVERSAL_COACH_RULES are non-empty", () => {
  assert.ok(UNIVERSAL_COACH_RULES.length > 0);
});

test("getFamilyCoachRules returns non-empty set for all launch families", () => {
  for (const family of ALL_LAUNCH_FAMILIES) {
    const rules = getFamilyCoachRules(family);
    assert.ok(rules.length > 0, `No rules for family: ${family}`);
  }
});

test("getFamilyCoachRules returns at least one chef_secret per launch family", () => {
  for (const family of ALL_LAUNCH_FAMILIES) {
    const rules = getFamilyCoachRules(family);
    const secrets = rules.filter((r) => r.outputType === "chef_secret");
    assert.ok(secrets.length >= 1, `No chef_secret rule for family: ${family}`);
  }
});

test("getFamilyCoachRules returns at least one watch_for per launch family", () => {
  for (const family of ALL_LAUNCH_FAMILIES) {
    const rules = getFamilyCoachRules(family);
    const watchFors = rules.filter((r) => r.outputType === "watch_for");
    assert.ok(watchFors.length >= 1, `No watch_for rule for family: ${family}`);
  }
});

test("getFamilyCoachRules returns at least one mistake_prevention per launch family", () => {
  for (const family of ALL_LAUNCH_FAMILIES) {
    const rules = getFamilyCoachRules(family);
    const mistakes = rules.filter((r) => r.outputType === "mistake_prevention");
    assert.ok(mistakes.length >= 1, `No mistake_prevention rule for family: ${family}`);
  }
});

test("getFamilyCoachRules falls back to universal rules for unknown family", () => {
  const rules = getFamilyCoachRules("mystery_dish_family");
  assert.ok(rules.length > 0, "should return universal rules as fallback");
  // All returned rules should be from UNIVERSAL_COACH_RULES (family applicability is empty)
  for (const rule of rules) {
    if (rule.applicability.families) {
      assert.ok(false, `Got family-specific rule for unknown family: ${rule.id}`);
    }
  }
});

test("getFamilyCoachRules includes universal rules for each launch family", () => {
  const universalIds = new Set(UNIVERSAL_COACH_RULES.map((r) => r.id));
  for (const family of ALL_LAUNCH_FAMILIES) {
    const rules = getFamilyCoachRules(family);
    const ruleIds = new Set(rules.map((r) => r.id));
    for (const uid of universalIds) {
      assert.ok(ruleIds.has(uid), `Missing universal rule ${uid} for family ${family}`);
    }
  }
});

test("all rules have non-empty id, text, rationale", () => {
  for (const family of ALL_LAUNCH_FAMILIES) {
    const rules = getFamilyCoachRules(family);
    for (const rule of rules) {
      assert.ok(rule.id.length > 0, "empty id");
      assert.ok(rule.rationale.length > 0, `empty rationale on ${rule.id}`);
      const text = typeof rule.text === "string" ? rule.text : rule.text({ family, primaryMethod: "test", richnessLevel: "moderate", ingredientRoles: [] });
      assert.ok(text.length > 0, `empty text on ${rule.id}`);
    }
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  getFamilyBlueprintRule,
  LAUNCH_FAMILY_KEYS,
  FALLBACK_BLUEPRINT_RULE,
} from "../../lib/ai/blueprint/familyBlueprintRules";

test("all 8 launch families have blueprint rules", () => {
  for (const family of LAUNCH_FAMILY_KEYS) {
    const rule = getFamilyBlueprintRule(family);
    assert.ok(rule !== null, `Missing rule for family: ${family}`);
    assert.ok(rule!.typicalComponents.length > 0, `${family} has no typical components`);
    assert.ok(rule!.defaultCookMethods.length > 0, `${family} has no cook methods`);
    assert.ok(rule!.requiredRoles.length > 0, `${family} has no required roles`);
    assert.ok(rule!.finishStrategies.length > 0, `${family} has no finish strategies`);
    assert.ok(rule!.commonFailureRisks.length > 0, `${family} has no failure risks`);
  }
});

test("getFamilyBlueprintRule returns null for unknown family", () => {
  const rule = getFamilyBlueprintRule("unknown_family_xyz");
  assert.equal(rule, null);
});

test("FALLBACK_BLUEPRINT_RULE is defined and usable as a safe default", () => {
  assert.ok(FALLBACK_BLUEPRINT_RULE.typicalComponents.length > 0);
  assert.ok(FALLBACK_BLUEPRINT_RULE.requiredRoles.length > 0);
  assert.ok(FALLBACK_BLUEPRINT_RULE.defaultRichnessLevel !== undefined);
});

test("skillet_saute rule requires protein, aromatic, and fat roles", () => {
  const rule = getFamilyBlueprintRule("skillet_saute");
  assert.ok(rule !== null);
  assert.ok(rule!.requiredRoles.includes("protein"));
  assert.ok(rule!.requiredRoles.includes("aromatic"));
  assert.ok(rule!.requiredRoles.includes("fat"));
});

test("soups_stews rule requires liquid role", () => {
  const rule = getFamilyBlueprintRule("soups_stews");
  assert.ok(rule !== null);
  assert.ok(rule!.requiredRoles.includes("liquid"));
});

test("pasta rule requires base and umami roles", () => {
  const rule = getFamilyBlueprintRule("pasta");
  assert.ok(rule !== null);
  assert.ok(rule!.requiredRoles.includes("base"));
  assert.ok(rule!.requiredRoles.includes("umami"));
});

test("all launch family time defaults are positive numbers", () => {
  for (const family of LAUNCH_FAMILY_KEYS) {
    const rule = getFamilyBlueprintRule(family)!;
    assert.ok(rule.defaultDifficultyMinutes.prep > 0, `${family} prep time must be > 0`);
    assert.ok(rule.defaultDifficultyMinutes.cook > 0, `${family} cook time must be > 0`);
  }
});

test("8 launch families are defined — not more, not fewer", () => {
  assert.equal(LAUNCH_FAMILY_KEYS.length, 8);
});

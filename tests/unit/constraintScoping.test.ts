// tests/unit/constraintScoping.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  scopeConstraints,
  detectPivotAndInvalidate,
} from "../../lib/ai/intent/constraintScoping";
import type { ResolvedConstraint } from "../../lib/ai/intent/intentTypes";

function makeConstraint(
  overrides: Partial<ResolvedConstraint> & Pick<ResolvedConstraint, "type" | "value">
): Omit<ResolvedConstraint, "scope"> {
  return {
    strength: "hard",
    source: "explicit_user",
    ...overrides,
  };
}

// ── scopeConstraints ──────────────────────────────────────────────────────────

test("scopeConstraints: dietary restrictions are user_persistent", () => {
  const constraints = [makeConstraint({ type: "dietary", value: "vegan" })];
  const scoped = scopeConstraints({ constraints, userMessage: "make me something vegan" });
  assert.equal(scoped[0]!.scope, "user_persistent");
});

test("scopeConstraints: user_settings source is always user_persistent", () => {
  const constraints = [
    makeConstraint({ type: "equipment", value: "stand mixer", source: "user_settings" }),
  ];
  const scoped = scopeConstraints({ constraints, userMessage: "bake something" });
  assert.equal(scoped[0]!.scope, "user_persistent");
});

test("scopeConstraints: technique constraint from explicit_user is dish_specific", () => {
  const constraints = [
    makeConstraint({ type: "technique", value: "slow_cook", source: "explicit_user" }),
  ];
  const scoped = scopeConstraints({ constraints, userMessage: "slow cook a stew" });
  assert.equal(scoped[0]!.scope, "dish_specific");
});

test("scopeConstraints: equipment constraint from explicit_user is dish_specific", () => {
  const constraints = [
    makeConstraint({ type: "equipment", value: "slow cooker", source: "explicit_user" }),
  ];
  const scoped = scopeConstraints({ constraints, userMessage: "use a slow cooker" });
  assert.equal(scoped[0]!.scope, "dish_specific");
});

test("scopeConstraints: session_lock source is session_active", () => {
  const constraints = [
    makeConstraint({ type: "ingredient", value: "sourdough discard", source: "session_lock" }),
  ];
  const scoped = scopeConstraints({ constraints, userMessage: "use sourdough discard" });
  assert.equal(scoped[0]!.scope, "session_active");
});

// ── detectPivotAndInvalidate ──────────────────────────────────────────────────

test("detectPivotAndInvalidate: no pivot when families are the same", () => {
  const constraints: ResolvedConstraint[] = [
    { type: "technique", value: "slow_cook", scope: "dish_specific", strength: "hard", source: "explicit_user" },
  ];
  const result = detectPivotAndInvalidate({
    constraints,
    previousFamily: "soup",
    newFamily: "soup",
    userMessage: "make it spicier",
  });
  assert.equal(result.pivotType, "no_pivot");
  assert.equal(result.keptConstraints.length, 1);
  assert.equal(result.invalidatedConstraints.length, 0);
});

test("detectPivotAndInvalidate: dish pivot drops dish_specific constraints", () => {
  const constraints: ResolvedConstraint[] = [
    { type: "equipment", value: "slow cooker", scope: "dish_specific", strength: "hard", source: "explicit_user" },
    { type: "dietary", value: "vegan", scope: "user_persistent", strength: "hard", source: "user_settings" },
  ];
  const result = detectPivotAndInvalidate({
    constraints,
    previousFamily: "soup",
    newFamily: "bread",
    userMessage: "actually let's make sourdough bread",
  });
  assert.equal(result.pivotType, "dish_pivot");
  assert.equal(result.keptConstraints.length, 1);
  assert.equal(result.keptConstraints[0]!.value, "vegan");
  assert.equal(result.invalidatedConstraints.length, 1);
  assert.equal(result.invalidatedConstraints[0]!.value, "slow cooker");
});

test("detectPivotAndInvalidate: user_persistent constraints survive dish pivot", () => {
  const constraints: ResolvedConstraint[] = [
    { type: "dietary", value: "gluten-free", scope: "user_persistent", strength: "hard", source: "user_settings" },
    { type: "equipment", value: "slow cooker", scope: "dish_specific", strength: "hard", source: "explicit_user" },
  ];
  const result = detectPivotAndInvalidate({
    constraints,
    previousFamily: "soup",
    newFamily: "stir_fry",
    userMessage: "let's do stir fry instead",
  });
  const keptValues = result.keptConstraints.map((c) => c.value);
  assert.ok(keptValues.includes("gluten-free"), "dietary restriction should survive");
  assert.ok(!keptValues.includes("slow cooker"), "slow cooker should be invalidated");
});

test("detectPivotAndInvalidate: retry_local constraints are always invalidated", () => {
  const constraints: ResolvedConstraint[] = [
    { type: "ingredient", value: "extra salt", scope: "retry_local", strength: "hint", source: "inferred" },
    { type: "dietary", value: "vegan", scope: "user_persistent", strength: "hard", source: "user_settings" },
  ];
  const result = detectPivotAndInvalidate({
    constraints,
    previousFamily: "soup",
    newFamily: "soup",
    userMessage: "try again",
  });
  const invalidatedValues = result.invalidatedConstraints.map((c) => c.value);
  assert.ok(invalidatedValues.includes("extra salt"));
  assert.ok(!invalidatedValues.includes("vegan"));
});

test("detectPivotAndInvalidate: style pivot keeps all dish_specific constraints", () => {
  const constraints: ResolvedConstraint[] = [
    { type: "technique", value: "slow_cook", scope: "dish_specific", strength: "hard", source: "explicit_user" },
  ];
  const result = detectPivotAndInvalidate({
    constraints,
    previousFamily: "soup",
    newFamily: "soup",
    userMessage: "make it a bit more spicy",
  });
  assert.equal(result.pivotType, "no_pivot");
  assert.equal(result.keptConstraints.length, 1);
});

// tests/unit/lockedSessionLegacyCompat.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeLockedSession, buildLockedBrief } from "../../lib/ai/lockedSession";
import type { LockedDirectionSession } from "../../lib/ai/contracts/lockedDirectionSession";
import type { BuildSpec } from "../../lib/ai/contracts/buildSpec";

function makeMinimalSession(
  overrides: Partial<LockedDirectionSession> = {}
): LockedDirectionSession {
  return {
    conversation_key: "home-1",
    state: "ready_to_build",
    selected_direction: {
      id: "opt-1",
      title: "Sourdough Loaf",
      summary: "Classic sourdough with sourdough discard.",
      tags: ["bread", "sourdough"],
    },
    refinements: [],
    brief_snapshot: null,
    build_spec: null,
    ...overrides,
  };
}

function makeValidBuildSpec(overrides: Partial<BuildSpec> = {}): BuildSpec {
  return {
    dish_family: "bread",
    display_title: "Sourdough Loaf",
    build_title: "Sourdough Loaf",
    primary_anchor_type: "dish",
    primary_anchor_value: "sourdough",
    required_ingredients: [],
    forbidden_ingredients: [],
    style_tags: [],
    must_preserve_format: true,
    confidence: 0.9,
    derived_at: "lock_time",
    dish_family_source: "model",
    anchor_source: "model",
    ...overrides,
  };
}

// ── canonicalizeLockedSession ─────────────────────────────────────────────────

test("canonicalizeLockedSession: null session returns null", () => {
  const result = canonicalizeLockedSession({ session: null });
  assert.equal(result, null);
});

test("canonicalizeLockedSession: undefined session returns null", () => {
  const result = canonicalizeLockedSession({ session: undefined });
  assert.equal(result, null);
});

test("canonicalizeLockedSession: session with null build_spec is returned intact", () => {
  const session = makeMinimalSession({ build_spec: null });
  const result = canonicalizeLockedSession({ session });
  assert.ok(result !== null);
  assert.equal(result.conversation_key, "home-1");
  assert.equal(result.build_spec, null);
});

test("canonicalizeLockedSession: session with stale build_spec (missing derived_at) normalizes spec to null", () => {
  // Simulates a record written before the sentinel field was introduced
  const staleSpec = {
    dish_family: "bread",
    display_title: "Sourdough Loaf",
    build_title: "Sourdough Loaf",
    primary_anchor_type: "dish",
    primary_anchor_value: "sourdough",
    required_ingredients: [],
    forbidden_ingredients: [],
    style_tags: [],
    must_preserve_format: true,
    confidence: 0.9,
    dish_family_source: "model",
    anchor_source: "model",
    // derived_at intentionally absent — stale payload
  } as unknown as BuildSpec;
  const session = makeMinimalSession({ build_spec: staleSpec });
  // No conversation history → canonicalize just normalizes, doesn't re-derive
  const result = canonicalizeLockedSession({ session, conversationHistory: [] });
  assert.ok(result !== null);
  // build_spec should be null (rejected by normalizeBuildSpec)
  assert.equal(result.build_spec, null);
});

test("canonicalizeLockedSession: session with unknown dish_family in build_spec normalizes spec to null", () => {
  // "stew" is not in DISH_FAMILIES — normalizeBuildSpec rejects it
  const invalidSpec = makeValidBuildSpec({
    dish_family: "stew" as unknown as BuildSpec["dish_family"],
  });
  const session = makeMinimalSession({ build_spec: invalidSpec });
  const result = canonicalizeLockedSession({ session, conversationHistory: [] });
  assert.ok(result !== null);
  assert.equal(result.build_spec, null);
});

test("canonicalizeLockedSession: valid build_spec is preserved", () => {
  const session = makeMinimalSession({ build_spec: makeValidBuildSpec() });
  const result = canonicalizeLockedSession({ session, conversationHistory: [] });
  assert.ok(result !== null);
  assert.equal(result.build_spec?.dish_family, "bread");
  assert.equal(result.build_spec?.derived_at, "lock_time");
});

// ── buildLockedBrief (legacy path — no build_spec) ────────────────────────────

test("buildLockedBrief: legacy session (null build_spec) produces a valid brief", () => {
  const session = makeMinimalSession({ build_spec: null });
  const brief = buildLockedBrief({ session });
  assert.ok(brief !== null);
  assert.equal(typeof brief.confidence, "number");
  assert.ok(Array.isArray(brief.ingredients.required));
  assert.ok(Array.isArray(brief.ingredients.forbidden));
  assert.equal(brief.request_mode, "locked");
});

test("buildLockedBrief: refinement missing resolved_ingredient_intents does not throw", () => {
  // Old records: resolved_ingredient_intents was added later and is optional
  const session = makeMinimalSession({
    build_spec: null,
    refinements: [
      {
        user_text: "add garlic",
        assistant_text: null,
        confidence: 0.9,
        ambiguity_reason: null,
        extracted_changes: {
          required_ingredients: ["garlic"],
          preferred_ingredients: [],
          forbidden_ingredients: [],
          style_tags: [],
          notes: [],
          // ingredient_provenance intentionally absent
        },
        field_state: {
          ingredients: "locked",
          style: "inferred",
          notes: "inferred",
        },
        // resolved_ingredient_intents intentionally absent
      },
    ],
  });
  assert.doesNotThrow(() => buildLockedBrief({ session }));
});

test("buildLockedBrief: refinement ingredient_provenance absent does not throw", () => {
  // Old records: ingredient_provenance was added to extracted_changes later and is optional
  const session = makeMinimalSession({
    build_spec: null,
    refinements: [
      {
        user_text: "make it spicier",
        assistant_text: null,
        confidence: 0.8,
        ambiguity_reason: null,
        extracted_changes: {
          required_ingredients: [],
          preferred_ingredients: [],
          forbidden_ingredients: [],
          style_tags: ["spicy"],
          notes: [],
          // ingredient_provenance intentionally absent
        },
        field_state: {
          ingredients: "inferred",
          style: "locked",
          notes: "inferred",
        },
      },
    ],
  });
  const brief = buildLockedBrief({ session });
  assert.ok(brief.style.tags.includes("spicy"));
});

test("buildLockedBrief: session with state 'built' still produces a valid brief", () => {
  // Post-build sessions: state is 'built' but session may need re-use on retry
  const session = makeMinimalSession({ build_spec: null, state: "built" });
  const brief = buildLockedBrief({ session });
  assert.ok(brief !== null);
  assert.equal(brief.request_mode, "locked");
});

test("buildLockedBrief: session with build_spec takes fast path (no legacy reconstruction)", () => {
  const session = makeMinimalSession({ build_spec: makeValidBuildSpec() });
  const brief = buildLockedBrief({ session });
  // Fast path sets dish_family from spec
  assert.equal(brief.dish.dish_family, "bread");
  // Fast path leaves a compiler note
  assert.ok(brief.compiler_notes.some((note) => note.includes("BuildSpec")));
});

# Milestone 4 Plan A: Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the canonical data, storage, API, mapping, and learned-signal foundation required for MealMax to learn from real cooked outcomes.

**Architecture:** Post-cook feedback is stored as event rows in a new `recipe_postcook_feedback` table, fed through a dedicated `applyPostCookFeedback()` mapping layer into the existing `user_taste_scores` table. The refactored `userTasteProfile.ts` reads from `user_taste_scores` to produce richer taste summaries. A new `learnedSignals.ts` module exposes one shared learned-pattern interface (with TTL cache + explicit invalidation) for Plans B–E to consume without recomputing independently.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgreSQL + RLS), Zod, Node built-in test runner (`node:test` + `node:assert/strict`)

---

## File map

| Action | File | Responsibility |
|---|---|---|
| Create | `docs/m4-learning-authority.md` | Authority boundary + module audit record |
| Create | `lib/ai/feedback/postCookFeedbackTypes.ts` | Canonical types + Zod schema |
| Create | `supabase/migrations/202604010001_m4_postcook_feedback.sql` | Event table + RLS |
| Modify | `lib/ai/featureFlags.ts` | M4 flag constants |
| Create | `app/api/recipes/[id]/versions/[versionId]/postcook/route.ts` | Post-cook API route |
| Modify | `lib/ai/tasteModel.ts` | Add `complexityTolerance` + `flavorIntensityPreference` optional dims |
| Create | `lib/ai/feedback/applyPostCookFeedback.ts` | Post-cook → taste-score mapping |
| Modify | `lib/ai/userTasteProfile.ts` | Add `summarizeLearnedScores`, wire `user_taste_scores` into summary |
| Create | `lib/ai/learnedSignals.ts` | Shared learned-signal interface, TTL cache, `deriveLearnedPatterns` |
| Modify | `lib/admin/adminData.ts` | Post-cook coverage stats |
| Create | `tests/unit/postCookFeedbackTypes.test.ts` | Schema validation tests |
| Create | `tests/unit/applyPostCookFeedback.test.ts` | Mapping behavior tests |
| Create | `tests/unit/learnedSignals.test.ts` | Pattern derivation tests |
| Create | `docs/m4-plan-a-rollout-checklist.md` | Launch + rollback checklist |

---

## Task 1: Authority and audit documentation

**Files:**
- Create: `docs/m4-learning-authority.md`

- [ ] **Step 1: Create the authority boundary document**

Create `docs/m4-learning-authority.md`:

```markdown
# MealMax M4 Learning Authority Boundaries

## Signal hierarchy (what wins where)

1. **Hard constraints** (Settings / `user_preferences`): dietary restrictions, equipment limits,
   pantry exclusions — always authoritative, never overridden by learned behavior.
2. **Explicit preferences** (`user_preferences`): favorite cuisines, proteins, flavors,
   spice tolerance — authoritative for defaults.
3. **Post-cook outcomes** (`recipe_postcook_feedback`): real cooked-outcome events —
   canonical source of truth for "I made this and here is how it went."
4. **Learned scores** (`user_taste_scores`): structured −1/+1 scores per taste dimension —
   derived from all feedback types; influences ranking/suggestions, never overrides constraints.
5. **Taste summary** (`user_taste_profiles`): rendered text built from learned scores —
   descriptive aid, not hard fact. Surface with cautious language when evidence is sparse.
6. **Lightweight reactions** (`recipe_feedback`): thumbs-up/down — remain active and feed
   taste scores with lower weight than post-cook events.

## Module disposition

| Module | Disposition | Role |
|---|---|---|
| `lib/ai/tasteModel.ts` | reuse + extend (M4 adds 2 optional dims) | learned-signal producer |
| `lib/ai/userTasteProfile.ts` | refactor to consume `user_taste_scores` | rendered summary output |
| `POST /api/taste/feedback` | reuse directly | lightweight reaction input |
| `POST /api/taste/scores` | reuse directly | learned-signal read |
| `POST /api/taste/why-fits` | reuse directly | explanation-only output |
| `recipe_feedback` table | freeze for legacy | lightweight reaction input |
| `recipe_postcook_feedback` (new) | canonical post-cook event store | post-cook outcome input |
| `lib/ai/learnedSignals.ts` (new) | shared delivery interface | suggestion/ranking consumer |
| `lib/recipeSidebarData.ts` | wrap in Plan B | suggestion/ranking consumer |
| home suggestion builders | wrap in Plan D | suggestion/ranking consumer |
| Create-page suggestion source | wrap in Plan D | suggestion/ranking consumer |

## Rules

- Learned behavior cannot outrank explicit dietary, equipment, or pantry constraints.
- `would_make_again = false` reduces resurfacing appeal for that recipe version shape only.
  It is not a broad cuisine dislike and must not be treated as one.
- Learned summaries use hedged language when `getOverallConfidenceLevel` returns "medium".
  They return empty string when it returns "low".
- Create, Library, Planner, and Settings consume learned signals via `learnedSignals.ts`.
  They do not recompute their own private learning logic.

## Storage decision (locked — not open for re-debate)

Post-cook feedback uses a dedicated `recipe_postcook_feedback` event table.
`recipe_feedback` (thumbs-up/down) remains unchanged.
These two tables are not merged at the storage layer.
Each post-cook cooking outcome is stored as a new INSERT row (event model, not upsert).
```

- [ ] **Step 2: Commit**

```bash
git add docs/m4-learning-authority.md
git commit -m "docs: add M4 learning authority boundaries and module audit"
```

---

## Task 2: Post-cook feedback type system

**Files:**
- Create: `lib/ai/feedback/postCookFeedbackTypes.ts`
- Test: `tests/unit/postCookFeedbackTypes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/postCookFeedbackTypes.test.ts`:

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import {
  postCookFeedbackSchema,
  POST_COOK_OVERALL_OUTCOMES,
  POST_COOK_ISSUE_TAGS,
} from "../../lib/ai/feedback/postCookFeedbackTypes";

test("postCookFeedbackSchema accepts a valid minimal payload", () => {
  const result = postCookFeedbackSchema.safeParse({ overall_outcome: "great" });
  assert.ok(result.success);
  assert.equal(result.data!.overall_outcome, "great");
  assert.deepEqual(result.data!.issue_tags, []);
  assert.equal(result.data!.would_make_again, null);
  assert.equal(result.data!.notes, null);
});

test("postCookFeedbackSchema accepts a fully filled payload", () => {
  const result = postCookFeedbackSchema.safeParse({
    overall_outcome: "disappointing",
    would_make_again: false,
    issue_tags: ["too_bland", "too_heavy"],
    notes: "Needed more salt and less cream.",
  });
  assert.ok(result.success);
  assert.equal(result.data!.overall_outcome, "disappointing");
  assert.equal(result.data!.would_make_again, false);
  assert.deepEqual(result.data!.issue_tags, ["too_bland", "too_heavy"]);
});

test("postCookFeedbackSchema rejects an unknown overall_outcome", () => {
  const result = postCookFeedbackSchema.safeParse({ overall_outcome: "meh" });
  assert.ok(!result.success);
});

test("postCookFeedbackSchema rejects a positive meta tag as an issue tag", () => {
  const result = postCookFeedbackSchema.safeParse({
    overall_outcome: "good_with_changes",
    issue_tags: ["loved_it"],
  });
  assert.ok(!result.success);
});

test("postCookFeedbackSchema rejects notes longer than 500 chars", () => {
  const result = postCookFeedbackSchema.safeParse({
    overall_outcome: "great",
    notes: "a".repeat(501),
  });
  assert.ok(!result.success);
});

test("postCookFeedbackSchema accepts notes at exactly 500 chars", () => {
  const result = postCookFeedbackSchema.safeParse({
    overall_outcome: "great",
    notes: "a".repeat(500),
  });
  assert.ok(result.success);
});

test("POST_COOK_OVERALL_OUTCOMES contains exactly four values", () => {
  assert.equal(POST_COOK_OVERALL_OUTCOMES.length, 4);
  assert.ok(POST_COOK_OVERALL_OUTCOMES.includes("great"));
  assert.ok(POST_COOK_OVERALL_OUTCOMES.includes("failed"));
});

test("POST_COOK_ISSUE_TAGS contains exactly nine values", () => {
  assert.equal(POST_COOK_ISSUE_TAGS.length, 9);
  assert.ok(POST_COOK_ISSUE_TAGS.includes("too_bland"));
  assert.ok(POST_COOK_ISSUE_TAGS.includes("texture_off"));
});
```

- [ ] **Step 2: Run tests — expect FAIL (module does not exist yet)**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | grep -i "postCookFeedback\|error\|fail" | head -10
```

Expected: module not found or similar error.

- [ ] **Step 3: Create the types and schema file**

Create `lib/ai/feedback/postCookFeedbackTypes.ts`:

```typescript
import { z } from "zod";

export const POST_COOK_OVERALL_OUTCOMES = [
  "great",
  "good_with_changes",
  "disappointing",
  "failed",
] as const;

export type PostCookOverallOutcome = (typeof POST_COOK_OVERALL_OUTCOMES)[number];

export const POST_COOK_ISSUE_TAGS = [
  "too_bland",
  "too_salty",
  "too_spicy",
  "too_heavy",
  "too_complex",
  "too_many_steps",
  "texture_off",
  "too_wet",
  "too_dry",
] as const;

export type PostCookIssueTag = (typeof POST_COOK_ISSUE_TAGS)[number];

export const postCookFeedbackSchema = z.object({
  overall_outcome: z.enum(POST_COOK_OVERALL_OUTCOMES),
  /**
   * Whether this recipe shape should remain a good resurfacing candidate.
   * NOT a cuisine-level dislike. NOT a broad preference statement.
   * Semantics: "I would want roughly this recipe suggested to me again."
   */
  would_make_again: z.boolean().nullable().optional().default(null),
  issue_tags: z.array(z.enum(POST_COOK_ISSUE_TAGS)).default([]),
  notes: z.string().max(500).nullable().optional().default(null),
});

export type PostCookFeedbackInput = z.infer<typeof postCookFeedbackSchema>;

/** Post-cook feedback after validation — all fields resolved to their final types. */
export type PostCookFeedback = {
  overall_outcome: PostCookOverallOutcome;
  would_make_again: boolean | null;
  issue_tags: PostCookIssueTag[];
  notes: string | null;
};
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | tail -15
```

Expected: 8 passing tests.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/feedback/postCookFeedbackTypes.ts tests/unit/postCookFeedbackTypes.test.ts
git commit -m "feat: add post-cook feedback canonical type system and Zod schema"
```

---

## Task 3: DB migration for recipe_postcook_feedback

**Files:**
- Create: `supabase/migrations/202604010001_m4_postcook_feedback.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/202604010001_m4_postcook_feedback.sql`:

```sql
-- Milestone 4 Plan A: post-cook outcome event table.
--
-- Event model:
--   Each cooking outcome is a separate INSERT row — never upsert/overwrite.
--   Multiple rows per (user_id, recipe_version_id) are valid and expected.
--
-- Duplicate handling policy (enforced at the application layer, not DB layer):
--   Reject if (user_id, recipe_version_id, overall_outcome) matches a row
--   created within the last 30 seconds. Prevents accidental double-taps without
--   collapsing legitimate repeated cook sessions.
--
-- Version integrity:
--   recipe_version_id is stored as-is. Do not merge events across versions at
--   the storage layer. Downstream consumers decide how to aggregate.

create table if not exists recipe_postcook_feedback (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  recipe_id         uuid        not null,
  recipe_version_id uuid        not null,
  overall_outcome   text        not null
                                check (overall_outcome in (
                                  'great', 'good_with_changes', 'disappointing', 'failed'
                                )),
  would_make_again  boolean,
  issues            text[]      not null default '{}',
  notes             text,
  created_at        timestamptz not null default now()
);

alter table recipe_postcook_feedback enable row level security;

create policy "owner_insert"
  on recipe_postcook_feedback for insert
  with check (auth.uid() = user_id);

create policy "owner_select"
  on recipe_postcook_feedback for select
  using (auth.uid() = user_id);

-- Per-user recency lookups (primary query pattern)
create index recipe_postcook_feedback_user_created_idx
  on recipe_postcook_feedback(user_id, created_at desc);

-- Version-specific event lookups
create index recipe_postcook_feedback_user_version_idx
  on recipe_postcook_feedback(user_id, recipe_version_id, created_at desc);

-- Recipe-level aggregation
create index recipe_postcook_feedback_user_recipe_idx
  on recipe_postcook_feedback(user_id, recipe_id, created_at desc);
```

- [ ] **Step 2: Apply the migration**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npx supabase db push
```

Expected: migration applied without errors. Verify the table exists in the Supabase dashboard.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202604010001_m4_postcook_feedback.sql
git commit -m "feat: add recipe_postcook_feedback event table with RLS"
```

---

## Task 4: M4 feature flags

**Files:**
- Modify: `lib/ai/featureFlags.ts`

- [ ] **Step 1: Add M4 flag constants to FEATURE_FLAG_KEYS**

In `lib/ai/featureFlags.ts`, after the `// Milestone 3` block inside `FEATURE_FLAG_KEYS`, add:

```typescript
  // Milestone 4
  POSTCOOK_FEEDBACK_V1: "postcook_feedback_v1",
  IMPROVE_WITH_FEEDBACK_V1: "improve_with_feedback_v1",
  LIBRARY_RESURFACING_V1: "library_resurfacing_v1",
  CREATE_PERSONALIZATION_V1: "create_personalization_v1",
  LEARNED_PREFERENCES_SETTINGS_V1: "learned_preferences_settings_v1",
```

The full updated `FEATURE_FLAG_KEYS` object (replace the existing one):

```typescript
export const FEATURE_FLAG_KEYS = {
  GRACEFUL_MODE: "graceful_mode",
  INTENT_RESOLVER_V2: "intent_resolver_v2",
  DRAFT_RECIPE_LIFECYCLE_V1: "draft_recipe_lifecycle_v1",
  CREATE_GUIDED_ENTRY_V1: "create_guided_entry_v1",
  // Milestone 2
  BLUEPRINT_GENERATION_V1: "blueprint_generation_v1",
  VALIDATION_SPLIT_V1: "validation_split_v1",
  RECIPE_DETAIL_HIERARCHY_V1: "recipe_detail_hierarchy_v1",
  // Milestone 3
  COACH_LAYER_V1: "coach_layer_v1",
  RECIPE_DETAIL_PRECOOK_BLOCK_V1: "recipe_detail_precook_block_v1",
  COOK_MODE_CUES_V1: "cook_mode_cues_v1",
  COOK_MODE_RESCUE_V1: "cook_mode_rescue_v1",
  // Milestone 4
  POSTCOOK_FEEDBACK_V1: "postcook_feedback_v1",
  IMPROVE_WITH_FEEDBACK_V1: "improve_with_feedback_v1",
  LIBRARY_RESURFACING_V1: "library_resurfacing_v1",
  CREATE_PERSONALIZATION_V1: "create_personalization_v1",
  LEARNED_PREFERENCES_SETTINGS_V1: "learned_preferences_settings_v1",
} as const;
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/featureFlags.ts
git commit -m "feat: add Milestone 4 feature flag constants"
```

---

## Task 5: Post-cook API route (storage + validation)

**Files:**
- Create: `app/api/recipes/[id]/versions/[versionId]/postcook/route.ts`

This task builds the route with storage and the 30-second duplicate guard.
Taste-score wiring is added in Task 8 after the mapping layer exists.

- [ ] **Step 1: Create the route file**

Create `app/api/recipes/[id]/versions/[versionId]/postcook/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { postCookFeedbackSchema } from "@/lib/ai/feedback/postCookFeedbackTypes";

/** Reject identical (user, version, outcome) submissions within this window. */
const DUPLICATE_WINDOW_MS = 30_000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id: recipeId, versionId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ownership check — also fetches title and tags for feature extraction later
  const { data: recipe } = await supabase
    .from("recipes")
    .select("owner_id, title, tags")
    .eq("id", recipeId)
    .maybeSingle();
  if (!recipe || recipe.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postCookFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { overall_outcome, would_make_again, issue_tags, notes } = parsed.data;

  // Accidental duplicate guard: same outcome submitted for same version within 30s
  const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const { data: recent } = await supabase
    .from("recipe_postcook_feedback")
    .select("id")
    .eq("user_id", user.id)
    .eq("recipe_version_id", versionId)
    .eq("overall_outcome", overall_outcome)
    .gte("created_at", windowStart)
    .limit(1);

  if (recent && recent.length > 0) {
    return NextResponse.json(
      { error: "Duplicate submission", code: "DUPLICATE_WINDOW" },
      { status: 409 }
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("recipe_postcook_feedback")
    .insert({
      user_id: user.id,
      recipe_id: recipeId,
      recipe_version_id: versionId,
      overall_outcome,
      would_make_again: would_make_again ?? null,
      issues: issue_tags,
      notes: notes ?? null,
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    console.error("Failed to insert post-cook feedback", insertError.message);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: inserted.id, created_at: inserted.created_at });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/recipes/[id]/versions/[versionId]/postcook/route.ts"
git commit -m "feat: add post-cook feedback API route with event storage"
```

---

## Task 6: Extend TasteModel with two new optional dimensions

**Files:**
- Modify: `lib/ai/tasteModel.ts`

`too_bland`/`too_salty` need a `flavorIntensityPreference` dimension.
`too_complex`/`too_many_steps` need a `complexityTolerance` dimension.
Both are optional (undefined = never set, compatible with existing persisted `TasteModel` JSON).

- [ ] **Step 1: Add the two optional fields to the TasteModel type**

In `lib/ai/tasteModel.ts`, replace the `TasteModel` type definition:

```typescript
export type TasteModel = {
  cuisines: Record<string, TasteScore>;
  proteins: Record<string, TasteScore>;
  flavors: Record<string, TasteScore>;
  dishFamilies: Record<string, TasteScore>;
  dislikedIngredients: Record<string, TasteScore>;
  spiceTolerance: TasteScore | null;
  richnessPreference: TasteScore | null;
  // Added in M4 — derived from post-cook issue tags only
  complexityTolerance?: TasteScore | null;
  flavorIntensityPreference?: TasteScore | null;
};
```

- [ ] **Step 2: Update applyDecay to decay the new optional dimensions**

In `lib/ai/tasteModel.ts`, inside `applyDecay`, after the `richnessPreference` line in the return block, add:

```typescript
    complexityTolerance: model.complexityTolerance
      ? decayOne(model.complexityTolerance, scoreR, confR)
      : (model.complexityTolerance ?? null),
    flavorIntensityPreference: model.flavorIntensityPreference
      ? decayOne(model.flavorIntensityPreference, scoreR, confR)
      : (model.flavorIntensityPreference ?? null),
```

The full updated return block of `applyDecay`:

```typescript
  return {
    cuisines: decayDict(model.cuisines, scoreR, confR),
    proteins: decayDict(model.proteins, scoreR, confR),
    flavors: decayDict(model.flavors, scoreR, confR),
    dishFamilies: decayDict(model.dishFamilies, scoreR, confR),
    dislikedIngredients: decayDict(model.dislikedIngredients, dislikeScoreR, dislikeConfR),
    spiceTolerance: model.spiceTolerance ? decayOne(model.spiceTolerance, scoreR, confR) : null,
    richnessPreference: model.richnessPreference
      ? decayOne(model.richnessPreference, scoreR, confR)
      : null,
    complexityTolerance: model.complexityTolerance
      ? decayOne(model.complexityTolerance, scoreR, confR)
      : (model.complexityTolerance ?? null),
    flavorIntensityPreference: model.flavorIntensityPreference
      ? decayOne(model.flavorIntensityPreference, scoreR, confR)
      : (model.flavorIntensityPreference ?? null),
  };
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 4: Run unit tests to verify no regressions**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | tail -10
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/tasteModel.ts
git commit -m "feat: extend TasteModel with complexityTolerance and flavorIntensityPreference"
```

---

## Task 7: Implement post-cook-to-taste-score mapping layer

**Files:**
- Create: `lib/ai/feedback/applyPostCookFeedback.ts`
- Test: `tests/unit/applyPostCookFeedback.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/applyPostCookFeedback.test.ts`:

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { applyPostCookFeedback } from "../../lib/ai/feedback/applyPostCookFeedback";
import type { PostCookFeedback } from "../../lib/ai/feedback/postCookFeedbackTypes";
import type { RecipeFeatures } from "../../lib/ai/tasteModel";

const sampleFeatures: RecipeFeatures = {
  cuisines: ["italian"],
  proteins: ["chicken"],
  flavors: ["creamy", "savory"],
  dishFamily: "pasta",
  ingredients: ["chicken", "cream", "garlic", "parmesan"],
};

function feedback(overrides: Partial<PostCookFeedback> = {}): PostCookFeedback {
  return {
    overall_outcome: "great",
    would_make_again: null,
    issue_tags: [],
    notes: null,
    ...overrides,
  };
}

test("great outcome reinforces cuisine, protein, and dish family", () => {
  const result = applyPostCookFeedback(null, feedback({ overall_outcome: "great" }), sampleFeatures);
  assert.ok((result.cuisines["italian"]?.score ?? 0) > 0, "italian cuisine score should increase");
  assert.ok((result.proteins["chicken"]?.score ?? 0) > 0, "chicken protein score should increase");
  assert.ok((result.dishFamilies["pasta"]?.score ?? 0) > 0, "pasta dish family score should increase");
});

test("disappointing outcome downranks dish family", () => {
  const result = applyPostCookFeedback(null, feedback({ overall_outcome: "disappointing" }), sampleFeatures);
  assert.ok((result.dishFamilies["pasta"]?.score ?? 0) < 0, "pasta dish family score should decrease");
});

test("failed outcome applies stronger downrank than disappointing", () => {
  const disappointing = applyPostCookFeedback(null, feedback({ overall_outcome: "disappointing" }), sampleFeatures);
  const failed = applyPostCookFeedback(null, feedback({ overall_outcome: "failed" }), sampleFeatures);
  assert.ok(
    (failed.dishFamilies["pasta"]?.score ?? 0) < (disappointing.dishFamilies["pasta"]?.score ?? 0),
    "failed should produce a lower dish family score than disappointing"
  );
});

test("too_spicy tag reduces spiceTolerance score", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "good_with_changes", issue_tags: ["too_spicy"] }),
    sampleFeatures
  );
  assert.ok((result.spiceTolerance?.score ?? 0) < 0, "spiceTolerance should decrease");
  assert.ok((result.flavors["spicy"]?.score ?? 0) < 0, "spicy flavor score should decrease");
});

test("too_heavy tag reduces richnessPreference score", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "good_with_changes", issue_tags: ["too_heavy"] }),
    sampleFeatures
  );
  assert.ok((result.richnessPreference?.score ?? 0) < 0, "richnessPreference should decrease");
});

test("too_bland tag increases flavorIntensityPreference", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "good_with_changes", issue_tags: ["too_bland"] }),
    sampleFeatures
  );
  assert.ok((result.flavorIntensityPreference?.score ?? 0) > 0, "flavorIntensityPreference should increase");
});

test("too_salty tag decreases flavorIntensityPreference", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "good_with_changes", issue_tags: ["too_salty"] }),
    sampleFeatures
  );
  assert.ok((result.flavorIntensityPreference?.score ?? 0) < 0, "flavorIntensityPreference should decrease");
});

test("too_many_steps tag decreases complexityTolerance", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "good_with_changes", issue_tags: ["too_many_steps"] }),
    sampleFeatures
  );
  assert.ok((result.complexityTolerance?.score ?? 0) < 0, "complexityTolerance should decrease");
});

test("too_complex and too_many_steps both reduce complexityTolerance", () => {
  const r1 = applyPostCookFeedback(null, feedback({ issue_tags: ["too_complex"] }), sampleFeatures);
  const r2 = applyPostCookFeedback(null, feedback({ issue_tags: ["too_many_steps"] }), sampleFeatures);
  assert.ok((r1.complexityTolerance?.score ?? 0) < 0);
  assert.ok((r2.complexityTolerance?.score ?? 0) < 0);
});

test("would_make_again false does not create a broad cuisine dislike", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "disappointing", would_make_again: false }),
    sampleFeatures
  );
  // Cuisine score should be negative but not collapse — would_make_again is version-level only
  const cuisineScore = result.cuisines["italian"]?.score ?? 0;
  assert.ok(cuisineScore > -0.6, `cuisine score (${cuisineScore}) should not collapse from would_make_again alone`);
});

test("all scores remain within [-1, 1] after a single event", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "failed", issue_tags: ["too_spicy", "too_heavy", "too_bland"] }),
    sampleFeatures
  );
  const scores = [
    result.spiceTolerance?.score,
    result.richnessPreference?.score,
    result.flavorIntensityPreference?.score,
    ...Object.values(result.cuisines).map((s) => s.score),
    ...Object.values(result.flavors).map((s) => s.score),
  ].filter((s): s is number => s !== undefined && s !== null);

  for (const s of scores) {
    assert.ok(s >= -1 && s <= 1, `score ${s} is out of bounds`);
  }
});

test("null model initializes cleanly without throwing", () => {
  const result = applyPostCookFeedback(null, feedback(), sampleFeatures);
  assert.ok(typeof result.cuisines === "object");
  assert.ok(typeof result.proteins === "object");
});

test("texture_off tag does not throw (no score dim, silently skipped)", () => {
  assert.doesNotThrow(() => {
    applyPostCookFeedback(null, feedback({ issue_tags: ["texture_off"] }), sampleFeatures);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | grep -i "applyPostCookFeedback\|cannot find\|error" | head -5
```

Expected: module not found.

- [ ] **Step 3: Create the mapping implementation**

Create `lib/ai/feedback/applyPostCookFeedback.ts`:

```typescript
import type { TasteModel, RecipeFeatures, TasteScore } from "@/lib/ai/tasteModel";
import type { PostCookFeedback } from "./postCookFeedbackTypes";

// Post-cook events carry more evidential weight than thumbs-up/down reactions.
// Scores remain bounded by the same [-1, +1] TasteScore system with RETENTION decay.

const OUTCOME_WEIGHTS: Record<string, { recipeWeight: number; strength: number }> = {
  great:             { recipeWeight: +0.9, strength: 1.0 },
  good_with_changes: { recipeWeight: +0.4, strength: 0.7 },
  disappointing:     { recipeWeight: -0.5, strength: 0.7 },
  failed:            { recipeWeight: -0.7, strength: 0.9 },
};

const RETENTION = 0.9;
const CONFIDENCE_GAIN = 0.12; // slightly higher than lightweight feedback (0.10)

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function emptyScore(): TasteScore {
  return { score: 0, confidence: 0, evidenceCount: 0, lastUpdatedAt: new Date().toISOString() };
}

function updateScore(
  current: TasteScore | null | undefined,
  weight: number,
  strength: number
): TasteScore {
  const prev = current ?? emptyScore();
  return {
    score: clamp(prev.score * RETENTION + weight * strength, -1, 1),
    confidence: clamp(prev.confidence + CONFIDENCE_GAIN, 0, 1),
    evidenceCount: prev.evidenceCount + 1,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function updateMany(
  dict: Record<string, TasteScore>,
  keys: string[],
  weight: number,
  strength: number
): Record<string, TasteScore> {
  if (keys.length === 0) return dict;
  const next = { ...dict };
  for (const k of keys) next[k] = updateScore(dict[k], weight, strength);
  return next;
}

/**
 * Apply a post-cook feedback event to the taste model.
 *
 * This is a separate function from applyFeedback() (thumbs-up/down lightweight reactions).
 * Post-cook signals map a broader tag set and use higher signal weights.
 *
 * Design constraints enforced here:
 * - would_make_again = false is version-resurfacing signal only — do not create a broad
 *   cuisine dislike from it. Apply a modest additional dishFamily downrank only.
 * - texture_off / too_wet / too_dry have no current TasteModel dimension. They are silently
 *   skipped here and remain in the raw recipe_postcook_feedback table for Plans C/D.
 * - One noisy event cannot dominate: RETENTION decay bounds score accumulation.
 */
export function applyPostCookFeedback(
  model: TasteModel | null,
  feedback: PostCookFeedback,
  features: RecipeFeatures
): TasteModel {
  const m: TasteModel = model ?? {
    cuisines: {},
    proteins: {},
    flavors: {},
    dishFamilies: {},
    dislikedIngredients: {},
    spiceTolerance: null,
    richnessPreference: null,
  };

  const w = OUTCOME_WEIGHTS[feedback.overall_outcome];

  // Base outcome: reinforce or downrank recipe feature dimensions
  let next: TasteModel = {
    ...m,
    cuisines:     updateMany(m.cuisines,    features.cuisines,  w.recipeWeight, w.strength * 0.70),
    proteins:     updateMany(m.proteins,    features.proteins,  w.recipeWeight, w.strength * 0.60),
    flavors:      updateMany(m.flavors,     features.flavors,   w.recipeWeight, w.strength * 0.50),
    dishFamilies: features.dishFamily
      ? updateMany(m.dishFamilies, [features.dishFamily], w.recipeWeight, w.strength * 0.85)
      : m.dishFamilies,
  };

  // would_make_again = false: reduce resurfacing suitability for this recipe version shape.
  // Applies a modest additional dishFamily downrank — does NOT penalise cuisines or proteins.
  if (feedback.would_make_again === false) {
    next = {
      ...next,
      dishFamilies: features.dishFamily
        ? updateMany(next.dishFamilies, [features.dishFamily], -0.3, 0.5)
        : next.dishFamilies,
    };
  }

  // Issue-tag → score dimension mapping
  for (const tag of feedback.issue_tags) {
    switch (tag) {
      case "too_spicy":
        next = {
          ...next,
          spiceTolerance: updateScore(next.spiceTolerance, -0.8, 1.0),
          flavors: updateMany(next.flavors, ["spicy"], -0.8, 1.0),
        };
        break;

      case "too_heavy":
        next = {
          ...next,
          richnessPreference: updateScore(next.richnessPreference, -0.7, 1.0),
          flavors: updateMany(
            next.flavors,
            features.flavors.filter((f) => ["creamy", "rich"].includes(f)),
            -0.7,
            0.8
          ),
        };
        break;

      case "too_bland":
        // User wants stronger flavor — increase flavorIntensityPreference
        next = {
          ...next,
          flavorIntensityPreference: updateScore(next.flavorIntensityPreference, +0.6, 0.8),
        };
        break;

      case "too_salty":
        // User wants less aggressive seasoning — decrease flavorIntensityPreference
        next = {
          ...next,
          flavorIntensityPreference: updateScore(next.flavorIntensityPreference, -0.5, 0.8),
        };
        break;

      case "too_complex":
      case "too_many_steps":
        next = {
          ...next,
          complexityTolerance: updateScore(next.complexityTolerance, -0.6, 0.9),
        };
        break;

      // texture_off, too_wet, too_dry:
      // No TasteModel dimension for texture/moisture yet.
      // Remain in raw recipe_postcook_feedback for resurfacing logic in Plans C/D.
      default:
        break;
    }
  }

  return next;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | tail -20
```

Expected: all tests pass (13 new + all prior).

- [ ] **Step 5: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/feedback/applyPostCookFeedback.ts tests/unit/applyPostCookFeedback.test.ts
git commit -m "feat: implement post-cook-to-taste-score mapping layer with TDD"
```

---

## Task 8: Wire postcook route to apply taste-score updates

**Files:**
- Modify: `app/api/recipes/[id]/versions/[versionId]/postcook/route.ts`

After storing the event row, apply `applyPostCookFeedback`, upsert updated taste scores, invalidate the taste profile cache (same pattern as `POST /api/taste/feedback`), invalidate the learned-signal cache, and fire telemetry events.

All score-update work is fire-and-forget — storage failure is non-fatal.

- [ ] **Step 1: Replace the route file with the fully wired version**

Replace `app/api/recipes/[id]/versions/[versionId]/postcook/route.ts` entirely:

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { postCookFeedbackSchema } from "@/lib/ai/feedback/postCookFeedbackTypes";
import { applyPostCookFeedback } from "@/lib/ai/feedback/applyPostCookFeedback";
import { extractRecipeFeatures, type TasteModel } from "@/lib/ai/tasteModel";
import { invalidateLearnedSignalsCache } from "@/lib/ai/learnedSignals";
import { trackServerEvent } from "@/lib/trackServerEvent";

const DUPLICATE_WINDOW_MS = 30_000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id: recipeId, versionId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: recipe } = await supabase
    .from("recipes")
    .select("owner_id, title, tags")
    .eq("id", recipeId)
    .maybeSingle();
  if (!recipe || recipe.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postCookFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { overall_outcome, would_make_again, issue_tags, notes } = parsed.data;

  // Accidental duplicate guard
  const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const { data: recent } = await supabase
    .from("recipe_postcook_feedback")
    .select("id")
    .eq("user_id", user.id)
    .eq("recipe_version_id", versionId)
    .eq("overall_outcome", overall_outcome)
    .gte("created_at", windowStart)
    .limit(1);

  if (recent && recent.length > 0) {
    return NextResponse.json(
      { error: "Duplicate submission", code: "DUPLICATE_WINDOW" },
      { status: 409 }
    );
  }

  // Fetch version ingredients for taste-feature extraction (best-effort)
  const { data: version } = await supabase
    .from("recipe_versions")
    .select("ingredients_json, dish_family")
    .eq("id", versionId)
    .maybeSingle();

  const ingredientNames = (
    version?.ingredients_json as Array<{ name?: string }> | null ?? []
  )
    .map((i) => i.name ?? "")
    .filter(Boolean);

  const { data: inserted, error: insertError } = await supabase
    .from("recipe_postcook_feedback")
    .insert({
      user_id: user.id,
      recipe_id: recipeId,
      recipe_version_id: versionId,
      overall_outcome,
      would_make_again: would_make_again ?? null,
      issues: issue_tags,
      notes: notes ?? null,
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    console.error("Failed to insert post-cook feedback", insertError.message);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  // Fire-and-forget: update taste scores, invalidate profile + signal caches, track events.
  // Failures here are non-fatal — the feedback row is already committed.
  void (async () => {
    try {
      await trackServerEvent(supabase, user.id, "postcook_feedback_submitted", {
        recipe_id: recipeId,
        recipe_version_id: versionId,
        overall_outcome,
        issue_count: issue_tags.length,
        has_note: !!notes,
        would_make_again: would_make_again ?? null,
      });

      const { data: scoresRow } = await supabase
        .from("user_taste_scores")
        .select("scores_json")
        .eq("owner_id", user.id)
        .maybeSingle();

      const currentModel = (scoresRow?.scores_json as TasteModel | null) ?? null;

      const features = extractRecipeFeatures({
        title: recipe.title ?? "",
        tags: Array.isArray(recipe.tags) ? (recipe.tags as string[]) : [],
        ingredients: ingredientNames,
        dishFamily: (version?.dish_family as string | null) ?? null,
      });

      const updatedModel = applyPostCookFeedback(
        currentModel,
        { overall_outcome, would_make_again: would_make_again ?? null, issue_tags, notes: notes ?? null },
        features
      );

      await supabase
        .from("user_taste_scores")
        .upsert(
          { owner_id: user.id, scores_json: updatedModel, updated_at: new Date().toISOString() },
          { onConflict: "owner_id" }
        );

      // Invalidate cached taste profile so next AI generation call rebuilds it
      await supabase
        .from("user_taste_profiles")
        .update({ updated_at: new Date(0).toISOString() })
        .eq("owner_id", user.id);

      // Invalidate in-process learned-signal cache
      invalidateLearnedSignalsCache(user.id);

      await trackServerEvent(supabase, user.id, "learned_signal_generated", {
        recipe_version_id: versionId,
        trigger: "postcook_feedback",
      });
    } catch (err) {
      console.error("Failed to update taste scores from post-cook feedback", err);
    }
  })();

  return NextResponse.json({ ok: true, id: inserted.id, created_at: inserted.created_at });
}
```

Note: This imports `invalidateLearnedSignalsCache` from `@/lib/ai/learnedSignals` which does not exist until Task 9. Typecheck will fail until Task 9 is complete — that is expected.

- [ ] **Step 2: Commit (pre-typecheck — expected to fail until Task 9)**

```bash
git add "app/api/recipes/[id]/versions/[versionId]/postcook/route.ts"
git commit -m "feat: wire postcook route to update taste scores, caches, and telemetry"
```

---

## Task 9: Refactor userTasteProfile to consume learned scores

**Files:**
- Modify: `lib/ai/userTasteProfile.ts`

Add `summarizeLearnedScores` (pure, testable) and wire `buildUserTasteSummary` to query `user_taste_scores` as a fifth parallel input.

- [ ] **Step 1: Add the import for tasteModel at the top of userTasteProfile.ts**

In `lib/ai/userTasteProfile.ts`, add this import at the top (after the existing `import type { SupabaseClient } ...`):

```typescript
import { getOverallConfidenceLevel, applyDecay, type TasteModel } from "@/lib/ai/tasteModel";
```

- [ ] **Step 2: Add the summarizeLearnedScores function before getCachedUserTasteSummary**

In `lib/ai/userTasteProfile.ts`, add this function before the `getCachedUserTasteSummary` export:

```typescript
/**
 * Derive a human-readable summary from structured learned taste scores.
 * Returns empty string when evidence is too sparse (confidence === "low").
 * Uses hedged language at "medium" confidence, direct language at "high".
 */
export function summarizeLearnedScores(
  model: TasteModel | null,
  confidence: "low" | "medium" | "high"
): string {
  if (!model || confidence === "low") return "";

  const hedged = confidence === "medium";
  const MIN_SCORE = 0.35;
  const MIN_CONF = 0.25;
  const parts: string[] = [];

  if (model.spiceTolerance && model.spiceTolerance.confidence >= MIN_CONF) {
    if (model.spiceTolerance.score <= -MIN_SCORE) {
      parts.push(hedged ? "Tends to prefer lower spice levels." : "Consistently prefers low spice.");
    } else if (model.spiceTolerance.score >= MIN_SCORE) {
      parts.push(hedged ? "Seems to enjoy spicier dishes." : "Consistently enjoys spicy dishes.");
    }
  }

  if (model.richnessPreference && model.richnessPreference.confidence >= MIN_CONF) {
    if (model.richnessPreference.score <= -MIN_SCORE) {
      parts.push(hedged ? "Often finds heavy dishes too much." : "Consistently prefers lighter meals.");
    } else if (model.richnessPreference.score >= MIN_SCORE) {
      parts.push(hedged ? "Seems to enjoy richer, creamier dishes." : "Consistently enjoys rich flavors.");
    }
  }

  if (
    model.complexityTolerance &&
    model.complexityTolerance.confidence >= MIN_CONF &&
    model.complexityTolerance.score <= -MIN_SCORE
  ) {
    parts.push(hedged ? "Tends to prefer simpler recipes." : "Consistently prefers lower-step recipes.");
  }

  if (model.flavorIntensityPreference && model.flavorIntensityPreference.confidence >= MIN_CONF) {
    if (model.flavorIntensityPreference.score >= MIN_SCORE) {
      parts.push(hedged ? "Often wants bolder seasoning." : "Consistently prefers boldly seasoned dishes.");
    } else if (model.flavorIntensityPreference.score <= -MIN_SCORE) {
      parts.push(hedged ? "Often prefers restrained seasoning." : "Consistently prefers lightly seasoned dishes.");
    }
  }

  if (parts.length === 0) return "";
  return "Based on cooking outcomes: " + parts.join(" ");
}
```

- [ ] **Step 3: Add the user_taste_scores query to the parallel Promise.all in buildUserTasteSummary**

In `buildUserTasteSummary`, after the existing `const conversationQuery = ...` line, add:

```typescript
  const tasteScoresQuery = supabase
    .from("user_taste_scores")
    .select("scores_json, updated_at")
    .eq("owner_id", ownerId)
    .maybeSingle();
```

Then replace the existing `const [preferencesResult, ...] = await Promise.all([...])` call with:

```typescript
  const [preferencesResult, recipesResult, eventsResult, conversationResult, tasteScoresResult] =
    await Promise.all([
      preferencesQuery ?? Promise.resolve({ data: null, error: null }),
      recipesQuery ?? Promise.resolve({ data: [], error: null }),
      eventsQuery ?? Promise.resolve({ data: [], error: null }),
      conversationQuery ?? Promise.resolve({ data: [], error: null }),
      tasteScoresQuery,
    ]);
```

- [ ] **Step 4: Wire learned score summary into combinedSummary**

In `buildUserTasteSummary`, after the `const inferred = summarizeInferred(...)` call, add:

```typescript
  const tasteScoresRow = (tasteScoresResult as { data?: { scores_json?: unknown; updated_at?: string } | null })?.data;
  const rawModel = tasteScoresRow?.scores_json as TasteModel | null ?? null;
  const daysSinceScoreUpdate = tasteScoresRow?.updated_at
    ? (Date.now() - new Date(tasteScoresRow.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const tasteModel = rawModel ? applyDecay(rawModel, daysSinceScoreUpdate) : null;
  const tasteConfidence = getOverallConfidenceLevel(tasteModel);
  const learnedSummary = summarizeLearnedScores(tasteModel, tasteConfidence);
```

Then update the `combinedSummary` line:

```typescript
  const combinedSummary = [explicitSummary, inferred.summary, learnedSummary].filter(Boolean).join(" ");
```

- [ ] **Step 5: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors. (This also resolves the pending import in the postcook route from Task 8.)

- [ ] **Step 6: Run all unit tests**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/userTasteProfile.ts
git commit -m "feat: refactor userTasteProfile to read learned taste scores"
```

---

## Task 10: Shared learned-signal interface and delivery

**Files:**
- Create: `lib/ai/learnedSignals.ts`
- Test: `tests/unit/learnedSignals.test.ts`

This module is the single shared interface that Plans B–E consume. `deriveLearnedPatterns` is a pure function exported for tests. `getLearnedSignals` is the async, server-only delivery path with a 5-minute TTL cache. `invalidateLearnedSignalsCache` is called by the postcook route after updating taste scores.

- [ ] **Step 1: Write failing tests**

Create `tests/unit/learnedSignals.test.ts`:

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { deriveLearnedPatterns } from "../../lib/ai/learnedSignals";
import type { TasteModel, TasteScore } from "../../lib/ai/tasteModel";

function score(val: number, conf = 0.5): TasteScore {
  return { score: val, confidence: conf, evidenceCount: 3, lastUpdatedAt: new Date().toISOString() };
}

const emptyModel: TasteModel = {
  cuisines: {},
  proteins: {},
  flavors: {},
  dishFamilies: {},
  dislikedIngredients: {},
  spiceTolerance: null,
  richnessPreference: null,
};

test("deriveLearnedPatterns returns empty patterns for null model", () => {
  const result = deriveLearnedPatterns(null);
  assert.equal(result.patterns.length, 0);
  assert.equal(result.overallConfidence, "low");
});

test("deriveLearnedPatterns returns empty patterns for empty model", () => {
  const result = deriveLearnedPatterns(emptyModel);
  assert.equal(result.patterns.length, 0);
});

test("deriveLearnedPatterns detects low-spice preference", () => {
  const model: TasteModel = { ...emptyModel, spiceTolerance: score(-0.6) };
  const result = deriveLearnedPatterns(model);
  const pattern = result.patterns.find((p) => p.key === "prefers_low_spice");
  assert.ok(pattern, "should emit prefers_low_spice pattern");
  assert.equal(pattern!.direction, "negative");
});

test("deriveLearnedPatterns detects richness aversion", () => {
  const model: TasteModel = { ...emptyModel, richnessPreference: score(-0.5) };
  const result = deriveLearnedPatterns(model);
  const pattern = result.patterns.find((p) => p.key === "prefers_lighter_dishes");
  assert.ok(pattern, "should emit prefers_lighter_dishes pattern");
});

test("deriveLearnedPatterns detects complexity aversion", () => {
  const model: TasteModel = { ...emptyModel, complexityTolerance: score(-0.55) };
  const result = deriveLearnedPatterns(model);
  const pattern = result.patterns.find((p) => p.key === "prefers_simpler_recipes");
  assert.ok(pattern, "should emit prefers_simpler_recipes pattern");
});

test("deriveLearnedPatterns detects bold flavor preference", () => {
  const model: TasteModel = { ...emptyModel, flavorIntensityPreference: score(+0.5) };
  const result = deriveLearnedPatterns(model);
  const pattern = result.patterns.find((p) => p.key === "prefers_bold_flavors");
  assert.ok(pattern, "should emit prefers_bold_flavors pattern");
});

test("deriveLearnedPatterns does not emit patterns for weak scores (below threshold)", () => {
  const model: TasteModel = { ...emptyModel, spiceTolerance: score(-0.1) };
  const result = deriveLearnedPatterns(model);
  assert.equal(result.patterns.length, 0, "score too weak to emit a pattern");
});

test("deriveLearnedPatterns does not emit patterns for low confidence", () => {
  const model: TasteModel = { ...emptyModel, spiceTolerance: score(-0.8, 0.1) };
  const result = deriveLearnedPatterns(model);
  assert.equal(result.patterns.length, 0, "confidence too low to emit a pattern");
});

test("deriveLearnedPatterns includes cuisine and protein patterns when scored", () => {
  const model: TasteModel = {
    ...emptyModel,
    cuisines: { italian: score(0.7) },
    proteins: { chicken: score(0.6) },
  };
  const result = deriveLearnedPatterns(model);
  assert.ok(result.patterns.some((p) => p.key === "prefers_italian"));
  assert.ok(result.patterns.some((p) => p.key === "prefers_chicken"));
});

test("deriveLearnedPatterns always returns a valid generatedAt ISO timestamp", () => {
  const result = deriveLearnedPatterns(null);
  assert.ok(typeof result.generatedAt === "string");
  assert.ok(new Date(result.generatedAt).getTime() > 0);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | grep -i "learnedSignals\|cannot find" | head -5
```

Expected: module not found.

- [ ] **Step 3: Create learnedSignals.ts**

Create `lib/ai/learnedSignals.ts`:

```typescript
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyDecay,
  getOverallConfidenceLevel,
  type TasteModel,
  type TasteScore,
} from "@/lib/ai/tasteModel";

// ── Public types ──────────────────────────────────────────────────────────────

export type LearnedPattern = {
  /** Machine-readable key — stable across deploys, used by consumers for filtering */
  key: string;
  /** Human-readable label — safe to show users when personalization is visible */
  label: string;
  confidence: "low" | "medium" | "high";
  direction: "positive" | "negative";
};

export type LearnedSignals = {
  patterns: LearnedPattern[];
  overallConfidence: "low" | "medium" | "high";
  generatedAt: string;
};

// ── Freshness model: in-process TTL cache with explicit invalidation ──────────
//
// Delivery model: cached-summary-with-invalidation (same pattern as user_taste_profiles).
// TTL: 5 minutes. Invalidated explicitly when postcook feedback updates taste scores.
// Cross-isolate consistency: eventual (max 5 min staleness) — same tradeoff as taste profiles.

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { signals: LearnedSignals; cachedAt: number }>();

/** Call after updating user_taste_scores to keep the signal cache fresh. */
export function invalidateLearnedSignalsCache(ownerId: string): void {
  cache.delete(ownerId);
}

/**
 * Get learned patterns for a user.
 * Reads from user_taste_scores, applies lazy decay, derives patterns, and caches.
 * Returns empty patterns gracefully for new users with no cook history.
 */
export async function getLearnedSignals(
  supabase: SupabaseClient,
  ownerId: string
): Promise<LearnedSignals> {
  const cached = cache.get(ownerId);
  if (cached && Date.now() - cached.cachedAt < TTL_MS) {
    return cached.signals;
  }

  const { data: row } = await supabase
    .from("user_taste_scores")
    .select("scores_json, updated_at")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const raw = (row?.scores_json as TasteModel | null) ?? null;
  const daysSince = row?.updated_at
    ? (Date.now() - new Date(row.updated_at as string).getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const model = raw ? applyDecay(raw, daysSince) : null;

  const signals = deriveLearnedPatterns(model);
  cache.set(ownerId, { signals, cachedAt: Date.now() });
  return signals;
}

// ── Pattern derivation (pure — safe to call in tests) ─────────────────────────

const MIN_SCORE = 0.35;
const MIN_CONF = 0.25;

function meets(s: TasteScore | null | undefined, direction: "positive" | "negative"): boolean {
  if (!s || s.confidence < MIN_CONF) return false;
  return direction === "positive" ? s.score >= MIN_SCORE : s.score <= -MIN_SCORE;
}

/**
 * Derive labeled learned patterns from a TasteModel snapshot.
 * Pure function — no I/O. Exported for tests and for summarizeLearnedScores.
 *
 * These are descriptive ranking signals, not hard user facts.
 * Downstream consumers use `key` for filtering and `label` for display.
 */
export function deriveLearnedPatterns(model: TasteModel | null): LearnedSignals {
  const generatedAt = new Date().toISOString();

  if (!model) {
    return { patterns: [], overallConfidence: "low", generatedAt };
  }

  const overallConfidence = getOverallConfidenceLevel(model);
  const patterns: LearnedPattern[] = [];

  function add(key: string, label: string, direction: "positive" | "negative") {
    patterns.push({ key, label, confidence: overallConfidence, direction });
  }

  // Spice tolerance
  if (meets(model.spiceTolerance, "negative")) {
    add("prefers_low_spice", "Tends to prefer lower spice levels", "negative");
  } else if (meets(model.spiceTolerance, "positive")) {
    add("enjoys_spicy", "Tends to enjoy spicier dishes", "positive");
  }

  // Richness preference
  if (meets(model.richnessPreference, "negative")) {
    add("prefers_lighter_dishes", "Often avoids overly heavy dishes", "negative");
  } else if (meets(model.richnessPreference, "positive")) {
    add("enjoys_rich_dishes", "Tends to enjoy richer, creamier dishes", "positive");
  }

  // Complexity tolerance
  if (meets(model.complexityTolerance, "negative")) {
    add("prefers_simpler_recipes", "Repeatedly improves for less complexity", "negative");
  }

  // Flavor intensity
  if (meets(model.flavorIntensityPreference, "positive")) {
    add("prefers_bold_flavors", "Often wants bolder, well-seasoned dishes", "positive");
  } else if (meets(model.flavorIntensityPreference, "negative")) {
    add("prefers_light_seasoning", "Often prefers more restrained seasoning", "negative");
  }

  // Top cuisine preferences (up to 2, positive only)
  const topCuisines = Object.entries(model.cuisines)
    .filter(([, s]) => s.score >= MIN_SCORE && s.confidence >= MIN_CONF)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 2);
  for (const [cuisine] of topCuisines) {
    add(`prefers_${cuisine}`, `Responds well to ${cuisine}-style cooking`, "positive");
  }

  // Top protein preference (up to 1, positive only)
  const topProteins = Object.entries(model.proteins)
    .filter(([, s]) => s.score >= MIN_SCORE && s.confidence >= MIN_CONF)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 1);
  for (const [protein] of topProteins) {
    add(`prefers_${protein}`, `Responds well to ${protein}-based dinners`, "positive");
  }

  return { patterns, overallConfidence, generatedAt };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | tail -20
```

Expected: all tests pass (10 new learned-signal tests + all prior).

- [ ] **Step 5: Full typecheck (resolves postcook route import too)**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/learnedSignals.ts tests/unit/learnedSignals.test.ts
git commit -m "feat: add shared learned-signal interface with TTL cache and pure derivation"
```

---

## Task 11: Admin observability

**Files:**
- Modify: `lib/admin/adminData.ts`

Add a function returning post-cook learning coverage stats for the admin dashboard.

- [ ] **Step 1: Add PostCookCoverageStats type and getPostCookCoverageStats to adminData.ts**

At the end of `lib/admin/adminData.ts`, add:

```typescript
export type PostCookCoverageStats = {
  totalEvents: number;
  uniqueUsersWithEvents: number;
  recentEventsLast7Days: number;
  topIssueTags: Array<{ tag: string; count: number }>;
};

export async function getPostCookCoverageStats(): Promise<PostCookCoverageStats | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdminClient() as any;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: allEvents }, { data: recentEvents }] = await Promise.all([
    supabase.from("recipe_postcook_feedback").select("user_id, issues") as Promise<{
      data: Array<{ user_id: string; issues: string[] }> | null;
    }>,
    supabase
      .from("recipe_postcook_feedback")
      .select("id")
      .gte("created_at", sevenDaysAgo) as Promise<{ data: unknown[] | null }>,
  ]);

  if (!allEvents) return null;

  const uniqueUsers = new Set(allEvents.map((r) => r.user_id)).size;

  const tagCounts = new Map<string, number>();
  for (const row of allEvents) {
    for (const tag of row.issues ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topIssueTags = Array.from(tagCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  return {
    totalEvents: allEvents.length,
    uniqueUsersWithEvents: uniqueUsers,
    recentEventsLast7Days: recentEvents?.length ?? 0,
    topIssueTags,
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/adminData.ts
git commit -m "feat: add post-cook learning coverage stats to admin data layer"
```

---

## Task 12: Full test run, lint, and verification

- [ ] **Step 1: Run full unit test suite**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit
```

Expected: all tests pass. If any fail, fix before continuing.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Lint**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run lint 2>&1 | tail -10
```

Expected: 0 errors (warnings acceptable). Fix any errors before continuing.

- [ ] **Step 4: Commit any fixes**

If there were fixes: `git add -A && git commit -m "fix: Plan A QA pass"`

---

## Task 13: Rollout checklist

**Files:**
- Create: `docs/m4-plan-a-rollout-checklist.md`

- [ ] **Step 1: Create the checklist**

Create `docs/m4-plan-a-rollout-checklist.md`:

```markdown
# Milestone 4 Plan A — Rollout Checklist

## Pre-launch

- [ ] `docs/m4-learning-authority.md` reviewed by backend lead + PM
- [ ] `recipe_postcook_feedback` migration applied and verified in staging
- [ ] RLS policies confirmed: owner-only insert + select
- [ ] All five M4 flags added to `feature_flags` table with initial value `false`

## API verification

- [ ] `POST /api/recipes/{id}/versions/{versionId}/postcook` accepts a valid payload
- [ ] Rejects unknown `overall_outcome` with 400
- [ ] Rejects unknown issue tags with 400
- [ ] Rejects duplicate within 30s window with 409
- [ ] Accepts a second legitimate submission after 30s window
- [ ] Returns `{ ok: true, id, created_at }` on success

## Taste-score wiring

- [ ] Submitting post-cook feedback updates `user_taste_scores` for that user
- [ ] `user_taste_profiles.updated_at` is set to epoch after successful feedback (invalidated)
- [ ] Next call to `getCachedUserTasteSummary` triggers a full rebuild
- [ ] Learned score summary text appears in taste profile when confidence ≥ medium

## Learned-signal interface

- [ ] `getLearnedSignals` returns patterns for a user with ≥ 3 cook events
- [ ] Returns empty patterns gracefully for a brand-new user
- [ ] `invalidateLearnedSignalsCache` clears the in-process cache entry
- [ ] Plans B–E can import `getLearnedSignals` and `LearnedSignals` from `lib/ai/learnedSignals`

## Observability

- [ ] `postcook_feedback_submitted` events appear in `product_events` after feedback
- [ ] `learned_signal_generated` events appear in `product_events` after successful score update
- [ ] `getPostCookCoverageStats()` returns sensible data from admin layer

## Rollback plan

1. Set `postcook_feedback_v1` flag to `false` in the `feature_flags` table
2. Frontend flag check prevents new submissions reaching the API route
3. Existing `recipe_postcook_feedback` rows are inert if the flag is off
4. `user_taste_scores` and `recipe_feedback` continue working normally
5. If taste-score corruption is suspected: set `scores_json = null` for affected user in
   `user_taste_scores` — scores rebuild from lightweight feedback on next generation call

## Downstream readiness gates for Plans B–E

- [ ] `recipe_postcook_feedback` table has events from at least one test user
- [ ] `user_taste_scores` is being updated from postcook events end-to-end
- [ ] `learnedSignals.ts` interface is importable and stable
- [ ] Authority boundary doc is current and has been reviewed
```

- [ ] **Step 2: Commit**

```bash
git add docs/m4-plan-a-rollout-checklist.md
git commit -m "docs: add Plan A rollout checklist and rollback plan"
```

---

## Self-review

**Spec coverage check:**

| A-ticket requirement | Covered |
|---|---|
| A1.1 — Authority boundary doc | Task 1 |
| A1.2 — Module audit + storage decision | Task 1 (doc includes audit table + locked storage decision) |
| A1.3 — Authority boundaries between all systems | Task 1 |
| A2.1 — Post-cook type system | Task 2 |
| A2.2 — recipe_postcook_feedback event table | Task 3 |
| A2.3 — Duplicate/repeated-event policy | Task 3 (migration comments) + Task 5 (30s guard) |
| A3.1 — Post-cook API route | Tasks 5 + 8 |
| A3.2 — API tests | Task 2 (schema tests) + Task 7 (mapping tests as integration coverage) |
| A4.1 — Mapping layer design | Task 7 (design comment in applyPostCookFeedback.ts) |
| A4.2 — Mapping implementation | Task 7 |
| A4.3 — Mapping tests | Task 7 |
| A5.1 — userTasteProfile reads learned scores | Task 9 |
| A5.2 — Sparse-data behavior | Task 9 (summarizeLearnedScores returns "" for "low" confidence) |
| A6.1 — Shared learned-signal interface | Task 10 |
| A6.2 — Freshness/delivery model | Task 10 (TTL cache + invalidation, documented in file comment) |
| A6.3 — Implement delivery path | Task 10 |
| A7.1 — M4 feature flags | Task 4 |
| A7.2 — Telemetry | Task 8 (two `trackServerEvent` calls) |
| A7.3 — Admin observability | Task 11 |
| A7.4 — QA coverage | Task 12 (test run) + individual test steps throughout |
| A7.5 — Rollout checklist | Task 13 |

**Placeholder scan:** None. Every step has exact file paths, complete code blocks, or exact shell commands with expected output.

**Type consistency:**
- `PostCookFeedback` defined in Task 2 → used in Tasks 7, 8, 9 ✓
- `PostCookIssueTag` / `POST_COOK_ISSUE_TAGS` defined in Task 2 → used in route (Task 5, 8) ✓
- `TasteModel.complexityTolerance` / `.flavorIntensityPreference` added in Task 6 → used in Tasks 7, 9, 10 ✓
- `applyPostCookFeedback(model, feedback, features)` signature consistent across Tasks 7 and 8 ✓
- `invalidateLearnedSignalsCache(ownerId)` defined in Task 10 → imported in Task 8 ✓
- `deriveLearnedPatterns(model)` defined and exported in Task 10 → tested in Task 10 ✓
- `summarizeLearnedScores(model, confidence)` defined in Task 9 → used in same file ✓
- `LearnedSignals` / `LearnedPattern` exported from Task 10 → available for Plans B–E ✓

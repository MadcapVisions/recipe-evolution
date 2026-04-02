# M4 Plan D: Product Consumers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire learned post-cook signals into three product surfaces: Improve with Max (post-cook context injection), Library Resurfacing (smart revisit shelf), and Create Personalization (suggestion chips on the new recipe form).

**Architecture:** Each surface is independently flag-gated. D1 adds `postCookContext` to the existing improve-recipe pipeline via a new formatter module; D2 adds a resurfacing data layer and a new shelf component injected into `RecipesBrowser`; D3 adds a pure suggestion mapper and chips into `NewRecipeForm`. All three surfaces remain no-ops when their flags are off — no existing behavior changes.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (server client), `node:test` + `node:assert/strict`, Tailwind CSS v3, `getFeatureFlag` + `FEATURE_FLAG_KEYS`, `getLearnedSignals` from `lib/ai/learnedSignals`.

---

## File map

| Action | File | Responsibility |
|---|---|---|
| Create | `lib/ai/feedback/buildPostCookImproveContext.ts` | Pure `formatPostCookImproveContext` + async `buildPostCookImproveContext` DB query |
| Create | `tests/unit/buildPostCookImproveContext.test.ts` | 6 unit tests for the pure formatter |
| Modify | `lib/ai/improveRecipe.ts` | Add `postCookContext?: string \| null` to `ImproveRecipeInput`, inject into system prompt |
| Modify | `app/api/ai/improve-recipe/route.ts` | Add flag check + `buildPostCookImproveContext` call in Promise.all |
| Create | `lib/recipes/resurfacingData.ts` | `getResurfacingData(supabase, ownerId)` — queries `recipe_postcook_feedback` for shelf data |
| Create | `components/recipes/LibraryResurfacingShelf.tsx` | Client component rendering two shelves: "worth repeating" + "needs another pass" |
| Modify | `components/recipes/RecipesBrowser.tsx` | Add `resurfacingShelf?: ResurfacingData` prop; render `LibraryResurfacingShelf` when data present |
| Modify | `app/recipes/page.tsx` | Add `LIBRARY_RESURFACING_V1` flag check + `getResurfacingData` call; pass to `RecipesBrowser` |
| Create | `lib/postcook/buildCreateSuggestions.ts` | Pure `mapPatternsToSuggestions` + server-only `buildCreateSuggestions` |
| Create | `tests/unit/buildCreateSuggestions.test.ts` | 7 unit tests for the pure mapper |
| Modify | `components/forms/NewRecipeForm.tsx` | Add `suggestions?: string[]` prop; render clickable suggestion chips |
| Modify | `app/recipes/new/page.tsx` | Add `CREATE_PERSONALIZATION_V1` flag check + `buildCreateSuggestions` call |
| Create | `docs/m4-plan-d-rollout-checklist.md` | Launch + rollback checklist for Plan D |

---

## Task 1: Post-cook context formatter module + tests

**Files:**
- Create: `lib/ai/feedback/buildPostCookImproveContext.ts`
- Create: `tests/unit/buildPostCookImproveContext.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/buildPostCookImproveContext.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatPostCookImproveContext } from "../../lib/ai/feedback/buildPostCookImproveContext.ts";
import type { PostCookFeedback } from "../../lib/ai/feedback/postCookFeedbackTypes.ts";

describe("formatPostCookImproveContext", () => {
  it("returns null for null input", () => {
    assert.equal(formatPostCookImproveContext(null), null);
  });

  it("includes outcome in output", () => {
    const fb: PostCookFeedback = {
      overall_outcome: "great",
      would_make_again: true,
      issue_tags: [],
      notes: null,
    };
    const result = formatPostCookImproveContext(fb);
    assert.ok(result?.includes("great"));
  });

  it("includes issue tags when present", () => {
    const fb: PostCookFeedback = {
      overall_outcome: "disappointing",
      would_make_again: false,
      issue_tags: ["too_spicy", "too_heavy"],
      notes: null,
    };
    const result = formatPostCookImproveContext(fb);
    assert.ok(result?.includes("too_spicy"));
    assert.ok(result?.includes("too_heavy"));
  });

  it("includes notes when present", () => {
    const fb: PostCookFeedback = {
      overall_outcome: "good_with_changes",
      would_make_again: true,
      issue_tags: [],
      notes: "Needs more garlic.",
    };
    const result = formatPostCookImproveContext(fb);
    assert.ok(result?.includes("Needs more garlic."));
  });

  it("omits notes section when notes is null", () => {
    const fb: PostCookFeedback = {
      overall_outcome: "great",
      would_make_again: null,
      issue_tags: [],
      notes: null,
    };
    const result = formatPostCookImproveContext(fb);
    assert.ok(!result?.toLowerCase().includes("notes:"));
  });

  it("includes would_make_again=false signal", () => {
    const fb: PostCookFeedback = {
      overall_outcome: "failed",
      would_make_again: false,
      issue_tags: [],
      notes: null,
    };
    const result = formatPostCookImproveContext(fb);
    assert.ok(result?.includes("would not make again"));
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution
npm run test:unit 2>&1 | grep -A 5 "buildPostCookImproveContext"
```

Expected: `Error: Cannot find module` or similar import failure.

- [ ] **Step 3: Implement the module**

```typescript
// lib/ai/feedback/buildPostCookImproveContext.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostCookFeedback } from "@/lib/ai/feedback/postCookFeedbackTypes";

/**
 * Formats a post-cook feedback record into a concise context string for the
 * improve-recipe system prompt. Pure function — safe to call in tests.
 * Returns null if feedback is null (no prior cook event for this version).
 */
export function formatPostCookImproveContext(
  feedback: PostCookFeedback | null
): string | null {
  if (!feedback) return null;

  const lines: string[] = [
    `The user previously cooked this version and rated it: ${feedback.overall_outcome}.`,
  ];

  if (feedback.would_make_again === false) {
    lines.push("They indicated they would not make this recipe again as-is.");
  }

  if (feedback.issue_tags.length > 0) {
    lines.push(`Issues they flagged: ${feedback.issue_tags.join(", ")}.`);
  }

  if (feedback.notes) {
    lines.push(`Their notes: "${feedback.notes}"`);
  }

  lines.push(
    "Use this context to make your improvement directly address their experience. Do not mention that you received feedback — just incorporate it."
  );

  return lines.join(" ");
}

/**
 * Fetches the most recent post-cook feedback for a specific recipe version.
 * Returns null if no feedback has been submitted for this version.
 */
export async function buildPostCookImproveContext(
  supabase: SupabaseClient,
  recipeId: string,
  versionId: string,
  ownerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("recipe_postcook_feedback")
    .select("overall_outcome, issue_tags, would_make_again, notes")
    .eq("recipe_id", recipeId)
    .eq("version_id", versionId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const feedback: PostCookFeedback = {
    overall_outcome: data.overall_outcome as PostCookFeedback["overall_outcome"],
    issue_tags: (data.issue_tags as PostCookFeedback["issue_tags"]) ?? [],
    would_make_again: data.would_make_again as boolean | null,
    notes: data.notes as string | null,
  };

  return formatPostCookImproveContext(feedback);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:unit 2>&1 | grep -A 5 "buildPostCookImproveContext"
```

Expected: `6 passing`.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/feedback/buildPostCookImproveContext.ts tests/unit/buildPostCookImproveContext.test.ts
git commit -m "feat(d1): add buildPostCookImproveContext formatter + 6 tests"
```

---

## Task 2: Wire post-cook context into improve-recipe pipeline

**Files:**
- Modify: `lib/ai/improveRecipe.ts` (lines 27–42, ~357)
- Modify: `app/api/ai/improve-recipe/route.ts` (lines 22–35, ~70–112, ~160–201)

- [ ] **Step 1: Add `postCookContext` to `ImproveRecipeInput` in `lib/ai/improveRecipe.ts`**

Find the `type ImproveRecipeInput` declaration (line ~27) and add the new field:

```typescript
type ImproveRecipeInput = {
  instruction: string;
  userTasteSummary?: string;
  postCookContext?: string | null;
  sessionBrief?: CookingBrief | null;
  conversationHistory?: AIMessage[] | null;
  sessionMemory?: string | null;
  recipe: {
    title: string;
    servings: number | null;
    prep_time_min: number | null;
    cook_time_min: number | null;
    difficulty: string | null;
    ingredients: Array<{ name: string }>;
    steps: Array<{ text: string }>;
  };
};
```

- [ ] **Step 2: Inject `postCookContext` into the system prompt in `lib/ai/improveRecipe.ts`**

Find the system prompt block (line ~354–357) and add the post-cook context block immediately after the `userTasteSummary` line:

Old:
```typescript
      content: `${CHEF_SYSTEM_PROMPT}

User taste summary: ${input.userTasteSummary?.trim() || "No user taste summary available."}

${input.sessionMemory?.trim() ? `${input.sessionMemory.trim()}\n\n` : ""}
```

New:
```typescript
      content: `${CHEF_SYSTEM_PROMPT}

User taste summary: ${input.userTasteSummary?.trim() || "No user taste summary available."}

${input.postCookContext?.trim() ? `${input.postCookContext.trim()}\n\n` : ""}${input.sessionMemory?.trim() ? `${input.sessionMemory.trim()}\n\n` : ""}
```

- [ ] **Step 3: Add imports to `app/api/ai/improve-recipe/route.ts`**

Add at the top of the import block:

```typescript
import { buildPostCookImproveContext } from "@/lib/ai/feedback/buildPostCookImproveContext";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/ai/featureFlags";
```

- [ ] **Step 4: Add flag check + context query to the Promise.all in `app/api/ai/improve-recipe/route.ts`**

Find the big `Promise.all` array (lines ~71–112). Add two new entries at the end:

```typescript
    const [
      { data: ownedRecipe, error: recipeError },
      { data: ownedVersion, error: versionError },
      userTasteSummary,
      resolvedSessionBrief,
      resolvedPreviousAttempt,
      persistedTurns,
      persistedSessionState,
      improveWithFeedbackEnabled,
    ] = await Promise.all([
      access.supabase
        .from("recipes")
        .select("id")
        .eq("id", recipeId)
        .eq("owner_id", access.userId)
        .maybeSingle(),
      access.supabase
        .from("recipe_versions")
        .select("id, ingredients_json, steps_json, servings, prep_time_min, cook_time_min, difficulty")
        .eq("id", versionId)
        .eq("recipe_id", recipeId)
        .maybeSingle(),
      getCachedUserTasteSummary(access.supabase as SupabaseClient, access.userId),
      resolveRecipeSessionBrief(access.supabase as SupabaseClient, {
        ownerId: access.userId,
        recipeId,
        versionId,
      }),
      getLatestGenerationAttempt(access.supabase as SupabaseClient, {
        ownerId: access.userId,
        conversationKey,
        scope: "recipe_detail",
      }),
      getConversationTurns(access.supabase as SupabaseClient, {
        ownerId: access.userId,
        conversationKey,
        scope: "recipe_detail",
      }),
      getCanonicalSessionState(access.supabase as SupabaseClient, {
        ownerId: access.userId,
        conversationKey,
        scope: "recipe_detail",
      }),
      getFeatureFlag(FEATURE_FLAG_KEYS.IMPROVE_WITH_FEEDBACK_V1, false),
    ]);
```

- [ ] **Step 5: Fetch post-cook context when flag is on, then pass to `improveRecipe`**

After the Promise.all destructuring and before calling `improveRecipe`, add:

```typescript
    const postCookContext = improveWithFeedbackEnabled
      ? await buildPostCookImproveContext(
          access.supabase as SupabaseClient,
          recipeId,
          versionId,
          access.userId
        )
      : null;
```

Then add `postCookContext` to the `improveRecipe` call (line ~160):

```typescript
    const result = await improveRecipe({
      instruction,
      userTasteSummary,
      postCookContext,
      sessionBrief: resolvedSessionBrief,
      conversationHistory,
      sessionMemory,
      recipe: {
        // ...existing fields unchanged...
      },
    }, {
      supabase: access.supabase as SupabaseClient,
      userId: access.userId,
      conversationKey,
      recipeId,
      versionId,
    });
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck 2>&1 | grep -E "improveRecipe|buildPostCook|route"
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/improveRecipe.ts app/api/ai/improve-recipe/route.ts
git commit -m "feat(d1): inject post-cook context into improve-recipe pipeline"
```

---

## Task 3: Resurfacing data layer

**Files:**
- Create: `lib/recipes/resurfacingData.ts`

- [ ] **Step 1: Create the module**

```typescript
// lib/recipes/resurfacingData.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostCookOverallOutcome } from "@/lib/ai/feedback/postCookFeedbackTypes";

export type ResurfacingSuggestion = {
  recipeId: string;
  versionId: string;
  title: string;
  outcome: PostCookOverallOutcome;
  cookedAt: string;
};

export type ResurfacingData = {
  worthRepeating: ResurfacingSuggestion[];
  needsImprovement: ResurfacingSuggestion[];
};

type FeedbackRow = {
  recipe_id: string;
  version_id: string;
  overall_outcome: string;
  created_at: string;
  recipes: { title: string } | null;
};

function toSuggestion(row: FeedbackRow): ResurfacingSuggestion | null {
  if (!row.recipes?.title) return null;
  return {
    recipeId: row.recipe_id,
    versionId: row.version_id,
    title: row.recipes.title,
    outcome: row.overall_outcome as PostCookOverallOutcome,
    cookedAt: row.created_at,
  };
}

/**
 * Fetches post-cook feedback rows to populate smart library shelves.
 * Returns empty arrays gracefully for users with no cook history.
 */
export async function getResurfacingData(
  supabase: SupabaseClient,
  ownerId: string
): Promise<ResurfacingData> {
  const [worthResult, needsResult] = await Promise.all([
    supabase
      .from("recipe_postcook_feedback")
      .select("recipe_id, version_id, overall_outcome, created_at, recipes(title)")
      .eq("owner_id", ownerId)
      .in("overall_outcome", ["great", "good_with_changes"])
      .eq("would_make_again", true)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("recipe_postcook_feedback")
      .select("recipe_id, version_id, overall_outcome, created_at, recipes(title)")
      .eq("owner_id", ownerId)
      .in("overall_outcome", ["disappointing", "failed"])
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const worthRepeating = (worthResult.data ?? [])
    .map((r) => toSuggestion(r as FeedbackRow))
    .filter((s): s is ResurfacingSuggestion => s !== null);

  const needsImprovement = (needsResult.data ?? [])
    .map((r) => toSuggestion(r as FeedbackRow))
    .filter((s): s is ResurfacingSuggestion => s !== null);

  return { worthRepeating, needsImprovement };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep resurfacingData
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/recipes/resurfacingData.ts
git commit -m "feat(d2): add resurfacingData layer for library shelf"
```

---

## Task 4: Library resurfacing shelf component

**Files:**
- Create: `components/recipes/LibraryResurfacingShelf.tsx`

- [ ] **Step 1: Create the shelf component**

```typescript
// components/recipes/LibraryResurfacingShelf.tsx
"use client";

import Link from "next/link";
import type { ResurfacingData, ResurfacingSuggestion } from "@/lib/recipes/resurfacingData";

const OUTCOME_BADGE: Record<string, string> = {
  great: "Loved it",
  good_with_changes: "Good with tweaks",
  disappointing: "Needs work",
  failed: "Needs rethinking",
};

function ShelfItem({ item }: { item: ResurfacingSuggestion }) {
  const badge = OUTCOME_BADGE[item.outcome] ?? item.outcome;
  const href = `/recipes/${item.recipeId}/versions/${item.versionId}`;
  return (
    <Link
      href={href}
      className="flex min-w-[180px] max-w-[220px] flex-shrink-0 flex-col gap-1.5 rounded-[16px] border border-[rgba(79,54,33,0.1)] bg-white p-3.5 transition hover:shadow-sm"
    >
      <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-[color:var(--text)]">
        {item.title}
      </p>
      <span className="self-start rounded-full bg-[rgba(201,123,66,0.1)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--primary)]">
        {badge}
      </span>
    </Link>
  );
}

export function LibraryResurfacingShelf({ data }: { data: ResurfacingData }) {
  const hasWorth = data.worthRepeating.length > 0;
  const hasNeeds = data.needsImprovement.length > 0;

  if (!hasWorth && !hasNeeds) return null;

  return (
    <div className="space-y-4">
      {hasWorth && (
        <div>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
            Worth making again
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {data.worthRepeating.map((item) => (
              <ShelfItem key={`${item.recipeId}-${item.versionId}`} item={item} />
            ))}
          </div>
        </div>
      )}
      {hasNeeds && (
        <div>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
            Could use another pass
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {data.needsImprovement.map((item) => (
              <ShelfItem key={`${item.recipeId}-${item.versionId}`} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep LibraryResurfacingShelf
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/recipes/LibraryResurfacingShelf.tsx
git commit -m "feat(d2): add LibraryResurfacingShelf component"
```

---

## Task 5: Wire resurfacing shelf into RecipesBrowser and library page

**Files:**
- Modify: `components/recipes/RecipesBrowser.tsx`
- Modify: `app/recipes/page.tsx`

- [ ] **Step 1: Add import + prop to `RecipesBrowser.tsx`**

Add import at top of file:
```typescript
import { LibraryResurfacingShelf } from "@/components/recipes/LibraryResurfacingShelf";
import type { ResurfacingData } from "@/lib/recipes/resurfacingData";
```

Update the `RecipesBrowserProps` type:
```typescript
type RecipesBrowserProps = {
  initialRecipes: RecipeBrowseItem[];
  initialHasMore: boolean;
  resurfacingShelf?: ResurfacingData;
};
```

Update the function signature:
```typescript
export function RecipesBrowser({ initialRecipes, initialHasMore, resurfacingShelf }: RecipesBrowserProps) {
```

- [ ] **Step 2: Render the shelf in `RecipesBrowser.tsx`**

Find the `<section className="app-panel polish-card animate-rise-in p-4 sm:p-6">` block (the "My Recipes" heading section, line ~380). Add the shelf render immediately **after** the closing `</section>` tag:

```typescript
      </section>

      {resurfacingShelf && (
        (resurfacingShelf.worthRepeating.length > 0 || resurfacingShelf.needsImprovement.length > 0) && (
          <section className="app-panel polish-card p-4 sm:p-6">
            <LibraryResurfacingShelf data={resurfacingShelf} />
          </section>
        )
      )}
```

- [ ] **Step 3: Update `app/recipes/page.tsx` to fetch shelf data**

```typescript
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { RecipesBrowser } from "@/components/recipes/RecipesBrowser";
import { loadCachedRecipeBrowsePage } from "@/lib/recipeBrowseData";
import { getResurfacingData } from "@/lib/recipes/resurfacingData";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/ai/featureFlags";
import type { ResurfacingData } from "@/lib/recipes/resurfacingData";

export default async function RecipesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  let loadError: string | null = null;
  let initialRecipes: Awaited<ReturnType<typeof loadCachedRecipeBrowsePage>>["recipes"] = [];
  let initialHasMore = false;
  let resurfacingShelf: ResurfacingData | undefined;

  try {
    const [loaded, resurfacingEnabled] = await Promise.all([
      loadCachedRecipeBrowsePage(user.id, {
        tab: "active",
        sort: "recent",
        limit: 24,
        offset: 0,
      }),
      getFeatureFlag(FEATURE_FLAG_KEYS.LIBRARY_RESURFACING_V1, false),
    ]);
    initialRecipes = loaded.recipes;
    initialHasMore = loaded.hasMore;

    if (resurfacingEnabled) {
      resurfacingShelf = await getResurfacingData(supabase, user.id);
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load recipes.";
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-[1380px] p-6">
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{loadError}</div>
      </div>
    );
  }

  return (
    <RecipesBrowser
      initialRecipes={initialRecipes}
      initialHasMore={initialHasMore}
      resurfacingShelf={resurfacingShelf}
    />
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck 2>&1 | grep -E "RecipesBrowser|resurfacing|recipes/page"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/recipes/RecipesBrowser.tsx app/recipes/page.tsx
git commit -m "feat(d2): wire resurfacing shelf into library page"
```

---

## Task 6: Create personalization suggestion mapper + tests

**Files:**
- Create: `lib/postcook/buildCreateSuggestions.ts`
- Create: `tests/unit/buildCreateSuggestions.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/buildCreateSuggestions.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapPatternsToSuggestions } from "../../lib/postcook/buildCreateSuggestions.ts";
import type { LearnedPattern } from "../../lib/ai/learnedSignals.ts";

function makePattern(key: string, direction: "positive" | "negative" = "positive"): LearnedPattern {
  return { key, label: key, confidence: "medium", direction };
}

describe("mapPatternsToSuggestions", () => {
  it("returns empty array for empty patterns", () => {
    assert.deepEqual(mapPatternsToSuggestions([]), []);
  });

  it("maps prefers_low_spice to mild suggestion", () => {
    const result = mapPatternsToSuggestions([makePattern("prefers_low_spice", "negative")]);
    assert.ok(result.some((s) => s.toLowerCase().includes("mild") || s.toLowerCase().includes("gentle")));
  });

  it("maps enjoys_spicy to bold suggestion", () => {
    const result = mapPatternsToSuggestions([makePattern("enjoys_spicy")]);
    assert.ok(result.some((s) => s.toLowerCase().includes("spicy") || s.toLowerCase().includes("bold")));
  });

  it("maps prefers_simpler_recipes to quick suggestion", () => {
    const result = mapPatternsToSuggestions([makePattern("prefers_simpler_recipes", "negative")]);
    assert.ok(result.some((s) => s.toLowerCase().includes("simple") || s.toLowerCase().includes("quick")));
  });

  it("maps cuisine pattern to cuisine suggestion", () => {
    const result = mapPatternsToSuggestions([makePattern("prefers_italian")]);
    assert.ok(result.some((s) => s.toLowerCase().includes("italian")));
  });

  it("caps output at 5 suggestions", () => {
    const many: LearnedPattern[] = [
      makePattern("prefers_low_spice", "negative"),
      makePattern("prefers_lighter_dishes", "negative"),
      makePattern("prefers_simpler_recipes", "negative"),
      makePattern("prefers_bold_flavors"),
      makePattern("prefers_italian"),
      makePattern("prefers_chicken"),
      makePattern("prefers_light_seasoning", "negative"),
    ];
    const result = mapPatternsToSuggestions(many);
    assert.ok(result.length <= 5);
  });

  it("ignores unknown pattern keys gracefully", () => {
    const result = mapPatternsToSuggestions([makePattern("unknown_future_key")]);
    assert.deepEqual(result, []);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:unit 2>&1 | grep -A 5 "buildCreateSuggestions"
```

Expected: `Error: Cannot find module`.

- [ ] **Step 3: Implement the module**

```typescript
// lib/postcook/buildCreateSuggestions.ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLearnedSignals } from "@/lib/ai/learnedSignals";
import type { LearnedPattern } from "@/lib/ai/learnedSignals";

const PATTERN_SUGGESTIONS: Record<string, string> = {
  prefers_low_spice: "Mild & gentle flavors",
  enjoys_spicy: "Bold & spicy",
  prefers_lighter_dishes: "Light & fresh",
  enjoys_rich_dishes: "Rich & hearty",
  prefers_simpler_recipes: "Quick & simple",
  prefers_bold_flavors: "Big, bold flavors",
  prefers_light_seasoning: "Delicately seasoned",
};

const CUISINE_PREFIX = "prefers_";
const PROTEIN_PREFIX = "prefers_";

/**
 * Maps learned patterns to suggestion chip labels.
 * Pure function — safe to call in tests.
 */
export function mapPatternsToSuggestions(patterns: LearnedPattern[]): string[] {
  const suggestions: string[] = [];

  for (const pattern of patterns) {
    if (suggestions.length >= 5) break;

    // Static lookup first
    if (PATTERN_SUGGESTIONS[pattern.key]) {
      suggestions.push(PATTERN_SUGGESTIONS[pattern.key]!);
      continue;
    }

    // Dynamic cuisine patterns: prefers_italian → "Italian-style"
    if (pattern.key.startsWith(CUISINE_PREFIX) && pattern.direction === "positive") {
      const suffix = pattern.key.slice(CUISINE_PREFIX.length);
      // Only handle cuisine/protein keys that aren't already in the static map
      if (suffix && !["low_spice", "lighter_dishes", "simpler_recipes", "bold_flavors", "light_seasoning"].includes(suffix)) {
        const capitalized = suffix.charAt(0).toUpperCase() + suffix.slice(1);
        suggestions.push(`${capitalized}-style`);
      }
    }
  }

  return suggestions;
}

/**
 * Fetches learned signals for a user and returns personalized suggestion chip labels.
 * Returns empty array for new users with no cook history.
 */
export async function buildCreateSuggestions(
  supabase: SupabaseClient,
  ownerId: string
): Promise<string[]> {
  const signals = await getLearnedSignals(supabase, ownerId);
  if (signals.overallConfidence === "low") return [];
  return mapPatternsToSuggestions(signals.patterns);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:unit 2>&1 | grep -A 10 "buildCreateSuggestions"
```

Expected: `7 passing`.

- [ ] **Step 5: Commit**

```bash
git add lib/postcook/buildCreateSuggestions.ts tests/unit/buildCreateSuggestions.test.ts
git commit -m "feat(d3): add buildCreateSuggestions mapper + 7 tests"
```

---

## Task 7: Add suggestion chips to NewRecipeForm

**Files:**
- Modify: `components/forms/NewRecipeForm.tsx`

- [ ] **Step 1: Add `suggestions` prop and chip bar**

The `NewRecipeForm` component currently takes no props. Add the `suggestions` prop and render chips above the title field.

Update the function signature at line ~17:

```typescript
export function NewRecipeForm({ suggestions = [] }: { suggestions?: string[] }) {
```

Add `setValue` to the `useForm` destructuring (line ~21):

```typescript
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateRecipeWithVersionInput, unknown, CreateRecipeWithVersionValues>({
```

Add the chip bar immediately after the info callout `<div>` (after the closing `</div>` of the `rounded-[24px] bg-[rgba(201,123,66,0.08)]` div, around line ~94) and before the title `<div>`:

```typescript
      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-medium text-[color:var(--muted)]">
            Based on your cooking history:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  const current = (document.getElementById("description") as HTMLTextAreaElement | null)?.value ?? "";
                  setValue(
                    "description",
                    current ? `${current} ${suggestion.toLowerCase()}.` : `${suggestion}.`,
                    { shouldDirty: true }
                  );
                }}
                className="rounded-full border border-[rgba(79,54,33,0.15)] bg-[rgba(201,123,66,0.07)] px-3 py-1.5 text-[13px] font-semibold text-[color:var(--primary)] transition hover:bg-[rgba(201,123,66,0.14)]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep NewRecipeForm
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/forms/NewRecipeForm.tsx
git commit -m "feat(d3): add personalization suggestion chips to NewRecipeForm"
```

---

## Task 8: Wire suggestions into the Create page

**Files:**
- Modify: `app/recipes/new/page.tsx`

- [ ] **Step 1: Update the page to fetch suggestions**

```typescript
import { redirect } from "next/navigation";
import { NewRecipeForm } from "@/components/forms/NewRecipeForm";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/ai/featureFlags";
import { buildCreateSuggestions } from "@/lib/postcook/buildCreateSuggestions";

export default async function NewRecipePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  let suggestions: string[] = [];

  const createPersonalizationEnabled = await getFeatureFlag(
    FEATURE_FLAG_KEYS.CREATE_PERSONALIZATION_V1,
    false
  );

  if (createPersonalizationEnabled) {
    try {
      suggestions = await buildCreateSuggestions(supabase, user.id);
    } catch {
      // Non-critical: personalization failure should never block the create form
    }
  }

  return (
    <div className="mx-auto max-w-2xl page-shell">
      <div className="space-y-3">
        <p className="app-kicker">Create</p>
        <h1 className="page-title">Start a new dish</h1>
        <p className="max-w-2xl text-[16px] leading-7 text-[color:var(--muted)]">
          Capture the base recipe cleanly. You can refine it, save future versions, and build on it once it is in your cookbook.
        </p>
      </div>
      <NewRecipeForm suggestions={suggestions} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep -E "new/page|NewRecipeForm"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/recipes/new/page.tsx
git commit -m "feat(d3): wire personalization suggestions into Create page"
```

---

## Task 9: Full quality gate + rollout checklist

**Files:**
- No new files (just verification)
- Create: `docs/m4-plan-d-rollout-checklist.md`

- [ ] **Step 1: Run full unit test suite**

```bash
npm run test:unit 2>&1 | tail -5
```

Expected: all tests pass, count ≥ 614 (601 prior + 6 D1 + 7 D3).

- [ ] **Step 2: Run lint**

```bash
npm run lint 2>&1 | grep -v "^$" | head -20
```

Expected: no new errors.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck 2>&1 | grep -v "^$" | head -20
```

Expected: no errors.

- [ ] **Step 4: Create rollout checklist**

```markdown
# Milestone 4 Plan D — Product Consumers Rollout Checklist

## D1: Improve with Max post-cook context

- [ ] `IMPROVE_WITH_FEEDBACK_V1` feature flag exists and defaults to `false`
- [ ] `lib/ai/feedback/buildPostCookImproveContext.ts` exists and exports `formatPostCookImproveContext` (pure) + `buildPostCookImproveContext` (async)
- [ ] 6 formatter tests pass: `npm run test:unit 2>&1 | grep buildPostCookImproveContext`
- [ ] `ImproveRecipeInput` has `postCookContext?: string | null` field
- [ ] System prompt injects post-cook context block after user taste summary
- [ ] With flag off: `postCookContext` is null and system prompt is unchanged
- [ ] With flag on + prior feedback: context string appears in system prompt
- [ ] With flag on + no feedback: context is null, system prompt unaffected

## D2: Library resurfacing shelf

- [ ] `LIBRARY_RESURFACING_V1` feature flag exists and defaults to `false`
- [ ] `lib/recipes/resurfacingData.ts` exports `getResurfacingData` and `ResurfacingData` type
- [ ] `components/recipes/LibraryResurfacingShelf.tsx` renders shelf sections for each non-empty bucket
- [ ] `RecipesBrowser` accepts `resurfacingShelf?: ResurfacingData` prop
- [ ] With flag off: `RecipesBrowser` renders without shelf prop, no change
- [ ] With flag on + no cook history: shelf is undefined / component renders nothing
- [ ] With flag on + cook history: shelf rows visible above recipe grid
- [ ] Shelf item links point to correct `/recipes/{id}/versions/{versionId}`

## D3: Create personalization

- [ ] `CREATE_PERSONALIZATION_V1` feature flag exists and defaults to `false`
- [ ] `lib/postcook/buildCreateSuggestions.ts` exports `mapPatternsToSuggestions` (pure) + `buildCreateSuggestions` (server-only)
- [ ] 7 mapper tests pass: `npm run test:unit 2>&1 | grep buildCreateSuggestions`
- [ ] `NewRecipeForm` accepts `suggestions?: string[]` prop
- [ ] With flag off: `suggestions` is empty, no chips rendered
- [ ] With flag on + no signals (low confidence): no chips rendered
- [ ] With flag on + signals: chips visible; clicking chip appends to description field
- [ ] Personalization failure (network/DB error) is caught, form still loads

## Rollback plan

1. All Plan D code is additive — no existing behavior is removed
2. Set `IMPROVE_WITH_FEEDBACK_V1`, `LIBRARY_RESURFACING_V1`, `CREATE_PERSONALIZATION_V1` flags to `false` to disable all surfaces
3. `buildPostCookImproveContext` returns null on any DB error — improve-recipe pipeline unaffected
4. `buildCreateSuggestions` is wrapped in try/catch in the page — Create form always loads
5. `RecipesBrowser` renders normally when `resurfacingShelf` is undefined
```

Save this content to `docs/m4-plan-d-rollout-checklist.md`.

- [ ] **Step 5: Commit the checklist**

```bash
git add docs/m4-plan-d-rollout-checklist.md
git commit -m "docs: add M4 Plan D rollout checklist"
```

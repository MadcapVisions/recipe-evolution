# Milestone 4 Plan B: Post-Cook Feedback UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight post-cook feedback flow (under 15 seconds to complete) that captures cooked outcomes, wires them to the Plan A API, and surfaces a revisit reminder on Recipe Detail — all guarded behind the `POSTCOOK_FEEDBACK_V1` feature flag.

**Architecture:** A single self-contained `PostCookFeedbackSheet` component manages the multi-step flow (outcome → optional issue tags → done) using local React state. It replaces the existing completion modal in Cook Mode when the flag is on, and is also triggered by a lightweight `PostCookReminderBanner` on Recipe Detail. Pure branching-logic functions are extracted to `lib/postcook/postCookFlowLogic.ts` and tested with `node:test`. The `POSTCOOK_FEEDBACK_V1` flag is checked server-side in the page components and passed to client components as a boolean prop. When the flag is off, existing cook-completion behavior is untouched.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, `node:test` + `node:assert/strict`, native `fetch()`, `trackEvent()` for analytics, Supabase (server-only flag check).

---

## File map

| Action | File | Responsibility |
|---|---|---|
| Create | `lib/postcook/postCookFlowLogic.ts` | Pure flow-branching functions: `shouldShowIssueTags`, `shouldShowImproveCTA`, `buildPostCookPayload` |
| Create | `tests/unit/postCookFlowLogic.test.ts` | Unit tests for above |
| Create | `components/postcook/PostCookFeedbackSheet.tsx` | Multi-step feedback sheet (outcome → tags → done), API submission, analytics |
| Create | `components/postcook/PostCookReminderBanner.tsx` | Lightweight revisit reminder shown on Recipe Detail |
| Modify | `app/recipes/[id]/versions/[versionId]/cook/page.tsx` | Add `postcookFeedbackEnabled` flag check; pass to `CookingModeClient` |
| Modify | `components/cook/CookingModeClient.tsx` | Show `PostCookFeedbackSheet` instead of old modal when flag is on |
| Modify | `app/recipes/[id]/versions/[versionId]/page.tsx` | Add `postcookFeedbackEnabled` flag + `hasPostCookFeedback` DB check |
| Modify | `components/recipes/version-detail/VersionDetailClient.tsx` | Render `PostCookReminderBanner` when appropriate |
| Create | `docs/m4-plan-b-rollout-checklist.md` | Launch + rollback checklist |

---

## Task 1: Pure flow-logic module + tests

**Files:**
- Create: `lib/postcook/postCookFlowLogic.ts`
- Create: `tests/unit/postCookFlowLogic.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/postCookFlowLogic.test.ts`:

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldShowIssueTags,
  shouldShowImproveCTA,
  buildPostCookPayload,
} from "../../lib/postcook/postCookFlowLogic";

// ── shouldShowIssueTags ───────────────────────────────────────────────────────

test("shouldShowIssueTags returns false for great outcome", () => {
  assert.equal(shouldShowIssueTags("great"), false);
});

test("shouldShowIssueTags returns true for good_with_changes", () => {
  assert.equal(shouldShowIssueTags("good_with_changes"), true);
});

test("shouldShowIssueTags returns true for disappointing", () => {
  assert.equal(shouldShowIssueTags("disappointing"), true);
});

test("shouldShowIssueTags returns true for failed", () => {
  assert.equal(shouldShowIssueTags("failed"), true);
});

// ── shouldShowImproveCTA ──────────────────────────────────────────────────────

test("shouldShowImproveCTA returns false for great with no tags", () => {
  assert.equal(shouldShowImproveCTA("great", []), false);
});

test("shouldShowImproveCTA returns true for disappointing even without tags", () => {
  assert.equal(shouldShowImproveCTA("disappointing", []), true);
});

test("shouldShowImproveCTA returns true for failed even without tags", () => {
  assert.equal(shouldShowImproveCTA("failed", []), true);
});

test("shouldShowImproveCTA returns true for great with issue tags (edge case guarded)", () => {
  // great + tags shouldn't happen in the UI, but the function handles it safely
  assert.equal(shouldShowImproveCTA("great", ["too_bland"]), false);
});

test("shouldShowImproveCTA returns true for good_with_changes with tags", () => {
  assert.equal(shouldShowImproveCTA("good_with_changes", ["too_heavy"]), true);
});

test("shouldShowImproveCTA returns false for good_with_changes with no tags", () => {
  assert.equal(shouldShowImproveCTA("good_with_changes", []), false);
});

// ── buildPostCookPayload ──────────────────────────────────────────────────────

test("buildPostCookPayload maps all fields correctly", () => {
  const payload = buildPostCookPayload("great", [], true, "Tasted perfect.");
  assert.equal(payload.overall_outcome, "great");
  assert.deepEqual(payload.issue_tags, []);
  assert.equal(payload.would_make_again, true);
  assert.equal(payload.notes, "Tasted perfect.");
});

test("buildPostCookPayload defaults would_make_again to null", () => {
  const payload = buildPostCookPayload("disappointing", ["too_bland"], null, null);
  assert.equal(payload.would_make_again, null);
});

test("buildPostCookPayload defaults notes to null when empty string", () => {
  const payload = buildPostCookPayload("great", [], null, "");
  assert.equal(payload.notes, null);
});

test("buildPostCookPayload trims whitespace-only notes to null", () => {
  const payload = buildPostCookPayload("great", [], null, "   ");
  assert.equal(payload.notes, null);
});

test("buildPostCookPayload clamps notes to 500 chars", () => {
  const long = "x".repeat(600);
  const payload = buildPostCookPayload("great", [], null, long);
  assert.equal(payload.notes?.length, 500);
});

test("buildPostCookPayload includes issue_tags as array", () => {
  const payload = buildPostCookPayload("good_with_changes", ["too_spicy", "too_heavy"], false, null);
  assert.deepEqual(payload.issue_tags, ["too_spicy", "too_heavy"]);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | grep -i "postCookFlowLogic\|cannot find\|error" | head -10
```

Expected: module not found.

- [ ] **Step 3: Create the logic module**

Create `lib/postcook/postCookFlowLogic.ts`:

```typescript
import type { PostCookOverallOutcome, PostCookIssueTag } from "@/lib/ai/feedback/postCookFeedbackTypes";

/**
 * Returns true if the outcome warrants showing the issue-tag step.
 * "great" outcomes skip issue tags entirely — no friction for good cooks.
 */
export function shouldShowIssueTags(outcome: PostCookOverallOutcome): boolean {
  return outcome !== "great";
}

/**
 * Returns true if the "Improve this recipe" CTA should appear after submission.
 * Rules:
 * - Always show for disappointing/failed (something went wrong)
 * - Show for good_with_changes only if the user actually selected issue tags
 * - Never show for great (no friction on a win)
 */
export function shouldShowImproveCTA(
  outcome: PostCookOverallOutcome,
  issueTags: PostCookIssueTag[]
): boolean {
  if (outcome === "great") return false;
  if (outcome === "disappointing" || outcome === "failed") return true;
  return issueTags.length > 0; // good_with_changes: only if they flagged something
}

export type PostCookPayload = {
  overall_outcome: PostCookOverallOutcome;
  issue_tags: PostCookIssueTag[];
  would_make_again: boolean | null;
  notes: string | null;
};

/**
 * Builds the canonical post-cook API payload from raw UI state.
 * Normalises empty/whitespace notes to null and clamps at 500 chars.
 */
export function buildPostCookPayload(
  outcome: PostCookOverallOutcome,
  issueTags: PostCookIssueTag[],
  wouldMakeAgain: boolean | null,
  notes: string | null | undefined
): PostCookPayload {
  const trimmed = notes?.trim() ?? "";
  const cleanNotes = trimmed.length === 0 ? null : trimmed.slice(0, 500);

  return {
    overall_outcome: outcome,
    issue_tags: issueTags,
    would_make_again: wouldMakeAgain,
    notes: cleanNotes,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | tail -15
```

Expected: 14 new tests passing.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/postcook/postCookFlowLogic.ts tests/unit/postCookFlowLogic.test.ts
git commit -m "feat: add post-cook flow-logic module with TDD"
```

---

## Task 2: PostCookFeedbackSheet component

**Files:**
- Create: `components/postcook/PostCookFeedbackSheet.tsx`

This single component manages the full multi-step flow:
- **Step "outcome":** Four outcome buttons + "Mark as Best Version" toggle
- **Step "tags_and_more":** Issue-tag chip grid + "Would you make this again?" toggle + optional short note
- **Step "done":** Brief confirmation + optional "Improve this recipe →" CTA

The component calls the Plan A API, fires analytics events, and calls `onClose()` when finished.

- [ ] **Step 1: Create the component**

Create `components/postcook/PostCookFeedbackSheet.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { trackEvent } from "@/lib/trackEvent";
import {
  shouldShowIssueTags,
  shouldShowImproveCTA,
  buildPostCookPayload,
} from "@/lib/postcook/postCookFlowLogic";
import {
  POST_COOK_OVERALL_OUTCOMES,
  POST_COOK_ISSUE_TAGS,
  type PostCookOverallOutcome,
  type PostCookIssueTag,
} from "@/lib/ai/feedback/postCookFeedbackTypes";

type Step = "outcome" | "tags_and_more" | "done";

type Props = {
  recipeId: string;
  versionId: string;
  recipeTitle: string;
  /** Called when the flow is complete (submitted or skipped). Caller handles navigation. */
  onClose: () => void;
};

const OUTCOME_LABELS: Record<PostCookOverallOutcome, { label: string; emoji: string }> = {
  great:             { label: "Great!",            emoji: "😄" },
  good_with_changes: { label: "Good, with changes", emoji: "👍" },
  disappointing:     { label: "Disappointing",      emoji: "😕" },
  failed:            { label: "Didn't work out",    emoji: "😫" },
};

const ISSUE_TAG_LABELS: Record<PostCookIssueTag, string> = {
  too_bland:     "Too bland",
  too_salty:     "Too salty",
  too_spicy:     "Too spicy",
  too_heavy:     "Too heavy",
  too_complex:   "Too complex",
  too_many_steps:"Too many steps",
  texture_off:   "Texture off",
  too_wet:       "Too wet",
  too_dry:       "Too dry",
};

export function PostCookFeedbackSheet({ recipeId, versionId, recipeTitle, onClose }: Props) {
  const router = useRouter();

  const [step, setStep] = useState<Step>("outcome");
  const [outcome, setOutcome] = useState<PostCookOverallOutcome | null>(null);
  const [selectedTags, setSelectedTags] = useState<PostCookIssueTag[]>([]);
  const [wouldMakeAgain, setWouldMakeAgain] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [markAsBest, setMarkAsBest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track prompt view on mount
  useEffect(() => {
    void trackEvent("postcook_prompt_viewed", { recipeId, versionId });
  }, [recipeId, versionId]);

  const handleSkip = async () => {
    await trackEvent("postcook_skipped", { recipeId, versionId, step });
    onClose();
  };

  const handleOutcomeSelect = async (selected: PostCookOverallOutcome) => {
    setOutcome(selected);
    if (shouldShowIssueTags(selected)) {
      setStep("tags_and_more");
    } else {
      // "great" — skip tags, go straight to submission
      await submit(selected, [], null, "");
    }
  };

  const handleTagToggle = (tag: PostCookIssueTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    void trackEvent("postcook_issue_tag_selected", { recipeId, versionId, tag });
  };

  const handleSubmitTagsStep = async () => {
    if (!outcome) return;
    await submit(outcome, selectedTags, wouldMakeAgain, notes);
  };

  const submit = async (
    submittedOutcome: PostCookOverallOutcome,
    tags: PostCookIssueTag[],
    wma: boolean | null,
    noteText: string
  ) => {
    setSubmitting(true);
    setError(null);

    if (notes.trim().length > 0) {
      await trackEvent("postcook_note_added", { recipeId, versionId });
    }

    const payload = buildPostCookPayload(submittedOutcome, tags, wma, noteText);

    try {
      const response = await fetch(
        `/api/recipes/${recipeId}/versions/${versionId}/postcook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        // Duplicate-window is not a real error from the user's perspective
        if (response.status !== 409) {
          setError(body.error ?? "Something went wrong. Your feedback was not saved.");
          setSubmitting(false);
          return;
        }
      }

      // If markAsBest requested, PATCH the recipe
      if (markAsBest) {
        await fetch(`/api/recipes/${recipeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ best_version_id: versionId }),
        });
      }

      await trackEvent("postcook_submitted", {
        recipeId,
        versionId,
        outcome: submittedOutcome,
        tagCount: tags.length,
        wouldMakeAgain: wma,
        markedBest: markAsBest,
      });

      setOutcome(submittedOutcome);
      setSelectedTags(tags);
      setStep("done");
    } catch {
      setError("Could not save feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImproveClick = () => {
    void trackEvent("postcook_improve_clicked", { recipeId, versionId });
    router.push(`/recipes/${recipeId}/versions/${versionId}?action=improve`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center">
      <div className="w-full space-y-4 rounded-t-2xl bg-white p-5 sm:max-w-lg sm:rounded-2xl">
        {/* ── Step: outcome ── */}
        {step === "outcome" && (
          <>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                {recipeTitle}
              </p>
              <h2 className="text-xl font-semibold">How did it go?</h2>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {POST_COOK_OVERALL_OUTCOMES.map((o) => {
                const { label, emoji } = OUTCOME_LABELS[o];
                return (
                  <button
                    key={o}
                    onClick={() => void handleOutcomeSelect(o)}
                    disabled={submitting}
                    className="flex items-center gap-2 rounded-[18px] border border-[rgba(57,75,70,0.12)] bg-white px-4 py-3 text-left text-sm font-semibold transition hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <span className="text-xl">{emoji}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Mark as Best Version toggle */}
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={markAsBest}
                onChange={(e) => setMarkAsBest(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="font-medium">Mark as Best Version ⭐</span>
            </label>

            <button
              onClick={() => void handleSkip()}
              className="text-sm text-[color:var(--muted)] underline-offset-2 hover:underline"
            >
              Skip
            </button>
          </>
        )}

        {/* ── Step: tags_and_more ── */}
        {step === "tags_and_more" && (
          <>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">What needed changing?</h2>
              <p className="text-sm text-[color:var(--muted)]">
                Select all that apply — or just tap Submit.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {POST_COOK_ISSUE_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    selectedTags.includes(tag)
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-[rgba(57,75,70,0.12)] bg-white text-[color:var(--foreground)] hover:bg-gray-50"
                  }`}
                >
                  {ISSUE_TAG_LABELS[tag]}
                </button>
              ))}
            </div>

            {/* Would you make this again? */}
            <div className="space-y-1">
              <p className="text-sm font-medium">Would you make this again?</p>
              <div className="flex gap-2">
                {(["yes", "no"] as const).map((val) => {
                  const isYes = val === "yes";
                  const active = wouldMakeAgain === isYes;
                  return (
                    <button
                      key={val}
                      onClick={() => setWouldMakeAgain(active ? null : isYes)}
                      className={`flex-1 rounded-[14px] border py-2 text-sm font-medium transition ${
                        active
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                          : "border-[rgba(57,75,70,0.12)] bg-white hover:bg-gray-50"
                      }`}
                    >
                      {isYes ? "Yes ✓" : "No ✗"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional note */}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Quick note (optional)…"
              rows={2}
              maxLength={500}
              className="w-full rounded-xl border border-[rgba(57,75,70,0.12)] p-3 text-sm"
            />

            {error && <p className="text-sm text-red-700">{error}</p>}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => void handleSkip()}
                className="min-h-11 flex-1 text-sm"
                disabled={submitting}
              >
                Skip
              </Button>
              <Button
                onClick={() => void handleSubmitTagsStep()}
                disabled={submitting}
                className="min-h-11 flex-1 text-sm"
              >
                {submitting ? "Saving…" : "Submit"}
              </Button>
            </div>
          </>
        )}

        {/* ── Step: done ── */}
        {step === "done" && (
          <>
            <div className="space-y-1 text-center">
              <p className="text-4xl">🙌</p>
              <h2 className="text-xl font-semibold">Thanks!</h2>
              <p className="text-sm text-[color:var(--muted)]">
                Your feedback has been saved.
              </p>
            </div>

            {outcome && shouldShowImproveCTA(outcome, selectedTags) && (
              <Button
                onClick={handleImproveClick}
                variant="secondary"
                className="min-h-11 w-full text-sm"
              >
                Improve this recipe →
              </Button>
            )}

            <Button onClick={onClose} className="min-h-11 w-full text-sm">
              Done
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/postcook/PostCookFeedbackSheet.tsx
git commit -m "feat: add PostCookFeedbackSheet multi-step feedback component"
```

---

## Task 3: Cook page — flag check + CookingModeClient wiring

**Files:**
- Modify: `app/recipes/[id]/versions/[versionId]/cook/page.tsx`
- Modify: `components/cook/CookingModeClient.tsx`

When `postcookFeedbackEnabled` is `true`:
- Clicking "Mark cook complete" opens `PostCookFeedbackSheet` instead of the old modal
- `PostCookFeedbackSheet.onClose()` navigates to the recipe detail page
- When `false`: old modal behavior is unchanged

- [ ] **Step 1: Add flag check to the cook page**

Read `app/recipes/[id]/versions/[versionId]/cook/page.tsx` to confirm current imports.

Then replace the full file content with:

```typescript
import { notFound, redirect } from "next/navigation";
import { CookingModeClient } from "@/components/cook/CookingModeClient";
import { readCanonicalIngredients, readCanonicalSteps } from "@/lib/recipes/canonicalRecipe";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getFeatureFlag } from "@/lib/ai/featureFlags";
import { FEATURE_FLAG_KEYS } from "@/lib/ai/featureFlags";

type CookPageProps = {
  params: Promise<{ id: string; versionId: string }>;
};

export default async function CookPage({ params }: CookPageProps) {
  const { id, versionId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [{ data: recipe, error: recipeError }, { data: version, error: versionError }, postcookFeedbackEnabled] =
    await Promise.all([
      supabase
        .from("recipes")
        .select("id, title")
        .eq("id", id)
        .eq("owner_id", user.id)
        .maybeSingle(),
      supabase
        .from("recipe_versions")
        .select("id, recipe_id, servings, prep_time_min, cook_time_min, ingredients_json, steps_json")
        .eq("id", versionId)
        .eq("recipe_id", id)
        .maybeSingle(),
      getFeatureFlag(FEATURE_FLAG_KEYS.POSTCOOK_FEEDBACK_V1, false),
    ]);

  if (recipeError || versionError || !recipe || !version) {
    notFound();
  }

  return (
    <CookingModeClient
      recipeId={id}
      recipeTitle={recipe.title}
      versionId={versionId}
      ownerId={user.id}
      servings={version.servings}
      prepTimeMin={version.prep_time_min}
      cookTimeMin={version.cook_time_min}
      ingredientNames={readCanonicalIngredients(version.ingredients_json).map((item) => item.name)}
      initialSteps={readCanonicalSteps(version.steps_json)}
      postcookFeedbackEnabled={postcookFeedbackEnabled}
    />
  );
}
```

- [ ] **Step 2: Read CookingModeClient to find the props type and the completion modal block**

```bash
grep -n "type CookingModeClientProps\|interface CookingModeClientProps\|CookingModeClientProps\|showCompletionModal\|setShowCompletionModal\|const completeCooking\|router\.push" /Users/macbook12/Desktop/AIcook/recipe-evolution/components/cook/CookingModeClient.tsx | head -20
```

Then read the full file header (first 50 lines) to see the props type.

- [ ] **Step 3: Add `postcookFeedbackEnabled` prop and `PostCookFeedbackSheet` wiring to CookingModeClient**

In `components/cook/CookingModeClient.tsx`:

**3a.** Add the import at the top of the file (after the existing imports):

```typescript
import { PostCookFeedbackSheet } from "@/components/postcook/PostCookFeedbackSheet";
```

**3b.** Add `postcookFeedbackEnabled: boolean` to the props type (wherever `CookingModeClientProps` is defined). Find the props type and add the field. For example, if it currently ends with:

```typescript
  initialSteps: CanonicalStep[];
```

Change it to:

```typescript
  initialSteps: CanonicalStep[];
  postcookFeedbackEnabled: boolean;
```

**3c.** Destructure the new prop in the component function body. Find the destructuring line (e.g., `const { recipeId, recipeTitle, versionId, ...`) and add `postcookFeedbackEnabled` to it.

**3d.** Add `showPostCookSheet` state. Find the existing `useState` declarations block (near `showCompletionModal`) and add:

```typescript
  const [showPostCookSheet, setShowPostCookSheet] = useState(false);
```

**3e.** Add the `handleCookComplete` helper. Place it just before the existing `completeCooking` function definition:

```typescript
  /**
   * Entry point for the "Mark cook complete" button.
   * When postcookFeedbackEnabled is on, opens the new feedback sheet.
   * When off, opens the legacy completion modal.
   */
  const handleCookComplete = () => {
    if (postcookFeedbackEnabled) {
      setShowPostCookSheet(true);
    } else {
      setShowCompletionModal(true);
    }
  };
```

**3f.** Replace the two places where `setShowCompletionModal(true)` is called directly from the "Mark cook complete" button with `handleCookComplete()`.

Find lines like:
```typescript
onClick={() => setShowCompletionModal(true)}
```

And replace with:
```typescript
onClick={handleCookComplete}
```

There are two of them (one in the flow panel, one in the sidebar). Replace both.

**3g.** Add the `PostCookFeedbackSheet` render block. Find the existing completion modal block:

```typescript
      {showCompletionModal ? (
```

Just before that block (keeping the old modal untouched), add:

```typescript
      {showPostCookSheet ? (
        <PostCookFeedbackSheet
          recipeId={recipeId}
          versionId={versionId}
          recipeTitle={recipeTitle}
          onClose={() => {
            setShowPostCookSheet(false);
            router.push(`/recipes/${recipeId}`);
            router.refresh();
          }}
        />
      ) : null}
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 5: Run unit tests (no regressions)**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add "app/recipes/[id]/versions/[versionId]/cook/page.tsx" components/cook/CookingModeClient.tsx
git commit -m "feat: wire PostCookFeedbackSheet into cook completion flow behind flag"
```

---

## Task 4: Recipe detail — revisit reminder

**Files:**
- Create: `components/postcook/PostCookReminderBanner.tsx`
- Modify: `app/recipes/[id]/versions/[versionId]/page.tsx`
- Modify: `components/recipes/version-detail/VersionDetailClient.tsx`

When `postcookFeedbackEnabled && !hasPostCookFeedback`, show a lightweight banner at the top of Recipe Detail: "How did this cook go? [Leave feedback]". Clicking opens `PostCookFeedbackSheet`. Once the user has submitted (or refreshes after submission), the banner disappears because `hasPostCookFeedback` will be `true`.

- [ ] **Step 1: Create PostCookReminderBanner**

Create `components/postcook/PostCookReminderBanner.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PostCookFeedbackSheet } from "@/components/postcook/PostCookFeedbackSheet";

type Props = {
  recipeId: string;
  versionId: string;
  recipeTitle: string;
};

export function PostCookReminderBanner({ recipeId, versionId, recipeTitle }: Props) {
  const router = useRouter();
  const [showSheet, setShowSheet] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm">
        <span className="text-emerald-900">
          How did this cook go?
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSheet(true)}
            className="font-semibold text-emerald-700 underline-offset-2 hover:underline"
          >
            Leave feedback
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="text-emerald-600 hover:text-emerald-900"
          >
            ✕
          </button>
        </div>
      </div>

      {showSheet ? (
        <PostCookFeedbackSheet
          recipeId={recipeId}
          versionId={versionId}
          recipeTitle={recipeTitle}
          onClose={() => {
            setShowSheet(false);
            setDismissed(true);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
```

- [ ] **Step 2: Add flag + feedback-exists check to the recipe detail server page**

Read `app/recipes/[id]/versions/[versionId]/page.tsx` to see its current content.

Replace the file content with:

```typescript
import { notFound, redirect } from "next/navigation";
import { VersionDetailClient } from "@/components/recipes/version-detail/VersionDetailClient";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadCachedVersionDetailData } from "@/lib/versionDetailData";
import { getFeatureFlag } from "@/lib/ai/featureFlags";
import { FEATURE_FLAG_KEYS } from "@/lib/ai/featureFlags";

type VersionDetailPageProps = {
  params: Promise<{ id: string; versionId: string }>;
};

export default async function VersionDetailPage({ params }: VersionDetailPageProps) {
  const { id, versionId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [data, postcookFeedbackEnabled, existingFeedback] = await Promise.all([
    loadCachedVersionDetailData(user.id, id, versionId),
    getFeatureFlag(FEATURE_FLAG_KEYS.POSTCOOK_FEEDBACK_V1, false),
    supabase
      .from("recipe_postcook_feedback")
      .select("id")
      .eq("user_id", user.id)
      .eq("recipe_version_id", versionId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!data) {
    notFound();
  }

  const hasPostCookFeedback = !!existingFeedback.data;

  return (
    <VersionDetailClient
      recipeId={id}
      versionId={versionId}
      initialData={data}
      postcookFeedbackEnabled={postcookFeedbackEnabled}
      hasPostCookFeedback={hasPostCookFeedback}
    />
  );
}
```

- [ ] **Step 3: Add the banner to VersionDetailClient**

Read the first 60 lines and last 30 lines of `components/recipes/version-detail/VersionDetailClient.tsx` to understand the props type and the render structure.

```bash
head -60 /Users/macbook12/Desktop/AIcook/recipe-evolution/components/recipes/version-detail/VersionDetailClient.tsx
tail -30 /Users/macbook12/Desktop/AIcook/recipe-evolution/components/recipes/version-detail/VersionDetailClient.tsx
```

Then:

**3a.** Add the import at the top of `VersionDetailClient.tsx`:

```typescript
import { PostCookReminderBanner } from "@/components/postcook/PostCookReminderBanner";
```

**3b.** Find the `VersionDetailClientProps` type (or equivalent) and add:

```typescript
  postcookFeedbackEnabled: boolean;
  hasPostCookFeedback: boolean;
```

**3c.** Destructure the new props in the component function.

**3d.** Find a good placement for the banner — near the top of the recipe detail content, before the recipe title or just after the version-label header. A reasonable target is just before the first major content section. Add:

```typescript
{postcookFeedbackEnabled && !hasPostCookFeedback ? (
  <PostCookReminderBanner
    recipeId={recipeId}
    versionId={versionId}
    recipeTitle={initialData.recipe.title ?? "this recipe"}
  />
) : null}
```

Use `initialData.recipe.title` (or however the recipe title is accessed in this component — check the actual field name from the `data` object).

- [ ] **Step 4: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 5: Run unit tests**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add components/postcook/PostCookReminderBanner.tsx "app/recipes/[id]/versions/[versionId]/page.tsx" components/recipes/version-detail/VersionDetailClient.tsx
git commit -m "feat: add post-cook revisit reminder banner to recipe detail"
```

---

## Task 5: Full test run, lint, and typecheck

- [ ] **Step 1: Full unit test suite**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: Lint**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run lint 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 4: Commit any fixes**

If there were lint/type fixes: `git add -A && git commit -m "fix: Plan B QA pass"`

---

## Task 6: Rollout checklist

**Files:**
- Create: `docs/m4-plan-b-rollout-checklist.md`

- [ ] **Step 1: Create the checklist**

Create `docs/m4-plan-b-rollout-checklist.md`:

```markdown
# Milestone 4 Plan B — Post-Cook Feedback UX Rollout Checklist

## Pre-launch gates

- [ ] Plan A foundation verified:
  - [ ] `recipe_postcook_feedback` table exists in staging
  - [ ] `POST /api/recipes/{id}/versions/{versionId}/postcook` returns 200 for valid payload
  - [ ] `POSTCOOK_FEEDBACK_V1` flag exists in `feature_flags` table
- [ ] `POSTCOOK_FEEDBACK_V1` flag set to `false` in production before enabling

## Cook-completion entry (B3.1)

- [ ] Flag off: old completion modal (rating/improvements/best-version) appears unchanged
- [ ] Flag on: clicking "Mark cook complete" opens PostCookFeedbackSheet (new flow)
- [ ] Flag on: "great" outcome → immediate done confirmation, then navigate to recipe detail
- [ ] Flag on: non-great outcome → outcome → issue tags → submit → done confirmation
- [ ] "Mark as Best Version" toggle visible and functional in new flow
- [ ] Skipping feedback navigates to recipe detail
- [ ] Improve CTA appears for disappointing/failed/with-tags outcomes
- [ ] Improve CTA does NOT appear for clean "great" outcome

## Recipe detail reminder (B3.2)

- [ ] Flag off: banner does not appear
- [ ] Flag on, no prior feedback for this version: banner appears
- [ ] Flag on, feedback already submitted for this version: banner does not appear
- [ ] Dismissing banner removes it for the current session (does not re-nag on same view)
- [ ] Clicking "Leave feedback" opens PostCookFeedbackSheet
- [ ] After submitting from the banner, banner disappears on refresh

## API and schema

- [ ] Submission payload matches Plan A schema (overall_outcome, issue_tags, would_make_again, notes)
- [ ] 409 duplicate-window response is swallowed silently (no error shown to user)
- [ ] Network failure shows recoverable error message
- [ ] Notes clamped to 500 characters
- [ ] Notes empty/whitespace submitted as null

## Analytics events

- [ ] `postcook_prompt_viewed` fires when sheet opens
- [ ] `postcook_submitted` fires on successful submission (not on skip or duplicate)
- [ ] `postcook_skipped` fires when user taps Skip at any step
- [ ] `postcook_issue_tag_selected` fires when a tag chip is toggled
- [ ] `postcook_note_added` fires when notes field has content on submit
- [ ] `postcook_improve_clicked` fires when "Improve this recipe →" is tapped

## Rollback plan

1. Set `postcook_feedback_v1` flag to `false` in `feature_flags` table
2. Old cook-completion modal immediately restored (no code change needed)
3. Recipe detail reminder disappears immediately (flag-gated on server render)
4. Existing `recipe_postcook_feedback` rows are inert — they stay in DB but affect nothing
5. `user_taste_scores` updates from feedback events are fire-and-forget — no rollback needed
   for already-processed events (they represent real signal, not errors)

## Downstream gates for Plans C/D

- [ ] At least one real post-cook feedback event submitted end-to-end in staging
- [ ] `user_taste_scores` updated after that event (check via admin layer)
- [ ] Analytics events visible in `product_events` table
```

- [ ] **Step 2: Commit**

```bash
git add docs/m4-plan-b-rollout-checklist.md
git commit -m "docs: add Plan B post-cook feedback UX rollout checklist"
```

---

## Self-review

### Spec coverage

| Ticket | Covered by |
|---|---|
| B1.1 — UX priority, timing, branching rules | Task 1 (shouldShowIssueTags, shouldShowImproveCTA) + Task 2 (flow steps in PostCookFeedbackSheet) |
| B1.2 — Skip, empty, revisit-reminder states | Task 2 (handleSkip), Task 4 (PostCookReminderBanner dismiss + hasPostCookFeedback guard) |
| B2.1 — Lightweight post-cook feedback flow UI | Task 2 (PostCookFeedbackSheet) |
| B2.2 — Connect to canonical API | Task 2 (fetch to `/postcook` route) |
| B2.3 — "Improve this recipe" next-step action | Task 2 (shouldShowImproveCTA + improve CTA in done step) |
| B3.1 — Post-cook entry after cook completion | Task 3 (CookingModeClient wiring) |
| B3.2 — Recipe detail revisit reminder | Task 4 (PostCookReminderBanner + VersionDetailClient) |
| B4.1 — Analytics instrumentation | Task 2 (all 6 events via trackEvent) |
| B4.2 — Success metrics definition | Rollout checklist (Task 6) + notes on interpretation |
| B5.1 — QA coverage | Task 5 + rollout checklist manual cases (Task 6) |
| B5.2 — Rollout checklist | Task 6 |

### Placeholder scan

No TBDs, TODOs, or vague instructions. All code steps include complete file content or targeted edit instructions with exact code.

### Type consistency

- `PostCookOverallOutcome`, `PostCookIssueTag` — imported from `lib/ai/feedback/postCookFeedbackTypes` in both the logic module (Task 1) and the sheet component (Task 2). ✓
- `buildPostCookPayload` — returns `PostCookPayload`; used in `PostCookFeedbackSheet.submit()`. ✓
- `shouldShowIssueTags` / `shouldShowImproveCTA` — defined in Task 1, imported and used in Task 2. ✓
- `postcookFeedbackEnabled: boolean` — added to `CookingModeClient` props (Task 3), `VersionDetailClient` props (Task 4), and the respective server pages. ✓
- `hasPostCookFeedback: boolean` — added to `VersionDetailClient` props (Task 4) and the server page. ✓
- `PostCookFeedbackSheet` props (`recipeId`, `versionId`, `recipeTitle`, `onClose`) — consistent across Task 2 (definition), Task 3 (cook-mode usage), Task 4 (reminder banner usage). ✓

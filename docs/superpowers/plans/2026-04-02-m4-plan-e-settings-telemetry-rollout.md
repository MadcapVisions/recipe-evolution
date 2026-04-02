# M4 Plan E: Settings, Telemetry & Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Learned Preferences" settings section (flag-gated), emit the `learned_signal_generated` telemetry event after each post-cook feedback update, and create the final M4 rollout checklist.

**Architecture:** E1 adds a server component section to the existing Settings page that displays derived learned patterns and offers a reset action via a new `POST /api/user/taste-scores/reset` route. E2 adds a single `trackServerEvent` call inside the existing fire-and-forget block in the postcook route. E3 is a documentation task (no code). All changes are additive and flag-gated.

**Tech Stack:** Next.js 16 App Router (server + client components), TypeScript, Supabase, Tailwind CSS v3, `getFeatureFlag` + `FEATURE_FLAG_KEYS`, `getLearnedSignals`, `trackServerEvent`, `invalidateLearnedSignalsCache`.

---

## File map

| Action | File | Responsibility |
|---|---|---|
| Create | `app/api/user/taste-scores/reset/route.ts` | POST route — clears `user_taste_scores`, zeros profile cache, invalidates signal cache |
| Create | `components/settings/ResetLearnedPreferencesButton.tsx` | `"use client"` — reset button with loading/error state, calls POST route, refreshes |
| Create | `components/settings/LearnedPreferencesSection.tsx` | Server component — fetches learned signals, renders pattern list or empty state |
| Modify | `app/settings/page.tsx` | Add `LEARNED_PREFERENCES_SETTINGS_V1` flag check, nav entry, and section render |
| Modify | `app/api/recipes/[id]/versions/[versionId]/postcook/route.ts` | Add `trackServerEvent` call for `learned_signal_generated` inside fire-and-forget block |
| Create | `docs/m4-plan-e-rollout-checklist.md` | Final M4 rollout checklist covering Plans A–E |

---

## Task 1: Taste-scores reset API route

**Files:**
- Create: `app/api/user/taste-scores/reset/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/user/taste-scores/reset/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { invalidateLearnedSignalsCache } from "@/lib/ai/learnedSignals";

export async function POST(): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Clear learned taste scores
  const { error: scoresError } = await supabase
    .from("user_taste_scores")
    .upsert(
      { owner_id: user.id, scores_json: null, updated_at: new Date().toISOString() },
      { onConflict: "owner_id" }
    );

  if (scoresError) {
    console.error("Failed to reset taste scores", scoresError.message);
    return NextResponse.json({ error: "Failed to reset preferences" }, { status: 500 });
  }

  // Invalidate cached taste profile so next AI call rebuilds cleanly
  await supabase
    .from("user_taste_profiles")
    .update({ updated_at: new Date(0).toISOString() })
    .eq("owner_id", user.id);

  // Invalidate in-process learned-signal cache
  invalidateLearnedSignalsCache(user.id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run typecheck 2>&1 | grep "taste-scores/reset" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/user/taste-scores/reset/route.ts
git commit -m "feat(e1): add POST /api/user/taste-scores/reset route"
```

---

## Task 2: Reset button client component

**Files:**
- Create: `components/settings/ResetLearnedPreferencesButton.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/settings/ResetLearnedPreferencesButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResetLearnedPreferencesButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleReset() {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/user/taste-scores/reset", { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      setStatus("success");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="text-[14px] font-medium text-[color:var(--muted)]">
        Learned preferences cleared. Chef will start fresh from your next cook.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleReset}
        disabled={status === "loading"}
        className="rounded-full border border-[rgba(79,54,33,0.15)] bg-[rgba(255,252,246,0.9)] px-4 py-2 text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-white disabled:opacity-50"
      >
        {status === "loading" ? "Clearing…" : "Reset learned preferences"}
      </button>
      {status === "error" && (
        <p className="text-[13px] text-red-600">Something went wrong. Please try again.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep "ResetLearnedPreferences" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/settings/ResetLearnedPreferencesButton.tsx
git commit -m "feat(e1): add ResetLearnedPreferencesButton client component"
```

---

## Task 3: Learned preferences section server component

**Files:**
- Create: `components/settings/LearnedPreferencesSection.tsx`

The component receives already-fetched `LearnedSignals` as a prop (the page fetches them server-side to avoid an extra client roundtrip).

- [ ] **Step 1: Create the component**

```typescript
// components/settings/LearnedPreferencesSection.tsx
import { ResetLearnedPreferencesButton } from "@/components/settings/ResetLearnedPreferencesButton";
import type { LearnedSignals } from "@/lib/ai/learnedSignals";

const DIRECTION_ICON: Record<string, string> = {
  positive: "↑",
  negative: "↓",
};

export function LearnedPreferencesSection({ signals }: { signals: LearnedSignals }) {
  const hasPatterns = signals.patterns.length > 0;

  return (
    <div className="saas-card space-y-5 p-5">
      <div className="space-y-1">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          Learned from cooking
        </p>
        <p className="text-[15px] leading-7 text-[color:var(--text)]">
          {hasPatterns
            ? "Chef has picked up on these patterns from your post-cook feedback. They quietly shape suggestions."
            : "No patterns learned yet. Submit post-cook feedback after your next cook to start building your taste model."}
        </p>
      </div>

      {hasPatterns && (
        <ul className="space-y-2">
          {signals.patterns.map((pattern) => (
            <li
              key={pattern.key}
              className="flex items-center gap-2 rounded-[16px] border border-[rgba(79,54,33,0.08)] bg-[rgba(250,248,242,0.92)] px-4 py-3"
            >
              <span className="text-[16px] font-semibold text-[color:var(--primary)]">
                {DIRECTION_ICON[pattern.direction] ?? "·"}
              </span>
              <span className="text-[14px] font-medium text-[color:var(--text)]">{pattern.label}</span>
              <span className="ml-auto rounded-full bg-[rgba(111,102,95,0.08)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
                {pattern.confidence}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-[rgba(79,54,33,0.07)] pt-4">
        <p className="mb-3 text-[13px] text-[color:var(--muted)]">
          Clearing learned preferences does not affect your kitchen profile above.
        </p>
        <ResetLearnedPreferencesButton />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep "LearnedPreferencesSection" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/settings/LearnedPreferencesSection.tsx
git commit -m "feat(e1): add LearnedPreferencesSection server component"
```

---

## Task 4: Wire learned preferences into Settings page

**Files:**
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: Add imports**

Add these imports at the top of `app/settings/page.tsx`:

```typescript
import { LearnedPreferencesSection } from "@/components/settings/LearnedPreferencesSection";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/ai/featureFlags";
import { getLearnedSignals } from "@/lib/ai/learnedSignals";
```

- [ ] **Step 2: Add flag check and signals fetch in parallel with preferences**

Find the preferences query in `SettingsPage`. Wrap the existing `supabase.from("user_preferences")...` query and the new flag+signal calls in a `Promise.all`:

Replace the existing single preferences query:
```typescript
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select(...)
    .eq("owner_id", user.id)
    .maybeSingle();
```

With:
```typescript
  const [{ data: preferences }, learnedPreferencesEnabled] = await Promise.all([
    supabase
      .from("user_preferences")
      .select(
        "preferred_units, cooking_skill_level, common_diet_tags, disliked_ingredients, favorite_cuisines, favorite_proteins, preferred_flavors, pantry_staples, pantry_confident_staples, spice_tolerance, health_goals, taste_notes"
      )
      .eq("owner_id", user.id)
      .maybeSingle(),
    getFeatureFlag(FEATURE_FLAG_KEYS.LEARNED_PREFERENCES_SETTINGS_V1, false),
  ]);

  const learnedSignals = learnedPreferencesEnabled
    ? await getLearnedSignals(supabase, user.id)
    : null;
```

- [ ] **Step 3: Add "Learned preferences" to the sidebar nav**

Find the `<nav className="space-y-2">` block in the `<aside>` element. Add a third nav link after the "Kitchen profile" link:

```tsx
            <a
              href="#learned"
              className="block rounded-[18px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.78)] px-4 py-3 text-[15px] font-medium text-[color:var(--text)] transition hover:border-[rgba(74,106,96,0.22)]"
            >
              Learned preferences
            </a>
```

But only render it when the flag is on. Wrap it:
```tsx
            {learnedPreferencesEnabled && (
              <a
                href="#learned"
                className="block rounded-[18px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.78)] px-4 py-3 text-[15px] font-medium text-[color:var(--text)] transition hover:border-[rgba(74,106,96,0.22)]"
              >
                Learned preferences
              </a>
            )}
```

- [ ] **Step 4: Add learned preferences section below the Kitchen profile section**

Find the closing `</section>` of the `id="preferences"` section (the Kitchen profile section). After it, add:

```tsx
          {learnedPreferencesEnabled && learnedSignals && (
            <section id="learned" className="scroll-mt-32 space-y-3">
              <div className="space-y-2">
                <p className="app-kicker">Learned preferences</p>
                <h2 className="text-[28px] font-semibold tracking-tight text-[color:var(--text)]">
                  Patterns from your cooking
                </h2>
                <p className="text-[16px] leading-7 text-[color:var(--muted)]">
                  These patterns are built automatically from your post-cook feedback. Chef uses them quietly — they never override your kitchen profile above.
                </p>
              </div>
              <LearnedPreferencesSection signals={learnedSignals} />
            </section>
          )}
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck 2>&1 | grep -E "settings/page|LearnedPreferences" | head -10
```

Expected: no errors.

- [ ] **Step 6: Run unit tests**

```bash
npm run test:unit 2>&1 | tail -3
```

Expected: all tests still pass.

- [ ] **Step 7: Commit**

```bash
git add app/settings/page.tsx
git commit -m "feat(e1): wire learned preferences section into Settings page"
```

---

## Task 5: Add `learned_signal_generated` telemetry event

**Files:**
- Modify: `app/api/recipes/[id]/versions/[versionId]/postcook/route.ts`

- [ ] **Step 1: Read the file**

Read `app/api/recipes/[id]/versions/[versionId]/postcook/route.ts` and find the imports section and the fire-and-forget async block (the `void (async () => { ... })()` block starting around line 100).

- [ ] **Step 2: Add `trackServerEvent` import**

Find the existing imports at the top of the file. Add:

```typescript
import { trackServerEvent } from "@/lib/trackServerEvent";
```

- [ ] **Step 3: Add the telemetry call inside the fire-and-forget block**

Inside the `try { ... }` block of the fire-and-forget IIFE, after the `invalidateLearnedSignalsCache(user.id)` call, add:

```typescript
      // Emit telemetry: a learned signal was generated from this cook event
      await trackServerEvent(supabase, user.id, "learned_signal_generated", {
        outcome: overall_outcome,
        issue_tag_count: issue_tags.length,
        would_make_again: would_make_again ?? null,
      });
```

The full fire-and-forget block should now end with:
```typescript
      // Invalidate in-process learned-signal cache
      invalidateLearnedSignalsCache(user.id);

      // Emit telemetry: a learned signal was generated from this cook event
      await trackServerEvent(supabase, user.id, "learned_signal_generated", {
        outcome: overall_outcome,
        issue_tag_count: issue_tags.length,
        would_make_again: would_make_again ?? null,
      });
    } catch (err) {
      console.error("Failed to update taste scores from post-cook feedback", err);
    }
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck 2>&1 | grep "postcook/route" | head -5
```

Expected: no errors.

- [ ] **Step 5: Run unit tests**

```bash
npm run test:unit 2>&1 | tail -3
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/recipes/[id]/versions/[versionId]/postcook/route.ts
git commit -m "feat(e2): emit learned_signal_generated telemetry after postcook score update"
```

---

## Task 6: Final M4 rollout checklist + lint/typecheck gate

**Files:**
- Create: `docs/m4-plan-e-rollout-checklist.md`

- [ ] **Step 1: Run full quality gate**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution && npm run test:unit 2>&1 | tail -5 && npm run lint 2>&1 | grep -v "^$" | grep -v "✔" | head -10 && npm run typecheck 2>&1 | grep -v "^$" | head -10
```

Expected: all tests pass (≥614), lint clean, typecheck clean.

- [ ] **Step 2: Create the rollout checklist**

Write `docs/m4-plan-e-rollout-checklist.md` with this content:

```markdown
# Milestone 4 Plan E — Settings, Telemetry & Final Rollout Checklist

## E1: Learned preferences settings

- [ ] `LEARNED_PREFERENCES_SETTINGS_V1` feature flag exists and defaults to `false`
- [ ] `POST /api/user/taste-scores/reset` returns 200 for authenticated user
- [ ] `POST /api/user/taste-scores/reset` returns 401 for unauthenticated request
- [ ] After reset: `user_taste_scores.scores_json` is `null` for that user
- [ ] After reset: `user_taste_profiles.updated_at` is zeroed (epoch)
- [ ] After reset: `invalidateLearnedSignalsCache` called (in-process cache cleared)
- [ ] `LearnedPreferencesSection` renders pattern list when patterns exist
- [ ] `LearnedPreferencesSection` renders empty-state message when no patterns
- [ ] Each pattern shows label + direction indicator + confidence badge
- [ ] With flag off: Settings page renders without learned section (no nav entry, no section)
- [ ] With flag on: "Learned preferences" appears in sidebar nav and as a section
- [ ] Reset button shows loading state during request
- [ ] Reset button shows success message and triggers `router.refresh()` after success
- [ ] Reset button shows error message on failure (retryable)

## E2: Telemetry

- [ ] `learned_signal_generated` event appears in `product_events` after post-cook feedback submission
- [ ] Event metadata includes `outcome`, `issue_tag_count`, `would_make_again`
- [ ] Telemetry failure does NOT crash the postcook route (already inside try/catch)
- [ ] `getPostCookCoverageStats()` in `lib/admin/adminData.ts` returns sensible data after events submitted

## Full M4 milestone gate

### Plan A (Data Foundation)
- [ ] `recipe_postcook_feedback` table exists with RLS policies
- [ ] `POST /api/recipes/{id}/versions/{versionId}/postcook` returns 200 for valid payload
- [ ] `user_taste_scores` updated after feedback submission
- [ ] `lib/ai/learnedSignals.ts` returns non-empty patterns for user with ≥3 cook events

### Plan B (UX)
- [ ] `POSTCOOK_FEEDBACK_V1` flag gates the feedback sheet in Cook Mode
- [ ] Post-cook sheet completes in ≤15 seconds
- [ ] `PostCookReminderBanner` visible on Recipe Detail when flag on + no prior feedback

### Plan C (Learning Pipeline)
- [ ] `applyPostCookFeedback` correctly maps issue tags to taste score deltas
- [ ] `summarizeLearnedScores` returns empty string when confidence is "low"
- [ ] `getLearnedSignals` 5-minute TTL cache working (repeat call returns cached)

### Plan D (Product Consumers)
- [ ] `IMPROVE_WITH_FEEDBACK_V1` flag gates post-cook context injection in improve-recipe
- [ ] `LIBRARY_RESURFACING_V1` flag gates shelf on library page
- [ ] `CREATE_PERSONALIZATION_V1` flag gates suggestion chips on create form
- [ ] All three surfaces are independently flag-toggleable

### Plan E (Settings + Telemetry)
- [ ] `LEARNED_PREFERENCES_SETTINGS_V1` flag gates learned preferences section
- [ ] `learned_signal_generated` event emitted after every postcook score update

## Rollback plan (full M4)

1. All M4 flags default to `false` — flipping any flag off restores prior behavior
2. `user_taste_scores` can be reset per-user via `POST /api/user/taste-scores/reset`
3. `recipe_postcook_feedback` rows are append-only — safe to ignore on rollback
4. `getLearnedSignals` returns empty patterns if scores are null — no downstream crash
5. All Plan D surfaces (`postCookContext`, resurfacing shelf, suggestion chips) are no-ops when their flags are off
6. Settings section disappears instantly when `LEARNED_PREFERENCES_SETTINGS_V1` is set to false

## Staged rollout order

1. Enable `POSTCOOK_FEEDBACK_V1` → collect feedback, verify `product_events`
2. Enable `IMPROVE_WITH_FEEDBACK_V1` → verify context injection in improve-recipe logs
3. Enable `LIBRARY_RESURFACING_V1` + `CREATE_PERSONALIZATION_V1` → verify signals surface correctly for users with ≥3 events
4. Enable `LEARNED_PREFERENCES_SETTINGS_V1` → all users can view + reset their learned profile
```

- [ ] **Step 3: Commit checklist**

```bash
git add docs/m4-plan-e-rollout-checklist.md
git commit -m "docs: add M4 Plan E and full milestone rollout checklist"
```

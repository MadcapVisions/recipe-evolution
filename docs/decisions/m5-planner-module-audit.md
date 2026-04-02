# M5 Planner Module Audit

Ticket 1.2 — Backend / AI
Date: 2026-04-02

## Purpose

Classify current planner, grocery, servings, and nearby consumer modules before Milestone 5
implementation so the team does not create a second planning or grocery stack by accident.

**Classification key:**
- `reuse-direct` — import and call as-is in M5 flow
- `wrap-temporarily` — keep core logic, add planner-specific adapter around it
- `absorb` — logic should move into the M5 planner flow; original entry path becomes secondary
- `freeze-legacy` — remains active for manual/legacy behavior only
- `deprecate-later` — not central to M5 and may be retired later

**Role key:**
- `plan_storage_crud`
- `candidate_ranking`
- `grocery_generation`
- `servings_scaling`
- `ui_data_loading`
- `legacy_manual_planner`
- `consumer_surface`

---

## Summary table

| Module | Classification | Role | Notes |
|---|---|---|---|
| `app/api/planner/week/route.ts` | `reuse-direct` | `plan_storage_crud` | Current accepted-week CRUD route. M5 keeps `meal_plan_entries` as accepted truth. Full-range rewrite on accept remains acceptable. |
| `app/planner/page.tsx` | `wrap-temporarily` | `ui_data_loading` | Good server entry point for week loading and pantry settings. Needs assisted-planner data loading added without making page own ranking logic. |
| `components/planner/MealPlannerClient.tsx` | `absorb` | `legacy_manual_planner` | Current UI is manual-first drag/drop and summary tabs. M5 should evolve this into assisted-first planner UX while preserving manual controls as secondary. |
| `lib/plannerData.ts` | `wrap-temporarily` | `ui_data_loading` | Current loader is latest-version-only and capped to 24 recent recipes. Too narrow for M5 candidate generation, but useful as a baseline loader pattern. |
| `lib/recipes/mealPlanner.ts` | `wrap-temporarily` | `grocery_generation` | Strong as accepted-plan aggregation for grocery + prep. Not a ranking or week-assembly engine. Reuse downstream of accepted selections, not for candidate generation. |
| `lib/recipes/groceryPlanning.ts` | `wrap-temporarily` | `grocery_generation` | Good consolidation and pantry-suppression foundation. M5 should extend inputs/rules, not rebuild a second grocery merger. |
| `lib/recipes/servings.ts` | `reuse-direct` | `servings_scaling` | Existing servings scaling utilities should remain canonical for quantity adjustments. |
| `lib/recipes/targetServings.ts` | `reuse-direct` | `servings_scaling` | Existing target-servings helpers remain active in planner/grocery derivation. |
| `lib/ai/learnedSignals.ts` | `reuse-direct` | `consumer_surface` | Canonical learned-signal interface for planner consumption. Do not duplicate. |
| `lib/ai/userTasteProfile.ts` | `freeze-legacy` | `consumer_surface` | Summary/rendering path, not planner ranking input. Planner should use learned signals, not text summaries, as ranking inputs. |
| `lib/recipes/resurfacingData.ts` | `wrap-temporarily` | `candidate_ranking` | Useful source of post-cook resurfacing signals and repeatability cues. Planner can adapt it rather than re-querying semantics ad hoc. |
| `lib/postcook/buildCreateSuggestions.ts` | `freeze-legacy` | `consumer_surface` | Useful precedent for consuming `getLearnedSignals`, but Create-specific suggestion shaping should not become planner ranking logic. |
| `app/api/recipes/[id]/versions/[versionId]/grocery/route.ts` | `freeze-legacy` | `grocery_generation` | Version-level grocery persistence route remains valid for per-recipe grocery flows, but M5 week grocery should stay derived from accepted plan rather than reuse this as week truth. |

---

## Detailed notes by module

### `app/api/planner/week/route.ts`

**Classification:** `reuse-direct`
**Role:** `plan_storage_crud`

**What it does now:**
- reads accepted `meal_plan_entries` for a date range
- persists accepted weekly entries by deleting and reinserting the requested range

**M5 decision:**
- keep as the canonical accepted-plan persistence layer
- transient assisted drafts stay out of this route until acceptance
- full-range rewrite on accept is acceptable in M5

---

### `app/planner/page.tsx`

**Classification:** `wrap-temporarily`
**Role:** `ui_data_loading`

**What it does now:**
- loads current week entries
- loads pantry staples
- loads planner recipe options through `loadPlannerRecipeOptions`
- supports manual query-based auto-assignment into the week

**M5 decision:**
- retain as the planner server entry point
- extend with planner-specific assisted data loading
- do not let it become the ranking engine or hold planner intelligence inline

---

### `components/planner/MealPlannerClient.tsx`

**Classification:** `absorb`
**Role:** `legacy_manual_planner`

**What it does now:**
- manual-first weekly board
- drag/drop scheduling
- local servings overrides
- combined grocery and prep summaries
- saves accepted week back to `/api/planner/week`

**M5 decision:**
- this is the existing planner shell to evolve, not throw away
- absorb manual-first behavior into an assisted-first planner flow
- assisted draft state should live here (or in closely related client modules), with manual editing
  preserved as a secondary control path

---

### `lib/plannerData.ts`

**Classification:** `wrap-temporarily`
**Role:** `ui_data_loading`

**What it does now:**
- loads only the latest version per recipe
- caps to the 24 most recently updated recipes

**M5 decision:**
- not sufficient as the candidate pool for assisted planning
- useful as a reference for shape loading and canonical ingredient/step reads
- replace with a planner-specific candidate query/selection layer

---

### `lib/recipes/mealPlanner.ts`

**Classification:** `wrap-temporarily`
**Role:** `grocery_generation`

**What it does now:**
- aggregates selected recipe versions
- scales ingredients by target servings
- derives grocery and prep outputs

**M5 decision:**
- keep this downstream of accepted selections
- do not expand it into ranking, suitability, or week assembly
- likely wrapper target for accepted-plan to grocery/prep derivation

---

### `lib/recipes/groceryPlanning.ts`

**Classification:** `wrap-temporarily`
**Role:** `grocery_generation`

**What it does now:**
- suppresses pantry items
- consolidates ingredient quantities
- classifies aisles
- separates flexible items from measured items

**M5 decision:**
- reuse this as the grocery-merging foundation
- extend via planner-aware overlap/grocery rules rather than replacing it
- pantry suppression remains explicit-settings-only in M5

---

### `lib/recipes/servings.ts`

**Classification:** `reuse-direct`
**Role:** `servings_scaling`

**M5 decision:**
- keep as canonical servings-scaling logic for planner and grocery derivation

---

### `lib/recipes/targetServings.ts`

**Classification:** `reuse-direct`
**Role:** `servings_scaling`

**M5 decision:**
- keep active for planner-side serving targets

---

### `lib/ai/learnedSignals.ts`

**Classification:** `reuse-direct`
**Role:** `consumer_surface`

**M5 decision:**
- planner consumes this directly
- no private planner preference model

---

### `lib/ai/userTasteProfile.ts`

**Classification:** `freeze-legacy`
**Role:** `consumer_surface`

**Why:**
- user-facing summary text is not the right ranking interface
- planner should consume structured learned signals and explicit settings instead

---

### `lib/recipes/resurfacingData.ts`

**Classification:** `wrap-temporarily`
**Role:** `candidate_ranking`

**Why:**
- already touches `recipe_postcook_feedback` and `would_make_again`
- likely useful for repeatability/resurfacing context
- planner can adapt this rather than inventing separate post-cook semantics

---

### `lib/postcook/buildCreateSuggestions.ts`

**Classification:** `freeze-legacy`
**Role:** `consumer_surface`

**Why:**
- proves the shared learned-signals consumption pattern
- but Create-specific suggestion logic should not become planner logic

---

### `app/api/recipes/[id]/versions/[versionId]/grocery/route.ts`

**Classification:** `freeze-legacy`
**Role:** `grocery_generation`

**Why:**
- valid for recipe-detail grocery flows
- not the right persistence model for accepted weekly grocery in M5

---

## Explicit non-decisions prevented by this audit

- No second planner truth beside `meal_plan_entries`
- No planner candidate engine built on the 24-item manual loader
- No second grocery-merging stack for accepted weekly plans
- No planner-specific learned-preference derivation path
- No version-level grocery persistence reused as weekly grocery authority

---

## Immediate M5 build implications

1. Build a planner-specific candidate query layer instead of extending `loadPlannerRecipeOptions`
   in place as the ranking authority.
2. Keep accepted-plan persistence on `/api/planner/week`.
3. Treat `MealPlannerClient` as the surface to evolve into assisted-first UX.
4. Reuse grocery and servings foundations downstream of accepted selections.
5. Use shared learned-signal and post-cook semantics, not planner-private equivalents.

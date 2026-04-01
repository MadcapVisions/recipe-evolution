# M3 Coaching Overlap Audit

Ticket 1.2 — Backend / AI
Date: 2026-03-31

## Purpose

Classify existing chef-intelligence, cook-support, and related modules to prevent
a second hidden advice system from forming alongside the new CookingCoach layer.

---

## Module Classifications

### lib/ai/chefIntelligence.ts

**Status:** Freeze for legacy only

**What it does:**
- `buildChefIntelligence()` — analyzes recipe context and produces insights with risk flags
- `deriveChefActions()` — converts LLM conversation into structured edit actions
- `applyChefActions()` — applies those actions to modify recipe ingredients/steps/notes

**Output role:** recipe_improvement (edit actions, improvement insights)
**UI status:** internal_only (results feed chef chat and fix flows, not direct pre-cook guidance)

**Decision:** Do not use in coaching flow. This module is LLM-driven, edit-action-oriented,
and scoped to recipe improvement — not pre-cook coaching or cook-time rescue.
Frozen for legacy chef-chat and improve-recipe flows only.

---

### lib/ai/chefCatalog.ts

**Status:** Reuse rule format as inspiration; data remains in scoring/fix flow

**What it does:**
- Defines `ChefRuleRecord`, `ChefFixStrategyRecord`, `ChefExpectedRuleRecord`, `ChefScoreProfileRecord`
- Contains `CHEF_RULES_SEED`, `CHEF_FIX_STRATEGIES_SEED`, `DEFAULT_CHEF_SCORE_PROFILES`

**Output role:** internal_signal_only (scoring and fix strategy inputs)
**UI status:** internal_only

**Decision:** The structured rule record pattern (`ChefRuleRecord` with layer, trigger conditions,
severity, applicability) is the right architectural model and directly informed the `CoachRule`
format in `lib/ai/coaching/chefRules.ts`. However, the catalog data itself (CHEF_RULES_SEED,
fix strategies) remains in the scoring/fix flow and is not imported by coaching modules.
Coaching rules are defined independently in `lib/ai/coaching/familyCoachingRules.ts`.

---

### lib/ai/preprocessing/buildCookingContext.ts

**Status:** Freeze for legacy only

**What it does:**
- `buildCookingContext(ingredients)` — returns a formatted string covering flavor pairings,
  recommended techniques, and substitution options derived from ingredient list

**Output role:** internal_signal_only
**UI status:** internal_only

**Decision:** String-based, ingredient-centered, and not structured for step-linked or
family-aware coaching output. Not surfaced to users in current flows. Frozen for any
legacy context-building that depends on it. Coaching does not call this function.

---

### Recipe Detail insight assembly helpers

No dedicated insight-assembly module was found for Recipe Detail beyond `lib/versionDetailData.ts`
(which joins score data from `recipe_scores`). The chef score subscores and improvement priorities
stored in `recipe_scores` / `recipe_score_factors` are the existing "insight" surface for Recipe
Detail.

**Decision:** Existing score display is the Milestone 2 quality summary surface. The Milestone 3
pre-cook coaching block is a separate block sourced from `recipe_coach_layers`. The two must not
be mixed or made to repeat each other. Loading extended via Ticket 4.2b
(`lib/versionDetailData.ts` extension).

---

### Cook mode helpers — lib/ai/preprocessing/buildCookingContext.ts

(Already classified above.)

The Cook mode components (`components/cook/CookingModeClient.tsx`, `LiveSessionClient.tsx`)
currently render step content from the recipe steps array directly. No step-annotation or
step-cue injection layer exists yet. This is a gap that Tickets 6.0 and 6.1 address
(Cook mode audit → step-linked cue support).

**Decision:** Coaching must not wire into Cook mode data flow until Ticket 6.0 audit completes.

---

## Summary Table

| Module | Status | Output Role | UI Status |
|---|---|---|---|
| chefIntelligence.ts | freeze for legacy only | recipe_improvement | internal_only |
| chefCatalog.ts | reuse format as inspiration; data stays in scoring flow | internal_signal_only | internal_only |
| buildCookingContext.ts | freeze for legacy only | internal_signal_only | internal_only |
| Recipe Detail score loading (versionDetailData.ts) | reuse directly; extend for coach | precook_guidance (coach) | user_visible |
| Cook mode step render (CookingModeClient.tsx) | extend after Ticket 6.0 audit | live_cook_guidance | user_visible |

---

## Constraint confirmed

The new coaching layer (`lib/ai/coaching/`) is the only active pre-cook and cook-time guidance
system in the migrated flow. It does not call or depend on chefIntelligence.ts or
buildCookingContext.ts. Coach rules are defined in `lib/ai/coaching/chefRules.ts` and
`lib/ai/coaching/familyCoachingRules.ts`, not in chefCatalog.ts.

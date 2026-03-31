# Contract Authority Boundaries — Milestone 2

**Purpose:** Prevent contract drift as Milestone 2 introduces `CulinaryBlueprint` as the second
canonical layer. Reference this document when reviewing any planning or generation change.

---

## What each contract owns

### ResolvedCookingIntent
**File:** `lib/ai/intent/intentTypes.ts`
**Owns:** Semantic meaning — what the user wants, dish identity, constraints, premise trust,
ingredient mentions, pivot state.
**Rule:** No downstream contract may re-interpret dish identity or re-resolve constraints.
`ResolvedCookingIntent` is the single source of truth for what was requested.

### CulinaryBlueprint
**File:** `lib/ai/blueprint/blueprintTypes.ts`
**Owns:** Culinary planning — how the recipe will be structured, what roles each ingredient plays,
what methods will be used, what texture and flavor targets exist, feasibility assessment.
**Rule:** In migrated flows (`blueprint_generation_v1` flag enabled), blueprint decisions are
authoritative. No legacy contract may override blueprint component, method, or finish decisions.

### RecipePlan
**File:** `lib/ai/contracts/recipePlan.ts`
**Status:** **Deprecated as a planning authority in migrated flows.**
`RecipePlan` was the old planning contract (title direction, dish family, technique outline).
It may remain temporarily as a bridge type if downstream systems require it during migration.
It must not be used to make planning decisions that conflict with `CulinaryBlueprint`.
New code must not create new callers of `recipePlan.ts` (the builder) in migrated flow.

### BuildSpec
**File:** `lib/ai/contracts/buildSpec.ts`
**Status:** Temporary downstream execution bridge.
Derives from `ResolvedCookingIntent` (via `resolvedIntentToBuildSpec`). May remain active
for legacy-path generation. In migrated flow, if `BuildSpec` is still needed by downstream
callers, it must derive from canonical intent — never from blueprint or CookingBrief.
Must not override blueprint decisions.

### CookingBrief
**File:** `lib/ai/contracts/cookingBrief.ts`
**Status:** Legacy compatibility context only in migrated flows.
Not a planning authority. Not updated to reflect blueprint decisions. Used only where
legacy code requires it as input and has not yet been migrated.

---

## Decision rules for code reviewers

When reviewing a Milestone 2 PR, ask:

**1. Does this code make a planning decision (method, component, finish strategy, ingredient role)?**
→ It must derive from `CulinaryBlueprint`, not from `RecipePlan`, `BuildSpec`, or `CookingBrief`.

**2. Does this code re-classify the dish family or re-resolve user constraints?**
→ It must derive from `ResolvedCookingIntent`, not from blueprint or build spec.

**3. Is legacy generation code being modified?**
→ Check that `blueprint_generation_v1` flag is respected and the legacy path is unchanged when the flag is off.

**4. Does this code add a new caller to `recipePlan.ts` (the builder) or `recipeGenerationOrchestrator.ts`?**
→ Reject it for migrated flow. These are frozen for legacy only.

**5. Does this code add a new caller to `recipeVerifier.ts`?**
→ Reject it for migrated flow. Use `culinaryValidator.ts` wrapper (Plan B, Ticket 4.3) instead.

---

## Migration flag contract

When `FEATURE_FLAG_KEYS.BLUEPRINT_GENERATION_V1` is `true`:
- `buildCulinaryBlueprint()` runs and its output is authoritative
- `draftRecipeFromBlueprint()` is the drafting path
- Legacy orchestrator and verifier are bypassed

When `FEATURE_FLAG_KEYS.BLUEPRINT_GENERATION_V1` is `false`:
- Legacy path runs unchanged
- No blueprint code runs
- No behavioral change from Milestone 1

---

**Updated:** Milestone 2 initial handoff — 2026-03-31

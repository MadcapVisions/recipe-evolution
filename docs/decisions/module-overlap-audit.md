# Module Overlap Audit — Milestone 2

**Purpose:** Migration-overlap classification for all planning, validation, scoring, and role modules.
Downstream tickets (1.3, 2.1, 4.2, 4.3, 4.4) must check this document before building.

**Classification key:**
- `reuse-direct` — import and call as-is in migrated flow
- `wrap-temporarily` — wrap with thin adapter; deprecate later
- `absorb` — logic moves into blueprint flow; original frozen for legacy
- `freeze-legacy` — active only in legacy (non-flagged) flow
- `deprecate-later` — scheduled for removal, not used in migrated flow

---

## Planning / Orchestration

| Module | Classification | Notes |
|--------|---------------|-------|
| `recipeGenerationOrchestrator.ts` | `freeze-legacy` | Main legacy orchestration. Blueprint-driven flow (`draftRecipeFromBlueprint.ts`) bypasses it entirely. Do not modify. |
| `recipePlan.ts` (builder) | `freeze-legacy` | Builds `RecipePlan` from `CookingBrief`. Superseded by `buildCulinaryBlueprint` in migrated flow. Frozen — no new callers. |
| `contracts/recipePlan.ts` (type) | `deprecate-later` | `RecipePlan` type may survive temporarily as a bridge shape if downstream systems still need it. Must not be used to make planning decisions that conflict with `CulinaryBlueprint`. |
| `ingredientPlanner.ts` | `freeze-legacy` | Ingredient planning for legacy flow. Blueprint flow uses `ingredientRoles.ts` + blueprint component structure instead. |
| `stepGenerator.ts` | `freeze-legacy` | Step generation for legacy flow. Method authority in migrated flow belongs to `planMethod.ts`. |
| `intentResolver.ts` | `reuse-direct` | Upstream resolver; not replaced by blueprint layer. Called before `buildCulinaryBlueprint`. |

---

## Family Rules

| Module | Classification | Notes |
|--------|---------------|-------|
| `dishFamilyRules.ts` | `reuse-direct` | Validation-oriented rules used by `culinaryValidator.ts`. Remains active. `familyBlueprintRules.ts` is a separate planning-oriented layer; it does not replace these rules. The two can coexist — different purposes. |

---

## Validation / Verification

| Module | Classification | Notes |
|--------|---------------|-------|
| `recipeStructuralValidation.ts` | `wrap-temporarily` | Clean, well-tested structural validator. Plan B (Ticket 4.2) creates a thin wrapper to call it in migrated flow with blueprint-context-aware inputs. Do not duplicate its checks. |
| `culinaryValidator.ts` | `wrap-temporarily` | Culinary family-fit validator using `dishFamilyRules.ts`. Plan B (Ticket 4.3) creates a thin wrapper for migrated flow. Do not duplicate. |
| `recipeVerifier.ts` | `freeze-legacy` | Brief-based semantic verifier (checks required ingredients, dish family match against CookingBrief). Stays in legacy flow only. `culinaryValidator.ts` handles culinary checks in migrated flow. |

---

## Scoring

| Module | Classification | Notes |
|--------|---------------|-------|
| `chefScoring.ts` | `reuse-direct` | Chef score is the product-facing quality score. It remains active and unchanged. Delight score (Plan B Ticket 4.4) supplements it for weak-vs-strong detection in migrated builds — it does not replace it. |
| `chefScoreStore.ts` | `reuse-direct` | Chef score persistence is unchanged. Delight score gets its own separate `recipe_validation_results` table (Plan C). No migration of existing chef score tables needed. |

---

## Role System

| Module | Classification | Notes |
|--------|---------------|-------|
| `substitutionEngine/ingredientRoles.ts` | `deprecate-later` | An 11-entry `Record<string, string>` lookup stub. Too thin to be a role authority. `lib/ai/blueprint/ingredientRoles.ts` is the new canonical role system for migrated flow. The old file is not imported in blueprint code. |

---

## Decision summary for downstream tickets

- **Ticket 1.3 (family rules):** `familyBlueprintRules.ts` is a new planning layer alongside `dishFamilyRules.ts` — not a replacement.
- **Ticket 2.1 (ingredient roles):** Build `lib/ai/blueprint/ingredientRoles.ts` fresh. Do not extend the substitution engine stub.
- **Ticket 4.2 (structural validation):** Wrap `recipeStructuralValidation.ts` — do not rebuild.
- **Ticket 4.3 (culinary validation):** Wrap `culinaryValidator.ts` — do not rebuild.
- **Ticket 4.4 (delight score):** New `scoreDelight.ts`. Chef score persists unchanged alongside it.

---

**Reviewed:** Milestone 2 handoff — 2026-03-31

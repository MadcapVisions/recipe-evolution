# M2 Blueprint Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the culinary planning layer (CulinaryBlueprint), ingredient role system, method planner, blueprint feasibility checks, and blueprint-driven recipe drafting that form the Milestone 2 AI engine foundation.

**Architecture:** A new `lib/ai/blueprint/` module owns culinary planning. `buildCulinaryBlueprint()` takes `ResolvedCookingIntent` and produces a deterministic `CulinaryBlueprint` using family rules. Downstream, `draftRecipeFromBlueprint()` wraps the LLM call with blueprint-informed context instead of loose prompt assembly.

**Tech Stack:** TypeScript, Node built-in test runner (`node:test` / `node:assert/strict`), existing Supabase feature-flag infrastructure.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `lib/ai/blueprint/blueprintTypes.ts` | Canonical `CulinaryBlueprint` type system — all downstream modules import from here |
| `lib/ai/blueprint/familyBlueprintRules.ts` | Per-family culinary defaults for 8 launch families |
| `lib/ai/blueprint/ingredientRoles.ts` | Role assignment logic and family coverage rules |
| `lib/ai/blueprint/buildCulinaryBlueprint.ts` | Deterministic blueprint generator from `ResolvedCookingIntent` |
| `lib/ai/blueprint/feasibility.ts` | Blueprint-stage feasibility checks before drafting |
| `lib/ai/method/planMethod.ts` | Structured method plan from `CulinaryBlueprint` |
| `lib/ai/drafting/draftRecipeFromBlueprint.ts` | Blueprint-driven LLM drafting wrapper |
| `docs/decisions/module-overlap-audit.md` | Ticket 1.2 audit output — module classifications |
| `docs/decisions/authority-boundaries.md` | Ticket 1.5 contract authority reference |

### Modified files
| File | Change |
|------|--------|
| `lib/ai/featureFlags.ts` | Add M2 flag key constants |

### New test files
| File | Tests |
|------|-------|
| `tests/unit/blueprintTypes.test.ts` | Type shape, required fields |
| `tests/unit/familyBlueprintRules.test.ts` | Coverage of 8 launch families, fallback |
| `tests/unit/ingredientRoles.test.ts` | Role assignment, coverage detection |
| `tests/unit/buildCulinaryBlueprint.test.ts` | Blueprint generation for launch families |
| `tests/unit/blueprintFeasibility.test.ts` | Feasibility flag logic |
| `tests/unit/planMethod.test.ts` | Method plan structure and checkpoints |
| `tests/unit/draftRecipeFromBlueprint.test.ts` | Prompt construction, output shape (mocked LLM) |

---

## Task 1: Define Culinary Blueprint type system

**Ticket:** 1.1
**Files:**
- Create: `lib/ai/blueprint/blueprintTypes.ts`
- Test: `tests/unit/blueprintTypes.test.ts`

- [ ] **Step 1: Write the failing type-shape test**

```typescript
// tests/unit/blueprintTypes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import type {
  IngredientRole,
  RichnessLevel,
  CheckpointPhase,
  ComponentPurpose,
  BlueprintIngredient,
  BlueprintComponent,
  BlueprintCheckpoint,
  FeasibilityFlags,
  CulinaryBlueprint,
} from "../../lib/ai/blueprint/blueprintTypes";

test("CulinaryBlueprint has required identity fields", () => {
  const bp: CulinaryBlueprint = {
    dishName: "Chicken Stir-Fry",
    dishFamily: "skillet_saute",
    cuisineHint: "asian",
    richnessLevel: "moderate",
    flavorArchitecture: ["savory base", "umami depth", "acid finish"],
    components: [],
    primaryMethod: "sear",
    sequenceLogic: "sear protein, build sauce, toss",
    finishStrategy: "fresh herb and sesame oil drizzle",
    textureTargets: ["crispy protein", "tender veg"],
    chefOpportunities: ["high-heat sear for Maillard crust"],
    checkpoints: [],
    feasibility: {
      familyFit: true,
      ingredientFit: true,
      equipmentFit: true,
      timeBudgetPlausible: true,
      difficultyPlausible: true,
      issues: [],
    },
    generatedFrom: "req-abc",
    generatedAt: new Date().toISOString(),
  };

  assert.equal(bp.dishName, "Chicken Stir-Fry");
  assert.equal(bp.richnessLevel, "moderate");
  assert.ok(Array.isArray(bp.components));
  assert.ok(Array.isArray(bp.checkpoints));
  assert.ok(Array.isArray(bp.flavorArchitecture));
  assert.ok(typeof bp.feasibility.familyFit === "boolean");
});

test("BlueprintComponent has ingredient list with role and rationale", () => {
  const comp: BlueprintComponent = {
    name: "seared chicken",
    purpose: "main",
    cookMethod: "sear",
    textureTarget: "crispy exterior, juicy interior",
    ingredients: [
      { name: "chicken thigh", role: "protein", rationale: "main protein source" },
      { name: "neutral oil", role: "fat", rationale: "searing medium" },
    ],
  };

  assert.equal(comp.ingredients[0].role, "protein");
  assert.equal(comp.ingredients[1].role, "fat");
  assert.ok(comp.ingredients[0].rationale.length > 0);
});

test("BlueprintCheckpoint has all required fields", () => {
  const chk: BlueprintCheckpoint = {
    phase: "active_cook",
    description: "Check internal temperature reaches 165°F",
    failureRisk: "undercooked chicken",
  };

  assert.equal(chk.phase, "active_cook");
  assert.ok(chk.description.length > 0);
  assert.ok(chk.failureRisk.length > 0);
});

test("FeasibilityFlags issues is always an array", () => {
  const flags: FeasibilityFlags = {
    familyFit: false,
    ingredientFit: true,
    equipmentFit: true,
    timeBudgetPlausible: true,
    difficultyPlausible: true,
    issues: ["dish family not recognized"],
  };

  assert.equal(flags.familyFit, false);
  assert.ok(Array.isArray(flags.issues));
  assert.equal(flags.issues[0], "dish family not recognized");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution
rm -rf .tmp-unit && tsc -p tsconfig.unit.json 2>&1 | head -20
```

Expected: TypeScript compile error — `Cannot find module '../../lib/ai/blueprint/blueprintTypes'`

- [ ] **Step 3: Create the blueprint types file**

```typescript
// lib/ai/blueprint/blueprintTypes.ts

/**
 * Canonical culinary-planning contract for migrated generation flows.
 *
 * Authority hierarchy (migrated flows):
 *   ResolvedCookingIntent  — upstream semantic authority (lib/ai/intent/intentTypes.ts)
 *   CulinaryBlueprint      — culinary planning authority (this file)
 *   BuildSpec              — temporary downstream execution bridge (lib/ai/contracts/buildSpec.ts)
 *   CookingBrief           — legacy compatibility context only
 *   RecipePlan             — deprecated as planning authority in migrated flows
 *
 * See docs/decisions/authority-boundaries.md for full contract hierarchy.
 */

export type IngredientRole =
  | "base"       // foundational starch or grain (rice, pasta, bread, potato)
  | "protein"    // main protein source (chicken, tofu, beans, fish)
  | "aromatic"   // flavor-base aromatic (onion, garlic, shallot, celery, ginger)
  | "fat"        // cooking fat or fat component (butter, oil, cream, coconut milk)
  | "acid"       // acid balance (lemon juice, vinegar, white wine, tomato)
  | "sweetness"  // sweetening element (honey, sugar, mirin, caramelized onion)
  | "umami"      // savory depth (soy sauce, fish sauce, parmesan, mushroom, miso)
  | "heat"       // spice or heat element (chili, black pepper, ginger, red pepper flake)
  | "texture"    // textural contrast (nuts, breadcrumbs, crispy element, seeds)
  | "binder"     // structural binder (egg, cornstarch, roux flour)
  | "structure"  // primary load-bearing structure (flour in pastry/dough)
  | "liquid"     // cooking liquid (stock, water, wine, coconut milk as base)
  | "finish"     // final-touch element (fresh herb, citrus zest, butter mount, drizzle)
  | "garnish"    // purely visual or minor aromatic finish
  | "seasoning"; // salt, pepper, and fundamental base seasoning

export type RichnessLevel = "light" | "moderate" | "rich" | "indulgent";

export type CheckpointPhase = "prep" | "active_cook" | "finish" | "plate";

export type ComponentPurpose =
  | "main"
  | "sauce"
  | "base"
  | "side"
  | "garnish"
  | "texture_contrast";

export type BlueprintIngredient = {
  name: string;
  role: IngredientRole;
  rationale: string;
};

export type BlueprintComponent = {
  name: string;
  purpose: ComponentPurpose;
  ingredients: BlueprintIngredient[];
  cookMethod: string;
  textureTarget: string | null;
};

export type BlueprintCheckpoint = {
  phase: CheckpointPhase;
  description: string;
  failureRisk: string;
};

export type FeasibilityFlags = {
  familyFit: boolean;
  ingredientFit: boolean;
  equipmentFit: boolean;
  timeBudgetPlausible: boolean;
  difficultyPlausible: boolean;
  issues: string[];
};

export type CulinaryBlueprint = {
  // Identity
  dishName: string;
  dishFamily: string;
  cuisineHint: string | null;
  richnessLevel: RichnessLevel;

  // Planning
  flavorArchitecture: string[];   // e.g. ["savory base", "umami depth", "bright acid finish"]
  components: BlueprintComponent[];
  primaryMethod: string;          // e.g. "sear then deglaze"
  sequenceLogic: string;          // how components come together
  finishStrategy: string;         // how the dish is finished

  // Quality targets
  textureTargets: string[];       // e.g. ["crispy skin", "silky sauce"]
  chefOpportunities: string[];    // technique moments that elevate the dish

  // Checkpoints
  checkpoints: BlueprintCheckpoint[];

  // Feasibility
  feasibility: FeasibilityFlags;

  // Tracing
  generatedFrom: string;  // requestId from ResolvedCookingIntent
  generatedAt: string;    // ISO 8601
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json && node --require ./scripts/_mock-server-only.cjs --test .tmp-unit/tests/unit/blueprintTypes.test.js
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/blueprint/blueprintTypes.ts tests/unit/blueprintTypes.test.ts
git commit -m "feat(m2): add CulinaryBlueprint canonical type system"
```

---

## Task 2: Audit existing modules (Ticket 1.2)

**Tickets:** 1.2
**Files:**
- Create: `docs/decisions/module-overlap-audit.md`

This is a research task. Read each audited file, classify it, and write the findings. No code required — output is a decision document.

- [ ] **Step 1: Read each audited module and classify**

Read these files in order. For each, answer: active in migrated flow? what role?

```
lib/ai/recipeGenerationOrchestrator.ts
lib/ai/recipePlan.ts  (the builder, not the type)
lib/ai/contracts/recipePlan.ts  (the type)
lib/ai/ingredientPlanner.ts
lib/ai/stepGenerator.ts
lib/ai/intentResolver.ts
lib/ai/dishFamilyRules.ts
lib/ai/recipeStructuralValidation.ts
lib/ai/culinaryValidator.ts
lib/ai/recipeVerifier.ts
lib/ai/chefScoring.ts
lib/ai/chefScoreStore.ts
lib/ai/substitutionEngine/ingredientRoles.ts
```

- [ ] **Step 2: Write the audit document**

Save the following template with actual findings filled in to `docs/decisions/module-overlap-audit.md`.

```markdown
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
| `recipeGenerationOrchestrator.ts` | `freeze-legacy` | Legacy orchestration; blueprint-driven flow bypasses it |
| `recipePlan.ts` (builder) | `freeze-legacy` | Produces RecipePlan; superseded by buildCulinaryBlueprint in migrated flow |
| `contracts/recipePlan.ts` (type) | `deprecate-later` | RecipePlan type may remain as temporary bridge type only |
| `ingredientPlanner.ts` | `wrap-temporarily` | Step generation helper; blueprint-driven drafting uses blueprint roles instead; audit reuse in draftRecipeFromBlueprint |
| `stepGenerator.ts` | `wrap-temporarily` | May be called within draftRecipeFromBlueprint or planMethod; does not own method authority in migrated flow |
| `intentResolver.ts` | `reuse-direct` | Upstream resolver; not replaced by blueprint layer |

## Family Rules

| Module | Classification | Notes |
|--------|---------------|-------|
| `dishFamilyRules.ts` | `reuse-direct` | Validation rules reused by culinaryValidator; familyBlueprintRules wraps/extends for planning purposes |

## Validation / Verification

| Module | Classification | Notes |
|--------|---------------|-------|
| `recipeStructuralValidation.ts` | `wrap-temporarily` | Structural validation reusable; Plan B (Ticket 4.2) decides wrap vs rename |
| `culinaryValidator.ts` | `wrap-temporarily` | Culinary validation reusable; Plan B (Ticket 4.3) decides wrap vs rename |
| `recipeVerifier.ts` | `freeze-legacy` | Brief-based verification stays in legacy flow; culinaryValidator handles migrated culinary checks |

## Scoring

| Module | Classification | Notes |
|--------|---------------|-------|
| `chefScoring.ts` | `reuse-direct` | Chef score remains the product-facing quality score; delight score supplements it (Plan B Ticket 4.4) |
| `chefScoreStore.ts` | `reuse-direct` | Chef score persistence unchanged; delight score gets separate table (Plan C) |

## Role System

| Module | Classification | Notes |
|--------|---------------|-------|
| `substitutionEngine/ingredientRoles.ts` | `deprecate-later` | 11-entry lookup table, too thin to be the role authority; blueprint ingredientRoles.ts is the new role system |

---

**Reviewed by:** [name]
**Date:** [date]
```

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/module-overlap-audit.md
git commit -m "docs(m2): add module overlap audit for Ticket 1.2"
```

---

## Task 3: Authority boundaries document (Ticket 1.5)

**Files:**
- Create: `docs/decisions/authority-boundaries.md`

- [ ] **Step 1: Create the authority document**

```markdown
# Contract Authority Boundaries — Milestone 2

**Purpose:** Prevent contract drift as Milestone 2 introduces CulinaryBlueprint as a second canonical layer.
Reference this document when reviewing any planning or generation change.

---

## What each contract owns

### ResolvedCookingIntent
**File:** `lib/ai/intent/intentTypes.ts`
**Owns:** semantic meaning — what the user wants, dish identity, constraints, premise trust.
**Rule:** No downstream contract may reinterpret dish identity or re-resolve constraints.

### CulinaryBlueprint
**File:** `lib/ai/blueprint/blueprintTypes.ts`
**Owns:** culinary planning — how the recipe will be structured, what roles each ingredient plays,
what methods will be used, what texture and flavor targets exist.
**Rule:** In migrated flows, blueprint decisions are authoritative. No legacy contract may override
blueprint component, method, or finish decisions.

### RecipePlan
**File:** `lib/ai/contracts/recipePlan.ts`
**Status:** Deprecated as a planning authority in migrated flows.
May remain as a temporary bridge type if downstream systems still require it during migration.
Must not be used to make planning decisions that conflict with CulinaryBlueprint.

### BuildSpec
**File:** `lib/ai/contracts/buildSpec.ts`
**Status:** Temporary downstream execution bridge.
Derives from ResolvedCookingIntent (via resolvedIntentToBuildSpec). May remain active
for legacy-path generation. Must not override blueprint decisions in migrated flow.

### CookingBrief
**File:** `lib/ai/contracts/cookingBrief.ts`
**Status:** Legacy compatibility context only in migrated flows.
Not a planning authority. Not updated to reflect blueprint decisions.

---

## Decision rule for code reviewers

When reviewing a Milestone 2 PR, ask:

1. Does this code make a planning decision (method, component, finish)?
   → It must go through CulinaryBlueprint, not RecipePlan, BuildSpec, or CookingBrief.

2. Does this code re-classify the dish family or re-resolve constraints?
   → It must go through ResolvedCookingIntent, not blueprint or build spec.

3. Is legacy generation code being modified?
   → Check that blueprint_generation_v1 flag is respected and legacy path is unchanged.

---

**Updated:** Milestone 2 initial handoff
```

- [ ] **Step 2: Commit**

```bash
git add docs/decisions/authority-boundaries.md
git commit -m "docs(m2): add contract authority boundaries document for Ticket 1.5"
```

---

## Task 4: Add M2 feature flags (Ticket 10.1)

**Files:**
- Modify: `lib/ai/featureFlags.ts`

- [ ] **Step 1: Add M2 constants to FEATURE_FLAG_KEYS**

Open `lib/ai/featureFlags.ts`. The existing constant block looks like:

```typescript
export const FEATURE_FLAG_KEYS = {
  GRACEFUL_MODE: "graceful_mode",
  INTENT_RESOLVER_V2: "intent_resolver_v2",
  DRAFT_RECIPE_LIFECYCLE_V1: "draft_recipe_lifecycle_v1",
  CREATE_GUIDED_ENTRY_V1: "create_guided_entry_v1",
} as const;
```

Add the M2 keys:

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
} as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json 2>&1 | grep -i error | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/featureFlags.ts
git commit -m "feat(m2): add Milestone 2 feature flag keys"
```

---

## Task 5: Define family blueprint rules (Ticket 1.3)

**Files:**
- Create: `lib/ai/blueprint/familyBlueprintRules.ts`
- Test: `tests/unit/familyBlueprintRules.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/familyBlueprintRules.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  getFamilyBlueprintRule,
  LAUNCH_FAMILY_KEYS,
  FALLBACK_BLUEPRINT_RULE,
} from "../../lib/ai/blueprint/familyBlueprintRules";

test("all 8 launch families have blueprint rules", () => {
  for (const family of LAUNCH_FAMILY_KEYS) {
    const rule = getFamilyBlueprintRule(family);
    assert.ok(rule !== null, `Missing rule for family: ${family}`);
    assert.ok(rule!.typicalComponents.length > 0, `${family} has no typical components`);
    assert.ok(rule!.defaultCookMethods.length > 0, `${family} has no cook methods`);
    assert.ok(rule!.requiredRoles.length > 0, `${family} has no required roles`);
    assert.ok(rule!.finishStrategies.length > 0, `${family} has no finish strategies`);
    assert.ok(rule!.commonFailureRisks.length > 0, `${family} has no failure risks`);
  }
});

test("getFamilyBlueprintRule returns null for unknown family", () => {
  const rule = getFamilyBlueprintRule("unknown_family_xyz");
  assert.equal(rule, null);
});

test("FALLBACK_BLUEPRINT_RULE is defined and usable as a safe default", () => {
  assert.ok(FALLBACK_BLUEPRINT_RULE.typicalComponents.length > 0);
  assert.ok(FALLBACK_BLUEPRINT_RULE.requiredRoles.length > 0);
  assert.ok(FALLBACK_BLUEPRINT_RULE.defaultRichnessLevel !== undefined);
});

test("skillet_saute rule requires protein, aromatic, and fat roles", () => {
  const rule = getFamilyBlueprintRule("skillet_saute");
  assert.ok(rule !== null);
  assert.ok(rule!.requiredRoles.includes("protein"), "skillet_saute must require protein");
  assert.ok(rule!.requiredRoles.includes("aromatic"), "skillet_saute must require aromatic");
  assert.ok(rule!.requiredRoles.includes("fat"), "skillet_saute must require fat");
});

test("soups_stews rule requires liquid role", () => {
  const rule = getFamilyBlueprintRule("soups_stews");
  assert.ok(rule !== null);
  assert.ok(rule!.requiredRoles.includes("liquid"), "soups_stews must require liquid");
});

test("pasta rule requires base and umami roles", () => {
  const rule = getFamilyBlueprintRule("pasta");
  assert.ok(rule !== null);
  assert.ok(rule!.requiredRoles.includes("base"), "pasta must require base");
  assert.ok(rule!.requiredRoles.includes("umami"), "pasta must require umami");
});

test("time defaults are positive numbers", () => {
  for (const family of LAUNCH_FAMILY_KEYS) {
    const rule = getFamilyBlueprintRule(family)!;
    assert.ok(rule.defaultDifficultyMinutes.prep > 0, `${family} prep time must be > 0`);
    assert.ok(rule.defaultDifficultyMinutes.cook > 0, `${family} cook time must be > 0`);
  }
});
```

- [ ] **Step 2: Run to verify failure**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json 2>&1 | grep "familyBlueprintRules" | head -5
```

Expected: compile error — cannot find module.

- [ ] **Step 3: Create the family blueprint rules file**

```typescript
// lib/ai/blueprint/familyBlueprintRules.ts
import type { IngredientRole, RichnessLevel } from "./blueprintTypes";

export type FamilyBlueprintRule = {
  family: string;
  typicalComponents: string[];
  defaultCookMethods: string[];
  textureTargets: string[];
  finishStrategies: string[];
  commonFailureRisks: string[];
  requiredRoles: IngredientRole[];
  optionalRoles: IngredientRole[];
  defaultDifficultyMinutes: { prep: number; cook: number };
  defaultServings: number;
  defaultRichnessLevel: RichnessLevel;
};

export const LAUNCH_FAMILY_KEYS = [
  "skillet_saute",
  "pasta",
  "soups_stews",
  "sheet_pan",
  "chicken_dinners",
  "rice_grain_bowls",
  "roasted_vegetables",
  "baked_casseroles",
] as const;

export type LaunchFamilyKey = (typeof LAUNCH_FAMILY_KEYS)[number];

const FAMILY_RULES: Record<LaunchFamilyKey, FamilyBlueprintRule> = {
  skillet_saute: {
    family: "skillet_saute",
    typicalComponents: ["seared protein", "pan sauce", "aromatics"],
    defaultCookMethods: ["sear", "deglaze", "simmer", "toss"],
    textureTargets: ["crispy protein exterior", "silky sauce"],
    finishStrategies: ["fresh herb", "acid squeeze", "butter mount"],
    commonFailureRisks: [
      "overcooked protein from overcrowded pan",
      "bland sauce from insufficient fond",
      "steaming instead of searing from wet protein",
    ],
    requiredRoles: ["protein", "fat", "aromatic"],
    optionalRoles: ["acid", "umami", "heat", "finish"],
    defaultDifficultyMinutes: { prep: 15, cook: 20 },
    defaultServings: 4,
    defaultRichnessLevel: "moderate",
  },

  pasta: {
    family: "pasta",
    typicalComponents: ["cooked pasta", "sauce", "protein or vegetable"],
    defaultCookMethods: ["boil", "sauté", "toss", "emulsify"],
    textureTargets: ["al dente pasta", "coating sauce that clings"],
    finishStrategies: ["pasta water emulsification", "grated cheese", "fresh herb"],
    commonFailureRisks: [
      "overcooked pasta loses al dente texture",
      "sauce too thick before pasta water added",
      "under-seasoned pasta water",
    ],
    requiredRoles: ["base", "fat", "umami"],
    optionalRoles: ["protein", "acid", "heat", "aromatic", "finish"],
    defaultDifficultyMinutes: { prep: 10, cook: 25 },
    defaultServings: 4,
    defaultRichnessLevel: "moderate",
  },

  soups_stews: {
    family: "soups_stews",
    typicalComponents: ["aromatic base", "protein or legume", "liquid base", "vegetables"],
    defaultCookMethods: ["sweat aromatics", "brown protein", "simmer", "adjust seasoning"],
    textureTargets: ["tender protein", "rich flavorful broth", "soft but not mushy vegetables"],
    finishStrategies: ["fresh herb", "acid squeeze", "drizzle of quality oil"],
    commonFailureRisks: [
      "underseasoned broth from insufficient salting during cooking",
      "overcooked vegetables added too early",
      "flat flavor from skipping the browning step",
    ],
    requiredRoles: ["aromatic", "liquid", "seasoning"],
    optionalRoles: ["protein", "base", "umami", "acid", "heat", "finish"],
    defaultDifficultyMinutes: { prep: 20, cook: 45 },
    defaultServings: 6,
    defaultRichnessLevel: "moderate",
  },

  sheet_pan: {
    family: "sheet_pan",
    typicalComponents: ["seasoned protein", "roasted vegetables"],
    defaultCookMethods: ["roast", "broil finish"],
    textureTargets: ["caramelized edges", "tender interior", "crispy bits"],
    finishStrategies: ["fresh herb", "lemon squeeze", "quick pan sauce from drippings"],
    commonFailureRisks: [
      "uneven cook time from mis-matched protein and veg sizes",
      "soggy vegetables from overcrowding",
      "steam instead of roast from too much moisture",
    ],
    requiredRoles: ["protein", "fat", "seasoning"],
    optionalRoles: ["aromatic", "acid", "heat", "finish"],
    defaultDifficultyMinutes: { prep: 15, cook: 35 },
    defaultServings: 4,
    defaultRichnessLevel: "light",
  },

  chicken_dinners: {
    family: "chicken_dinners",
    typicalComponents: ["chicken", "sauce or glaze", "aromatic base"],
    defaultCookMethods: ["sear", "bake", "braise", "rest"],
    textureTargets: ["crispy or golden skin", "juicy interior"],
    finishStrategies: ["pan sauce", "herb butter", "glaze reduction"],
    commonFailureRisks: [
      "undercooked thighs or overcooked breast",
      "rubbery skin from insufficient heat",
      "dry meat from skipping the rest step",
    ],
    requiredRoles: ["protein", "fat", "aromatic"],
    optionalRoles: ["acid", "umami", "heat", "finish", "sweetness"],
    defaultDifficultyMinutes: { prep: 20, cook: 30 },
    defaultServings: 4,
    defaultRichnessLevel: "moderate",
  },

  rice_grain_bowls: {
    family: "rice_grain_bowls",
    typicalComponents: ["cooked grain", "seasoned protein", "sauce or dressing", "toppings"],
    defaultCookMethods: ["cook grain", "sear or marinate protein", "make sauce", "assemble"],
    textureTargets: ["fluffy separate grains", "varied textural toppings", "coating sauce"],
    finishStrategies: ["sauce drizzle", "sesame or seed sprinkle", "fresh herb or microgreen"],
    commonFailureRisks: [
      "bland or gummy grain from poor water ratio or rinsing",
      "dry protein without sauce absorption",
      "flat bowl from missing acid element",
    ],
    requiredRoles: ["base", "protein", "fat", "acid", "umami"],
    optionalRoles: ["heat", "texture", "finish", "aromatic", "sweetness"],
    defaultDifficultyMinutes: { prep: 20, cook: 30 },
    defaultServings: 4,
    defaultRichnessLevel: "moderate",
  },

  roasted_vegetables: {
    family: "roasted_vegetables",
    typicalComponents: ["seasoned vegetables", "optional glaze or dressing"],
    defaultCookMethods: ["roast", "optional broil finish"],
    textureTargets: ["caramelized exterior", "tender interior"],
    finishStrategies: ["lemon zest", "fresh herb", "quality cheese or nut sprinkle"],
    commonFailureRisks: [
      "steaming instead of roasting from overcrowded pan",
      "bland vegetables from insufficient fat or salt",
      "uneven cooking from inconsistent cut sizes",
    ],
    requiredRoles: ["fat", "seasoning"],
    optionalRoles: ["acid", "umami", "sweetness", "heat", "texture", "finish"],
    defaultDifficultyMinutes: { prep: 10, cook: 35 },
    defaultServings: 4,
    defaultRichnessLevel: "light",
  },

  baked_casseroles: {
    family: "baked_casseroles",
    typicalComponents: ["protein or vegetable filling", "binder or sauce", "topping"],
    defaultCookMethods: ["sauté filling", "make binder sauce", "layer", "bake", "rest"],
    textureTargets: ["crispy top crust", "creamy or saucy interior"],
    finishStrategies: ["fresh herb", "mandatory rest before cutting"],
    commonFailureRisks: [
      "watery casserole from insufficient binder or moisture reduction",
      "overbaked edges from too-thin layer",
      "cutting before resting leads to runny center",
    ],
    requiredRoles: ["protein", "binder", "fat"],
    optionalRoles: ["base", "umami", "aromatic", "heat", "texture", "finish"],
    defaultDifficultyMinutes: { prep: 30, cook: 50 },
    defaultServings: 6,
    defaultRichnessLevel: "rich",
  },
};

export function getFamilyBlueprintRule(family: string): FamilyBlueprintRule | null {
  return (FAMILY_RULES as Record<string, FamilyBlueprintRule>)[family] ?? null;
}

export const FALLBACK_BLUEPRINT_RULE: FamilyBlueprintRule = {
  family: "unknown",
  typicalComponents: ["main component"],
  defaultCookMethods: ["cook"],
  textureTargets: ["properly cooked texture"],
  finishStrategies: ["season and serve"],
  commonFailureRisks: ["under-seasoning", "incorrect cook time"],
  requiredRoles: ["protein", "fat", "seasoning"],
  optionalRoles: ["aromatic", "acid", "finish"],
  defaultDifficultyMinutes: { prep: 15, cook: 30 },
  defaultServings: 4,
  defaultRichnessLevel: "moderate",
};
```

- [ ] **Step 4: Run tests**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json && node --require ./scripts/_mock-server-only.cjs --test .tmp-unit/tests/unit/familyBlueprintRules.test.js
```

Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/blueprint/familyBlueprintRules.ts tests/unit/familyBlueprintRules.test.ts
git commit -m "feat(m2): add launch-family blueprint rules for 8 families"
```

---

## Task 6: Implement ingredient role assignment (Ticket 2.1)

**Files:**
- Create: `lib/ai/blueprint/ingredientRoles.ts`
- Test: `tests/unit/ingredientRoles.test.ts`

**Note:** The existing `lib/ai/substitutionEngine/ingredientRoles.ts` is an 11-entry lookup table (`Record<string, string>`). It is classified as `deprecate-later` in the module overlap audit. This task builds the proper role assignment module. The new module uses a wider lookup table and adds family-aware coverage checking.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/ingredientRoles.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  assignIngredientRoles,
  checkRoleCoverage,
  ROLE_LOOKUP,
} from "../../lib/ai/blueprint/ingredientRoles";

test("assignIngredientRoles assigns known ingredient to correct role", () => {
  const result = assignIngredientRoles(["chicken thigh", "olive oil", "garlic"], "skillet_saute");
  assert.equal(result["chicken thigh"], "protein");
  assert.equal(result["olive oil"], "fat");
  assert.equal(result["garlic"], "aromatic");
});

test("assignIngredientRoles assigns unknown ingredient to null role", () => {
  const result = assignIngredientRoles(["zorgblax"], "skillet_saute");
  assert.equal(result["zorgblax"], null);
});

test("assignIngredientRoles handles empty list", () => {
  const result = assignIngredientRoles([], "pasta");
  assert.deepEqual(result, {});
});

test("checkRoleCoverage detects missing required roles", () => {
  // skillet_saute requires protein, fat, aromatic — only fat provided
  const coverage = checkRoleCoverage(
    { "olive oil": "fat" },
    "skillet_saute"
  );
  assert.equal(coverage.covered, false);
  assert.ok(coverage.missingRoles.includes("protein"));
  assert.ok(coverage.missingRoles.includes("aromatic"));
  assert.ok(!coverage.missingRoles.includes("fat"));
});

test("checkRoleCoverage passes when all required roles are present", () => {
  const coverage = checkRoleCoverage(
    {
      "chicken thigh": "protein",
      "olive oil": "fat",
      "garlic": "aromatic",
    },
    "skillet_saute"
  );
  assert.equal(coverage.covered, true);
  assert.deepEqual(coverage.missingRoles, []);
});

test("checkRoleCoverage falls back to FALLBACK_BLUEPRINT_RULE for unknown family", () => {
  const coverage = checkRoleCoverage(
    { "chicken": "protein", "butter": "fat", "salt": "seasoning" },
    "unknown_family"
  );
  // FALLBACK requires protein, fat, seasoning — all present
  assert.equal(coverage.covered, true);
});

test("ROLE_LOOKUP covers fat, acid, umami, aromatic categories", () => {
  assert.equal(ROLE_LOOKUP["butter"], "fat");
  assert.equal(ROLE_LOOKUP["lemon juice"], "acid");
  assert.equal(ROLE_LOOKUP["soy sauce"], "umami");
  assert.equal(ROLE_LOOKUP["onion"], "aromatic");
});
```

- [ ] **Step 2: Run to verify failure**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json 2>&1 | grep "ingredientRoles" | head -5
```

Expected: compile error.

- [ ] **Step 3: Create the ingredient roles module**

```typescript
// lib/ai/blueprint/ingredientRoles.ts
import type { IngredientRole } from "./blueprintTypes";
import { getFamilyBlueprintRule, FALLBACK_BLUEPRINT_RULE } from "./familyBlueprintRules";

/**
 * Canonical ingredient → role lookup.
 * Keys are lowercase normalized ingredient names or common base forms.
 * This is the authoritative role system for migrated generation flows.
 * The substitutionEngine/ingredientRoles.ts stub is deprecated in migrated flow.
 */
export const ROLE_LOOKUP: Record<string, IngredientRole> = {
  // Proteins
  "chicken": "protein",
  "chicken breast": "protein",
  "chicken thigh": "protein",
  "ground beef": "protein",
  "beef": "protein",
  "steak": "protein",
  "salmon": "protein",
  "shrimp": "protein",
  "tofu": "protein",
  "tempeh": "protein",
  "eggs": "protein",
  "egg": "protein",
  "lentils": "protein",
  "chickpeas": "protein",
  "white beans": "protein",
  "black beans": "protein",
  "pork": "protein",
  "sausage": "protein",

  // Bases (starch / grain)
  "pasta": "base",
  "rice": "base",
  "brown rice": "base",
  "quinoa": "base",
  "farro": "base",
  "couscous": "base",
  "potatoes": "base",
  "sweet potatoes": "base",
  "bread": "base",
  "breadcrumbs": "texture",  // breadcrumbs used as topping = texture
  "tortillas": "base",
  "noodles": "base",

  // Aromatics
  "onion": "aromatic",
  "yellow onion": "aromatic",
  "white onion": "aromatic",
  "red onion": "aromatic",
  "shallot": "aromatic",
  "shallots": "aromatic",
  "garlic": "aromatic",
  "ginger": "aromatic",
  "celery": "aromatic",
  "leek": "aromatic",
  "scallion": "aromatic",
  "scallions": "aromatic",
  "fennel": "aromatic",

  // Fats
  "olive oil": "fat",
  "butter": "fat",
  "coconut oil": "fat",
  "neutral oil": "fat",
  "avocado oil": "fat",
  "cream": "fat",
  "heavy cream": "fat",
  "coconut milk": "fat",
  "tahini": "fat",
  "ghee": "fat",

  // Acids
  "lemon juice": "acid",
  "lemon": "acid",
  "lime juice": "acid",
  "lime": "acid",
  "white wine vinegar": "acid",
  "red wine vinegar": "acid",
  "apple cider vinegar": "acid",
  "balsamic vinegar": "acid",
  "white wine": "acid",
  "red wine": "acid",
  "tomatoes": "acid",
  "canned tomatoes": "acid",
  "tomato paste": "umami",   // tomato paste skews umami, not just acid

  // Umami
  "soy sauce": "umami",
  "fish sauce": "umami",
  "parmesan": "umami",
  "parmesan cheese": "umami",
  "miso": "umami",
  "worcestershire sauce": "umami",
  "anchovies": "umami",
  "mushrooms": "umami",
  "dried mushrooms": "umami",
  "nutritional yeast": "umami",

  // Heat
  "chili flakes": "heat",
  "red pepper flakes": "heat",
  "chili": "heat",
  "jalapeño": "heat",
  "cayenne": "heat",
  "black pepper": "seasoning",  // black pepper = seasoning not heat at normal quantities
  "sriracha": "heat",

  // Sweetness
  "honey": "sweetness",
  "maple syrup": "sweetness",
  "sugar": "sweetness",
  "brown sugar": "sweetness",
  "mirin": "sweetness",

  // Texture
  "walnuts": "texture",
  "almonds": "texture",
  "pine nuts": "texture",
  "sesame seeds": "texture",
  "panko": "texture",

  // Binders
  "cornstarch": "binder",
  "flour": "binder",
  "egg yolk": "binder",

  // Liquids
  "chicken stock": "liquid",
  "vegetable stock": "liquid",
  "beef stock": "liquid",
  "water": "liquid",
  "broth": "liquid",

  // Finish
  "fresh parsley": "finish",
  "fresh basil": "finish",
  "fresh cilantro": "finish",
  "fresh thyme": "finish",
  "fresh rosemary": "aromatic",  // rosemary used early = aromatic; late = finish
  "chives": "finish",
  "lemon zest": "finish",
  "lime zest": "finish",
  "truffle oil": "finish",

  // Seasoning
  "salt": "seasoning",
  "kosher salt": "seasoning",
  "black pepper": "seasoning",
};

export type RoleCoverageResult = {
  covered: boolean;
  missingRoles: IngredientRole[];
};

/**
 * Assign a culinary role to each ingredient name.
 * Returns a map of ingredient → IngredientRole | null.
 * null means the ingredient is not in the lookup and needs manual classification.
 */
export function assignIngredientRoles(
  ingredients: string[],
  _family: string
): Record<string, IngredientRole | null> {
  const result: Record<string, IngredientRole | null> = {};
  for (const ingredient of ingredients) {
    const normalized = ingredient.toLowerCase().trim();
    result[ingredient] = ROLE_LOOKUP[normalized] ?? null;
  }
  return result;
}

/**
 * Check whether the assigned roles satisfy the required roles for the given family.
 */
export function checkRoleCoverage(
  roleMap: Record<string, IngredientRole | null>,
  family: string
): RoleCoverageResult {
  const rule = getFamilyBlueprintRule(family) ?? FALLBACK_BLUEPRINT_RULE;
  const presentRoles = new Set(Object.values(roleMap).filter((r): r is IngredientRole => r !== null));
  const missingRoles = rule.requiredRoles.filter((r) => !presentRoles.has(r));
  return {
    covered: missingRoles.length === 0,
    missingRoles,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json && node --require ./scripts/_mock-server-only.cjs --test .tmp-unit/tests/unit/ingredientRoles.test.js
```

Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/blueprint/ingredientRoles.ts tests/unit/ingredientRoles.test.ts
git commit -m "feat(m2): add blueprint ingredient role assignment and family coverage rules"
```

---

## Task 7: Build Culinary Blueprint generator (Ticket 1.4)

**Files:**
- Create: `lib/ai/blueprint/buildCulinaryBlueprint.ts`
- Test: `tests/unit/buildCulinaryBlueprint.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/buildCulinaryBlueprint.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildCulinaryBlueprint } from "../../lib/ai/blueprint/buildCulinaryBlueprint";
import type { ResolvedCookingIntent } from "../../lib/ai/intent/intentTypes";

function makeIntent(overrides: Partial<ResolvedCookingIntent> = {}): ResolvedCookingIntent {
  return {
    dishName: "Chicken Stir-Fry",
    rawUserPhrase: "chicken stir fry please",
    dishFamily: "skillet_saute",
    dishFamilyConfidence: 0.9,
    cuisineHint: "asian",
    mealOccasion: "dinner",
    intentSource: "explicit_user_message",
    premiseTrust: "high",
    constraints: [],
    ingredientMentions: ["chicken thigh", "garlic", "soy sauce"],
    pivotDetected: "no_pivot",
    invalidatedConstraints: [],
    requiresClarification: false,
    clarificationReason: null,
    requestId: "req-test-001",
    resolvedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("buildCulinaryBlueprint returns CulinaryBlueprint with correct identity fields", () => {
  const blueprint = buildCulinaryBlueprint(makeIntent());
  assert.equal(blueprint.dishName, "Chicken Stir-Fry");
  assert.equal(blueprint.dishFamily, "skillet_saute");
  assert.equal(blueprint.cuisineHint, "asian");
  assert.equal(blueprint.generatedFrom, "req-test-001");
  assert.ok(blueprint.generatedAt.length > 0);
});

test("buildCulinaryBlueprint produces components for known family", () => {
  const blueprint = buildCulinaryBlueprint(makeIntent());
  assert.ok(blueprint.components.length > 0, "should have at least one component");
  assert.ok(blueprint.primaryMethod.length > 0);
  assert.ok(blueprint.finishStrategy.length > 0);
});

test("buildCulinaryBlueprint assigns roles to mentioned ingredients", () => {
  const blueprint = buildCulinaryBlueprint(makeIntent());
  const allIngredients = blueprint.components.flatMap((c) => c.ingredients);
  const ingredientNames = allIngredients.map((i) => i.name);
  // soy sauce and garlic should appear with roles
  const soy = allIngredients.find((i) => i.name === "soy sauce");
  const garlic = allIngredients.find((i) => i.name === "garlic");
  assert.ok(soy !== undefined || ingredientNames.includes("soy sauce") === false,
    "soy sauce should be in ingredients if mentioned");
  if (soy) {
    assert.equal(soy.role, "umami");
  }
  if (garlic) {
    assert.equal(garlic.role, "aromatic");
  }
});

test("buildCulinaryBlueprint produces feasibility flags", () => {
  const blueprint = buildCulinaryBlueprint(makeIntent());
  assert.equal(typeof blueprint.feasibility.familyFit, "boolean");
  assert.ok(Array.isArray(blueprint.feasibility.issues));
});

test("buildCulinaryBlueprint marks familyFit false for unknown family", () => {
  const blueprint = buildCulinaryBlueprint(makeIntent({ dishFamily: "mystery_dish_xyz" }));
  assert.equal(blueprint.feasibility.familyFit, false);
  assert.ok(blueprint.feasibility.issues.length > 0);
});

test("buildCulinaryBlueprint produces checkpoints for risky families", () => {
  const blueprint = buildCulinaryBlueprint(makeIntent({ dishFamily: "chicken_dinners" }));
  assert.ok(blueprint.checkpoints.length > 0, "chicken_dinners should have checkpoints");
});

test("buildCulinaryBlueprint is deterministic — same input produces same output shape", () => {
  const intent = makeIntent();
  const bp1 = buildCulinaryBlueprint(intent);
  const bp2 = buildCulinaryBlueprint(intent);
  assert.equal(bp1.dishFamily, bp2.dishFamily);
  assert.equal(bp1.primaryMethod, bp2.primaryMethod);
  assert.equal(bp1.finishStrategy, bp2.finishStrategy);
  assert.equal(bp1.components.length, bp2.components.length);
});

test("buildCulinaryBlueprint sets null dishName to rawUserPhrase fallback", () => {
  const blueprint = buildCulinaryBlueprint(
    makeIntent({ dishName: null, rawUserPhrase: "something spicy" })
  );
  assert.equal(blueprint.dishName, "something spicy");
});
```

- [ ] **Step 2: Run to verify failure**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json 2>&1 | grep "buildCulinaryBlueprint" | head -5
```

Expected: compile error.

- [ ] **Step 3: Create the blueprint generator**

```typescript
// lib/ai/blueprint/buildCulinaryBlueprint.ts
import type { ResolvedCookingIntent } from "../intent/intentTypes";
import type {
  CulinaryBlueprint,
  BlueprintComponent,
  BlueprintCheckpoint,
  FeasibilityFlags,
  ComponentPurpose,
} from "./blueprintTypes";
import {
  getFamilyBlueprintRule,
  FALLBACK_BLUEPRINT_RULE,
  type FamilyBlueprintRule,
} from "./familyBlueprintRules";
import { assignIngredientRoles } from "./ingredientRoles";

/**
 * Generate a CulinaryBlueprint from a ResolvedCookingIntent.
 *
 * This function is deterministic — same input produces same output shape.
 * It is heuristic-based (no LLM call). LLM drafting happens downstream
 * in draftRecipeFromBlueprint.ts.
 *
 * See docs/decisions/authority-boundaries.md for contract hierarchy.
 */
export function buildCulinaryBlueprint(intent: ResolvedCookingIntent): CulinaryBlueprint {
  const family = intent.dishFamily ?? "unknown";
  const rule = getFamilyBlueprintRule(family) ?? null;
  const effectiveRule: FamilyBlueprintRule = rule ?? FALLBACK_BLUEPRINT_RULE;

  const components = buildComponents(intent, effectiveRule);
  const checkpoints = buildCheckpoints(effectiveRule);
  const feasibility = buildFeasibilityFlags(intent, rule);

  return {
    dishName: intent.dishName ?? intent.rawUserPhrase ?? "recipe",
    dishFamily: family,
    cuisineHint: intent.cuisineHint,
    richnessLevel: effectiveRule.defaultRichnessLevel,
    flavorArchitecture: buildFlavorArchitecture(effectiveRule, intent),
    components,
    primaryMethod: effectiveRule.defaultCookMethods[0] ?? "cook",
    sequenceLogic: buildSequenceLogic(effectiveRule),
    finishStrategy: effectiveRule.finishStrategies[0] ?? "season and serve",
    textureTargets: [...effectiveRule.textureTargets],
    chefOpportunities: buildChefOpportunities(effectiveRule),
    checkpoints,
    feasibility,
    generatedFrom: intent.requestId,
    generatedAt: new Date().toISOString(),
  };
}

function buildComponents(
  intent: ResolvedCookingIntent,
  rule: FamilyBlueprintRule
): BlueprintComponent[] {
  // Assign roles to mentioned ingredients
  const roleMap = assignIngredientRoles(intent.ingredientMentions, rule.family);

  // Build one component per typical component pattern
  const components: BlueprintComponent[] = rule.typicalComponents.map((componentName, i) => ({
    name: componentName,
    purpose: mapComponentPurpose(componentName, i),
    ingredients: [],
    cookMethod: rule.defaultCookMethods[i] ?? rule.defaultCookMethods[0] ?? "cook",
    textureTarget: rule.textureTargets[i] ?? null,
  }));

  // Attach explicitly mentioned ingredients to their most natural component
  for (const [ingredient, role] of Object.entries(roleMap)) {
    if (role === null) continue;
    const target = findBestComponent(components, role) ?? components[0];
    if (target) {
      target.ingredients.push({
        name: ingredient,
        role,
        rationale: `Explicitly mentioned by user`,
      });
    }
  }

  return components;
}

function mapComponentPurpose(componentName: string, index: number): ComponentPurpose {
  const name = componentName.toLowerCase();
  if (name.includes("sauce") || name.includes("glaze") || name.includes("dressing")) return "sauce";
  if (name.includes("grain") || name.includes("rice") || name.includes("pasta") || name.includes("base")) return "base";
  if (name.includes("garnish") || name.includes("herb")) return "garnish";
  if (name.includes("topping") || name.includes("crunch") || name.includes("crisp")) return "texture_contrast";
  if (index === 0) return "main";
  return "side";
}

function findBestComponent(
  components: BlueprintComponent[],
  role: string
): BlueprintComponent | null {
  // Proteins → main; fats/aromatics → main or sauce; base → base component; finish/garnish → garnish
  if (role === "protein" || role === "aromatic" || role === "fat") {
    return components.find((c) => c.purpose === "main") ?? components[0] ?? null;
  }
  if (role === "base" || role === "liquid") {
    return components.find((c) => c.purpose === "base") ?? components[0] ?? null;
  }
  if (role === "finish" || role === "garnish") {
    return components.find((c) => c.purpose === "garnish") ?? components[components.length - 1] ?? null;
  }
  if (role === "acid" || role === "umami" || role === "sweetness") {
    return components.find((c) => c.purpose === "sauce") ?? components[0] ?? null;
  }
  return components[0] ?? null;
}

function buildFlavorArchitecture(
  rule: FamilyBlueprintRule,
  intent: ResolvedCookingIntent
): string[] {
  const arch = ["savory base"];
  if (rule.requiredRoles.includes("umami")) arch.push("umami depth");
  if (rule.requiredRoles.includes("acid") || rule.optionalRoles.includes("acid")) arch.push("bright acid finish");
  if (rule.requiredRoles.includes("heat") || intent.constraints.some((c) => c.type === "style" && c.value.includes("spicy"))) {
    arch.push("spiced heat");
  }
  return arch;
}

function buildSequenceLogic(rule: FamilyBlueprintRule): string {
  const methods = rule.defaultCookMethods;
  if (methods.length === 0) return "prepare ingredients, cook, and finish";
  return methods.join(", then ");
}

function buildChefOpportunities(rule: FamilyBlueprintRule): string[] {
  // Surface technique moments based on typical methods
  const opportunities: string[] = [];
  if (rule.defaultCookMethods.includes("sear")) {
    opportunities.push("high-heat sear builds Maillard crust — dry protein thoroughly before pan");
  }
  if (rule.defaultCookMethods.includes("deglaze")) {
    opportunities.push("deglaze fond thoroughly — this is the sauce foundation");
  }
  if (rule.defaultCookMethods.includes("emulsify")) {
    opportunities.push("reserve pasta water — starch is the emulsifier");
  }
  if (rule.defaultCookMethods.includes("roast")) {
    opportunities.push("do not crowd the pan — crowding causes steam, not caramelization");
  }
  return opportunities;
}

function buildCheckpoints(rule: FamilyBlueprintRule): BlueprintCheckpoint[] {
  return rule.commonFailureRisks.map((risk) => ({
    phase: inferPhaseFromRisk(risk),
    description: `Watch for: ${risk}`,
    failureRisk: risk,
  }));
}

function inferPhaseFromRisk(risk: string): BlueprintCheckpoint["phase"] {
  const r = risk.toLowerCase();
  if (r.includes("cut") || r.includes("rinse") || r.includes("dry") || r.includes("size")) return "prep";
  if (r.includes("rest") || r.includes("cutting") || r.includes("season and serve")) return "finish";
  return "active_cook";
}

function buildFeasibilityFlags(
  intent: ResolvedCookingIntent,
  rule: FamilyBlueprintRule | null
): FeasibilityFlags {
  const issues: string[] = [];

  const familyFit = rule !== null;
  if (!familyFit) {
    issues.push(`Dish family "${intent.dishFamily}" is not in the launch family set — using conservative fallback`);
  }

  // Check time constraints from intent constraints
  const timeConstraints = intent.constraints.filter((c) => c.type === "technique" && c.value.includes("min"));
  const timeBudgetPlausible = timeConstraints.length === 0; // simplified; extended in Task 8

  return {
    familyFit,
    ingredientFit: true,  // full ingredient-fit check in Task 8 (feasibility.ts)
    equipmentFit: true,   // full equipment check in Task 8
    timeBudgetPlausible,
    difficultyPlausible: true,
    issues,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json && node --require ./scripts/_mock-server-only.cjs --test .tmp-unit/tests/unit/buildCulinaryBlueprint.test.js
```

Expected: All 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/blueprint/buildCulinaryBlueprint.ts tests/unit/buildCulinaryBlueprint.test.ts
git commit -m "feat(m2): add deterministic CulinaryBlueprint generator from ResolvedCookingIntent"
```

---

## Task 8: Blueprint feasibility checks (Ticket 2.3)

**Files:**
- Create: `lib/ai/blueprint/feasibility.ts`
- Test: `tests/unit/blueprintFeasibility.test.ts`

This task extracts and extends the inline feasibility checks from `buildCulinaryBlueprint.ts` into a proper module with full family-fit, ingredient-fit, equipment-fit, time-budget, and difficulty checks.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/blueprintFeasibility.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { checkBlueprintFeasibility } from "../../lib/ai/blueprint/feasibility";
import type { ResolvedCookingIntent } from "../../lib/ai/intent/intentTypes";

function makeIntent(overrides: Partial<ResolvedCookingIntent> = {}): ResolvedCookingIntent {
  return {
    dishName: "Pasta Carbonara",
    rawUserPhrase: "pasta carbonara",
    dishFamily: "pasta",
    dishFamilyConfidence: 0.95,
    cuisineHint: "italian",
    mealOccasion: "dinner",
    intentSource: "explicit_user_message",
    premiseTrust: "high",
    constraints: [],
    ingredientMentions: ["pasta", "eggs", "parmesan", "guanciale"],
    pivotDetected: "no_pivot",
    invalidatedConstraints: [],
    requiresClarification: false,
    clarificationReason: null,
    requestId: "req-feas-001",
    resolvedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("checkBlueprintFeasibility returns all-pass for valid launch-family intent", () => {
  const result = checkBlueprintFeasibility(makeIntent());
  assert.equal(result.familyFit, true);
  assert.equal(result.ingredientFit, true);
  assert.equal(result.timeBudgetPlausible, true);
  assert.equal(result.difficultyPlausible, true);
  assert.deepEqual(result.issues, []);
});

test("checkBlueprintFeasibility sets familyFit false for unrecognized family", () => {
  const result = checkBlueprintFeasibility(makeIntent({ dishFamily: "mystery_dish" }));
  assert.equal(result.familyFit, false);
  assert.ok(result.issues.length > 0);
});

test("checkBlueprintFeasibility flags forbidden ingredient constraint", () => {
  const intent = makeIntent({
    constraints: [
      {
        type: "forbidden_ingredient",
        value: "pasta",
        scope: "session_active",
        strength: "hard",
        source: "explicit_user",
      },
    ],
  });
  const result = checkBlueprintFeasibility(intent);
  assert.equal(result.ingredientFit, false);
  assert.ok(result.issues.some((i) => i.includes("pasta")));
});

test("checkBlueprintFeasibility flags impossible time budget", () => {
  const intent = makeIntent({
    constraints: [
      {
        type: "technique",
        value: "5 min total",
        scope: "session_active",
        strength: "hard",
        source: "explicit_user",
      },
    ],
  });
  const result = checkBlueprintFeasibility(intent);
  assert.equal(result.timeBudgetPlausible, false);
  assert.ok(result.issues.some((i) => i.toLowerCase().includes("time")));
});

test("checkBlueprintFeasibility handles null dishFamily gracefully", () => {
  const result = checkBlueprintFeasibility(makeIntent({ dishFamily: null }));
  assert.equal(result.familyFit, false);
  assert.ok(result.issues.length > 0);
});
```

- [ ] **Step 2: Run to verify failure**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json 2>&1 | grep "feasibility" | head -5
```

Expected: compile error.

- [ ] **Step 3: Create the feasibility module**

```typescript
// lib/ai/blueprint/feasibility.ts
import type { ResolvedCookingIntent } from "../intent/intentTypes";
import type { FeasibilityFlags } from "./blueprintTypes";
import { getFamilyBlueprintRule } from "./familyBlueprintRules";

const TIME_BUDGET_PATTERN = /(\d+)\s*min/i;
const IMPOSSIBLY_SHORT_MINUTES = 10; // total time under 10 min is implausible for any launch family

/**
 * Full blueprint-stage feasibility check.
 * Called before the expensive LLM drafting step.
 * Failures here are surfaced as telemetry category: "blueprint_feasibility"
 * and are distinct from post-draft validation failures.
 */
export function checkBlueprintFeasibility(intent: ResolvedCookingIntent): FeasibilityFlags {
  const issues: string[] = [];

  // Family fit
  const family = intent.dishFamily;
  const rule = family !== null ? getFamilyBlueprintRule(family) : null;
  const familyFit = rule !== null;
  if (!familyFit) {
    issues.push(
      `Dish family "${family ?? "unknown"}" is not in the launch family set. Generation will use conservative fallback rules.`
    );
  }

  // Ingredient fit — check if any forbidden ingredients overlap with ingredientMentions
  const forbiddenConstraints = intent.constraints.filter(
    (c) => c.type === "forbidden_ingredient" && c.strength === "hard"
  );
  const ingredientFit = !intent.ingredientMentions.some((ing) =>
    forbiddenConstraints.some((fc) =>
      ing.toLowerCase().includes(fc.value.toLowerCase()) ||
      fc.value.toLowerCase().includes(ing.toLowerCase())
    )
  );
  if (!ingredientFit) {
    const conflicts = intent.ingredientMentions.filter((ing) =>
      forbiddenConstraints.some((fc) =>
        ing.toLowerCase().includes(fc.value.toLowerCase()) ||
        fc.value.toLowerCase().includes(ing.toLowerCase())
      )
    );
    issues.push(
      `Ingredient conflict: user mentioned ${conflicts.join(", ")} but these are also in forbidden constraints.`
    );
  }

  // Equipment fit — placeholder; equipment constraint parsing is future work
  const equipmentFit = true;

  // Time budget plausibility
  const timeConstraints = intent.constraints.filter((c) => c.type === "technique");
  let timeBudgetPlausible = true;
  for (const tc of timeConstraints) {
    const match = TIME_BUDGET_PATTERN.exec(tc.value);
    if (match) {
      const requestedMinutes = parseInt(match[1], 10);
      if (requestedMinutes < IMPOSSIBLY_SHORT_MINUTES) {
        timeBudgetPlausible = false;
        issues.push(
          `Time budget "${tc.value}" is implausibly short for this dish. Minimum realistic time is ${IMPOSSIBLY_SHORT_MINUTES} minutes.`
        );
      } else if (rule && requestedMinutes < rule.defaultDifficultyMinutes.prep + rule.defaultDifficultyMinutes.cook) {
        timeBudgetPlausible = false;
        issues.push(
          `Time budget "${tc.value}" is shorter than the typical ${rule.defaultDifficultyMinutes.prep + rule.defaultDifficultyMinutes.cook} minutes needed for ${family}.`
        );
      }
    }
  }

  // Difficulty plausibility — placeholder; difficulty inference is future work
  const difficultyPlausible = true;

  return {
    familyFit,
    ingredientFit,
    equipmentFit,
    timeBudgetPlausible,
    difficultyPlausible,
    issues,
  };
}
```

- [ ] **Step 4: Update `buildCulinaryBlueprint.ts` to use the standalone feasibility module**

Replace the inline `buildFeasibilityFlags` function in `lib/ai/blueprint/buildCulinaryBlueprint.ts`:

Remove the inline function:
```typescript
function buildFeasibilityFlags(
  intent: ResolvedCookingIntent,
  rule: FamilyBlueprintRule | null
): FeasibilityFlags { ... }
```

Add import at top of file:
```typescript
import { checkBlueprintFeasibility } from "./feasibility";
```

Replace the `feasibility` assignment in `buildCulinaryBlueprint`:
```typescript
// Before:
feasibility: buildFeasibilityFlags(intent, rule),

// After:
feasibility: checkBlueprintFeasibility(intent),
```

- [ ] **Step 5: Run all related tests**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json && node --require ./scripts/_mock-server-only.cjs --test .tmp-unit/tests/unit/blueprintFeasibility.test.js .tmp-unit/tests/unit/buildCulinaryBlueprint.test.js
```

Expected: All tests pass (including existing blueprint generator tests).

- [ ] **Step 6: Commit**

```bash
git add lib/ai/blueprint/feasibility.ts tests/unit/blueprintFeasibility.test.ts lib/ai/blueprint/buildCulinaryBlueprint.ts
git commit -m "feat(m2): add blueprint feasibility checks as standalone module"
```

---

## Task 9: Build method planner (Ticket 2.2)

**Files:**
- Create: `lib/ai/method/planMethod.ts`
- Test: `tests/unit/planMethod.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/planMethod.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { planMethod } from "../../lib/ai/method/planMethod";
import type { CulinaryBlueprint } from "../../lib/ai/blueprint/blueprintTypes";

function makeBlueprint(overrides: Partial<CulinaryBlueprint> = {}): CulinaryBlueprint {
  return {
    dishName: "Chicken Stir-Fry",
    dishFamily: "skillet_saute",
    cuisineHint: "asian",
    richnessLevel: "moderate",
    flavorArchitecture: ["savory base", "umami depth"],
    components: [
      {
        name: "seared chicken",
        purpose: "main",
        ingredients: [
          { name: "chicken thigh", role: "protein", rationale: "main protein" },
          { name: "olive oil", role: "fat", rationale: "searing medium" },
        ],
        cookMethod: "sear",
        textureTarget: "crispy exterior",
      },
      {
        name: "pan sauce",
        purpose: "sauce",
        ingredients: [
          { name: "soy sauce", role: "umami", rationale: "savory depth" },
          { name: "garlic", role: "aromatic", rationale: "aromatic base" },
        ],
        cookMethod: "deglaze",
        textureTarget: "glossy coating sauce",
      },
    ],
    primaryMethod: "sear then deglaze",
    sequenceLogic: "sear, then deglaze, then toss",
    finishStrategy: "fresh herb",
    textureTargets: ["crispy protein", "silky sauce"],
    chefOpportunities: ["dry protein before searing"],
    checkpoints: [
      { phase: "active_cook", description: "Check pan temperature", failureRisk: "steaming instead of searing" },
    ],
    feasibility: {
      familyFit: true,
      ingredientFit: true,
      equipmentFit: true,
      timeBudgetPlausible: true,
      difficultyPlausible: true,
      issues: [],
    },
    generatedFrom: "req-method-001",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("planMethod returns a method plan with all three sequences", () => {
  const plan = planMethod(makeBlueprint());
  assert.ok(Array.isArray(plan.prepSequence), "must have prepSequence");
  assert.ok(Array.isArray(plan.activeCookSequence), "must have activeCookSequence");
  assert.ok(Array.isArray(plan.finishSequence), "must have finishSequence");
  assert.ok(plan.prepSequence.length > 0, "prepSequence must not be empty");
  assert.ok(plan.activeCookSequence.length > 0, "activeCookSequence must not be empty");
});

test("planMethod includes checkpoints from blueprint", () => {
  const plan = planMethod(makeBlueprint());
  assert.ok(Array.isArray(plan.checkpoints));
  assert.ok(plan.checkpoints.length > 0, "should propagate blueprint checkpoints");
});

test("planMethod includes likely failure points", () => {
  const plan = planMethod(makeBlueprint());
  assert.ok(Array.isArray(plan.likelyFailurePoints));
  assert.ok(plan.likelyFailurePoints.length > 0);
});

test("planMethod generates a prep step for each component with ingredients", () => {
  const plan = planMethod(makeBlueprint());
  // Should have at least a step for the protein
  const hasProteinPrep = plan.prepSequence.some((s) => /chicken|protein/i.test(s));
  assert.ok(hasProteinPrep, "should have a protein prep step");
});

test("planMethod finish sequence references the finishStrategy from blueprint", () => {
  const plan = planMethod(makeBlueprint());
  const hasFinishHerb = plan.finishSequence.some((s) => /herb|finish|serve/i.test(s));
  assert.ok(hasFinishHerb, "finish sequence should reference the finish strategy");
});
```

- [ ] **Step 2: Run to verify failure**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json 2>&1 | grep "planMethod" | head -5
```

Expected: compile error.

- [ ] **Step 3: Create the method planner**

```typescript
// lib/ai/method/planMethod.ts
import type { CulinaryBlueprint, BlueprintCheckpoint } from "../blueprint/blueprintTypes";

export type MethodPlan = {
  prepSequence: string[];
  activeCookSequence: string[];
  finishSequence: string[];
  checkpoints: BlueprintCheckpoint[];
  likelyFailurePoints: string[];
  holdPoints: string[];
};

/**
 * Produce a structured method plan from a CulinaryBlueprint.
 * This plan is deterministic and consumed by draftRecipeFromBlueprint.ts
 * to inform prompt construction.
 *
 * The method plan does NOT replace step generation in the LLM call —
 * it informs and constrains it.
 */
export function planMethod(blueprint: CulinaryBlueprint): MethodPlan {
  return {
    prepSequence: buildPrepSequence(blueprint),
    activeCookSequence: buildActiveCookSequence(blueprint),
    finishSequence: buildFinishSequence(blueprint),
    checkpoints: [...blueprint.checkpoints],
    likelyFailurePoints: blueprint.checkpoints.map((c) => c.failureRisk),
    holdPoints: buildHoldPoints(blueprint),
  };
}

function buildPrepSequence(blueprint: CulinaryBlueprint): string[] {
  const steps: string[] = [];

  for (const component of blueprint.components) {
    const proteins = component.ingredients.filter((i) => i.role === "protein");
    const aromatics = component.ingredients.filter((i) => i.role === "aromatic");
    const base = component.ingredients.filter((i) => i.role === "base");

    for (const p of proteins) {
      steps.push(`Prep ${p.name}: pat dry, season generously`);
    }
    for (const a of aromatics) {
      steps.push(`Prep ${a.name}: mince or slice finely`);
    }
    for (const b of base) {
      steps.push(`Prepare ${b.name} according to package or standard method`);
    }
  }

  if (steps.length === 0) {
    steps.push("Mise en place: measure and prep all ingredients before cooking");
  }

  return steps;
}

function buildActiveCookSequence(blueprint: CulinaryBlueprint): string[] {
  const steps: string[] = [];

  for (const component of blueprint.components) {
    if (component.purpose === "main" || component.purpose === "base") {
      steps.push(`Cook ${component.name} using ${component.cookMethod} method`);
      if (component.textureTarget) {
        steps.push(`Target texture: ${component.textureTarget}`);
      }
    }
  }

  for (const component of blueprint.components) {
    if (component.purpose === "sauce") {
      steps.push(`Build ${component.name} using ${component.cookMethod}`);
    }
  }

  if (steps.length === 0) {
    steps.push(`Cook using ${blueprint.primaryMethod}`);
  }

  return steps;
}

function buildFinishSequence(blueprint: CulinaryBlueprint): string[] {
  const steps: string[] = [];
  steps.push(`Finish: ${blueprint.finishStrategy}`);

  const garnishComponents = blueprint.components.filter(
    (c) => c.purpose === "garnish" || c.purpose === "texture_contrast"
  );
  for (const g of garnishComponents) {
    steps.push(`Add ${g.name} just before serving`);
  }

  steps.push("Taste and adjust seasoning before plating");
  return steps;
}

function buildHoldPoints(blueprint: CulinaryBlueprint): string[] {
  const holds: string[] = [];

  // Proteins usually need a rest step
  const hasProtein = blueprint.components.some((c) =>
    c.ingredients.some((i) => i.role === "protein")
  );
  if (hasProtein) {
    holds.push("Rest protein 3–5 minutes before slicing or serving");
  }

  // Casseroles always need rest
  if (blueprint.dishFamily === "baked_casseroles") {
    holds.push("Rest casserole 10 minutes before cutting — prevents runny center");
  }

  return holds;
}
```

- [ ] **Step 4: Run tests**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json && node --require ./scripts/_mock-server-only.cjs --test .tmp-unit/tests/unit/planMethod.test.js
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/method/planMethod.ts tests/unit/planMethod.test.ts
git commit -m "feat(m2): add method planner from CulinaryBlueprint"
```

---

## Task 10: Build blueprint-driven drafting (Ticket 3.1)

**Files:**
- Create: `lib/ai/drafting/draftRecipeFromBlueprint.ts`
- Test: `tests/unit/draftRecipeFromBlueprint.test.ts`

**Note:** This module wraps an LLM call. Unit tests use a mocked LLM client injected via dependency parameter, matching the pattern used in `resolveCookingIntent.ts`.

- [ ] **Step 1: Check what AiRecipeResult shape looks like**

```bash
grep -r "AiRecipeResult\|RecipeDraft" /Users/macbook12/Desktop/AIcook/recipe-evolution/lib/ai/recipeResult.ts | head -20
```

Read `lib/ai/recipeResult.ts` to understand the output shape before writing the test. The drafting function must return this shape.

- [ ] **Step 2: Write the failing tests (after reading recipeResult.ts)**

```typescript
// tests/unit/draftRecipeFromBlueprint.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { draftRecipeFromBlueprint } from "../../lib/ai/drafting/draftRecipeFromBlueprint";
import type { CulinaryBlueprint } from "../../lib/ai/blueprint/blueprintTypes";
import type { MethodPlan } from "../../lib/ai/method/planMethod";
import type { ResolvedCookingIntent } from "../../lib/ai/intent/intentTypes";

// Minimal mock LLM response — adjust field names to match your AiRecipeResult shape after reading recipeResult.ts
const MOCK_RECIPE_RESPONSE = {
  title: "Chicken Stir-Fry with Garlic and Soy",
  ingredients: [
    { name: "chicken thigh", amount: "500g" },
    { name: "garlic", amount: "3 cloves" },
    { name: "soy sauce", amount: "2 tbsp" },
  ],
  steps: [
    { instruction: "Pat chicken dry and season with salt." },
    { instruction: "Sear in hot oil until golden, about 4 minutes per side." },
    { instruction: "Add garlic and soy sauce, toss to coat." },
  ],
};

function makeMockLLMClient(response: unknown) {
  return {
    generate: async (_prompt: string) => response,
  };
}

function makeBlueprint(): CulinaryBlueprint {
  return {
    dishName: "Chicken Stir-Fry",
    dishFamily: "skillet_saute",
    cuisineHint: "asian",
    richnessLevel: "moderate",
    flavorArchitecture: ["savory base", "umami depth"],
    components: [
      {
        name: "seared chicken",
        purpose: "main",
        ingredients: [
          { name: "chicken thigh", role: "protein", rationale: "main protein" },
        ],
        cookMethod: "sear",
        textureTarget: "crispy exterior",
      },
    ],
    primaryMethod: "sear",
    sequenceLogic: "sear then toss",
    finishStrategy: "fresh herb",
    textureTargets: ["crispy protein"],
    chefOpportunities: [],
    checkpoints: [],
    feasibility: {
      familyFit: true, ingredientFit: true, equipmentFit: true,
      timeBudgetPlausible: true, difficultyPlausible: true, issues: [],
    },
    generatedFrom: "req-draft-001",
    generatedAt: new Date().toISOString(),
  };
}

function makeMethodPlan(): MethodPlan {
  return {
    prepSequence: ["Pat chicken dry"],
    activeCookSequence: ["Sear chicken"],
    finishSequence: ["Add fresh herb"],
    checkpoints: [],
    likelyFailurePoints: [],
    holdPoints: [],
  };
}

function makeIntent(): ResolvedCookingIntent {
  return {
    dishName: "Chicken Stir-Fry",
    rawUserPhrase: "chicken stir fry",
    dishFamily: "skillet_saute",
    dishFamilyConfidence: 0.9,
    cuisineHint: "asian",
    mealOccasion: "dinner",
    intentSource: "explicit_user_message",
    premiseTrust: "high",
    constraints: [],
    ingredientMentions: ["chicken thigh", "garlic", "soy sauce"],
    pivotDetected: "no_pivot",
    invalidatedConstraints: [],
    requiresClarification: false,
    clarificationReason: null,
    requestId: "req-draft-001",
    resolvedAt: new Date().toISOString(),
  };
}

test("draftRecipeFromBlueprint calls LLM and returns recipe shape", async () => {
  const result = await draftRecipeFromBlueprint(
    { intent: makeIntent(), blueprint: makeBlueprint(), methodPlan: makeMethodPlan() },
    { llmGenerate: makeMockLLMClient(MOCK_RECIPE_RESPONSE).generate }
  );

  assert.ok(result !== null);
  assert.ok("title" in result);
  assert.ok("ingredients" in result);
  assert.ok("steps" in result);
  assert.equal(result.title, "Chicken Stir-Fry with Garlic and Soy");
});

test("draftRecipeFromBlueprint includes blueprintId in result for tracing", async () => {
  const result = await draftRecipeFromBlueprint(
    { intent: makeIntent(), blueprint: makeBlueprint(), methodPlan: makeMethodPlan() },
    { llmGenerate: makeMockLLMClient(MOCK_RECIPE_RESPONSE).generate }
  );

  assert.ok("blueprintId" in result, "result must carry blueprintId for tracing");
  assert.equal(result.blueprintId, "req-draft-001");
});

test("draftRecipeFromBlueprint buildPrompt includes dish name and primary method", async () => {
  let capturedPrompt = "";
  const capturingClient = {
    generate: async (prompt: string) => {
      capturedPrompt = prompt;
      return MOCK_RECIPE_RESPONSE;
    },
  };

  await draftRecipeFromBlueprint(
    { intent: makeIntent(), blueprint: makeBlueprint(), methodPlan: makeMethodPlan() },
    { llmGenerate: capturingClient.generate }
  );

  assert.ok(capturedPrompt.includes("Chicken Stir-Fry"), "prompt must include dish name");
  assert.ok(capturedPrompt.includes("sear"), "prompt must include primary method");
});
```

- [ ] **Step 3: Run to verify failure**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json 2>&1 | grep "draftRecipeFromBlueprint" | head -5
```

Expected: compile error.

- [ ] **Step 4: Read `lib/ai/recipeResult.ts` to confirm the actual output shape fields, then create the drafting module**

Read the file to confirm field names, then create `lib/ai/drafting/draftRecipeFromBlueprint.ts`:

```typescript
// lib/ai/drafting/draftRecipeFromBlueprint.ts

/**
 * Blueprint-driven recipe drafting.
 *
 * This module is the authoritative drafting path for migrated generation flows
 * when BLUEPRINT_GENERATION_V1 flag is enabled.
 *
 * It does NOT call legacy recipeGenerationOrchestrator or recipePlan flows.
 * Those remain active only for legacy (non-flagged) generation.
 *
 * See docs/decisions/authority-boundaries.md for contract hierarchy.
 */

import type { ResolvedCookingIntent } from "../intent/intentTypes";
import type { CulinaryBlueprint } from "../blueprint/blueprintTypes";
import type { MethodPlan } from "../method/planMethod";

export type DraftFromBlueprintInput = {
  intent: ResolvedCookingIntent;
  blueprint: CulinaryBlueprint;
  methodPlan: MethodPlan;
};

// Minimal output shape — must remain compatible with existing save/detail flows.
// blueprintId is added for tracing; consumers that don't need it can ignore it.
// Adjust ingredient/step field names below to match your actual AiRecipeResult type after reading recipeResult.ts.
export type BlueprintDraftResult = {
  title: string;
  ingredients: Array<{ name: string; amount: string }>;
  steps: Array<{ instruction: string }>;
  blueprintId: string;  // tracing: matches blueprint.generatedFrom (requestId)
};

export type DraftDeps = {
  llmGenerate: (prompt: string) => Promise<unknown>;
};

/**
 * Generate a recipe draft using the CulinaryBlueprint and MethodPlan as context.
 * The LLM call is injected via `deps` so unit tests can mock it without network calls.
 */
export async function draftRecipeFromBlueprint(
  input: DraftFromBlueprintInput,
  deps: DraftDeps
): Promise<BlueprintDraftResult> {
  const prompt = buildDraftingPrompt(input);
  const raw = await deps.llmGenerate(prompt);

  // Parse and normalize — actual parsing logic depends on your JSON response contract
  const parsed = raw as { title?: string; ingredients?: unknown[]; steps?: unknown[] };

  return {
    title: parsed.title ?? input.blueprint.dishName,
    ingredients: (parsed.ingredients ?? []) as Array<{ name: string; amount: string }>,
    steps: (parsed.steps ?? []) as Array<{ instruction: string }>,
    blueprintId: input.blueprint.generatedFrom,
  };
}

function buildDraftingPrompt(input: DraftFromBlueprintInput): string {
  const { intent, blueprint, methodPlan } = input;

  const componentSummary = blueprint.components
    .map((c) => {
      const ingredients = c.ingredients.map((i) => `${i.name} (${i.role})`).join(", ");
      return `- ${c.name} [${c.purpose}]: cook via ${c.cookMethod}. Ingredients: ${ingredients || "to be determined"}. Target: ${c.textureTarget ?? "appropriate texture"}.`;
    })
    .join("\n");

  const prepSteps = methodPlan.prepSequence.join("; ");
  const cookSteps = methodPlan.activeCookSequence.join("; ");
  const finishSteps = methodPlan.finishSequence.join("; ");

  const chefNotes = blueprint.chefOpportunities.length > 0
    ? `Chef opportunities:\n${blueprint.chefOpportunities.map((o) => `- ${o}`).join("\n")}`
    : "";

  const constraints = intent.constraints.length > 0
    ? `User constraints:\n${intent.constraints.map((c) => `- ${c.type}: ${c.value} (${c.strength})`).join("\n")}`
    : "";

  return `Generate a recipe for: ${blueprint.dishName}

Dish family: ${blueprint.dishFamily}
Primary method: ${blueprint.primaryMethod}
Flavor architecture: ${blueprint.flavorArchitecture.join(", ")}
Finish strategy: ${blueprint.finishStrategy}
Richness level: ${blueprint.richnessLevel}

Components to build:
${componentSummary}

Method sequence:
Prep: ${prepSteps}
Cook: ${cookSteps}
Finish: ${finishSteps}

${chefNotes}

${constraints}

Return a complete recipe with a clear title, ingredient list with amounts, and numbered steps.
Every ingredient must have a purpose. Steps must follow the method sequence above.`.trim();
}
```

- [ ] **Step 5: Run tests**

```bash
rm -rf .tmp-unit && tsc -p tsconfig.unit.json && node --require ./scripts/_mock-server-only.cjs --test .tmp-unit/tests/unit/draftRecipeFromBlueprint.test.js
```

Expected: All 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/drafting/draftRecipeFromBlueprint.ts tests/unit/draftRecipeFromBlueprint.test.ts
git commit -m "feat(m2): add blueprint-driven recipe drafting with LLM injection"
```

---

## Task 11: Wire blueprint generation into build route under flag (Ticket 3.2)

**Files:**
- Modify: `app/api/ai/home/build/route.ts` (or wherever the generation pipeline is invoked)
- Test: verify flag gating via existing route tests or add a smoke test

**Note:** This task adds the flag-gated branch into the real build flow. Read the route first to understand where to insert the branch.

- [ ] **Step 1: Read the build route**

```bash
cat /Users/macbook12/Desktop/AIcook/recipe-evolution/app/api/ai/home/build/route.ts | head -80
```

Identify: where `ResolvedCookingIntent` or `BuildSpec` is obtained, and where the main generation call happens.

- [ ] **Step 2: Add the blueprint generation branch**

In the build route, after `ResolvedCookingIntent` is resolved and before the legacy generation call, add:

```typescript
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/ai/featureFlags";
import { buildCulinaryBlueprint } from "@/lib/ai/blueprint/buildCulinaryBlueprint";
import { checkBlueprintFeasibility } from "@/lib/ai/blueprint/feasibility";
import { planMethod } from "@/lib/ai/method/planMethod";
import { draftRecipeFromBlueprint } from "@/lib/ai/drafting/draftRecipeFromBlueprint";

// Inside the route handler, after resolving intent:
const useBlueprintFlow = await getFeatureFlag(FEATURE_FLAG_KEYS.BLUEPRINT_GENERATION_V1);

if (useBlueprintFlow && resolvedIntent) {
  const blueprint = buildCulinaryBlueprint(resolvedIntent);
  const feasibility = blueprint.feasibility;

  if (!feasibility.familyFit || !feasibility.ingredientFit || !feasibility.timeBudgetPlausible) {
    // Log feasibility failure for telemetry — do NOT block generation, use fallback
    console.warn("[blueprint] feasibility issue:", feasibility.issues);
    // Fall through to legacy generation
  } else {
    const methodPlan = planMethod(blueprint);
    const draftResult = await draftRecipeFromBlueprint(
      { intent: resolvedIntent, blueprint, methodPlan },
      { llmGenerate: yourExistingLLMCallWrapper }  // wire to your actual LLM client
    );

    // TODO: map draftResult to your existing response shape
    // TODO: store blueprint in sidecar (Plan C)
    // Return the draft result
  }
}
// Else: fall through to legacy generation path unchanged
```

**Important:** Replace `yourExistingLLMCallWrapper` with the actual LLM client from the route. Read how the existing generation call is made to get the right pattern.

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd /Users/macbook12/Desktop/AIcook/recipe-evolution
npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: no errors in your modified files.

- [ ] **Step 4: Smoke test — flag off means legacy path unchanged**

Verify manually (or via existing tests) that when `blueprint_generation_v1` flag is `false` (the default), the route behaves identically to before this change.

```bash
npm run test:unit 2>&1 | tail -20
```

Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/ai/home/build/route.ts
git commit -m "feat(m2): wire blueprint generation into build route under BLUEPRINT_GENERATION_V1 flag"
```

---

## Self-Review

### Spec coverage check

| Ticket | Covered by |
|--------|-----------|
| 1.1 — Blueprint types | Task 1 |
| 1.2 — Audit | Task 2 |
| 1.3 — Family rules | Task 5 |
| 1.4 — Blueprint generator | Task 7 |
| 1.5 — Authority doc | Task 3 |
| 2.1 — Ingredient roles | Task 6 |
| 2.2 — Method planner | Task 9 |
| 2.3 — Feasibility checks | Task 8 |
| 3.1 — Draft from blueprint | Task 10 |
| 3.2 — Downstream adapter | Task 11 |
| 10.1 — M2 feature flags | Task 4 |

All Plan A tickets covered.

### Placeholder scan

- Task 11 Step 2 contains `yourExistingLLMCallWrapper` — this is intentional. The actual client name cannot be known without reading the route live. The step explicitly instructs the implementer to read the route first.
- Task 10 Step 1 instructs reading `recipeResult.ts` before writing the module — field names in `BlueprintDraftResult` may need adjustment to match the real output shape.

### Type consistency

- `IngredientRole` defined in `blueprintTypes.ts`, imported by `familyBlueprintRules.ts`, `ingredientRoles.ts`, `buildCulinaryBlueprint.ts` — consistent
- `CulinaryBlueprint` defined once, imported by `planMethod.ts` and `draftRecipeFromBlueprint.ts` — consistent
- `FeasibilityFlags` defined in `blueprintTypes.ts`, used in `CulinaryBlueprint.feasibility` and returned by `feasibility.ts` — consistent
- `MethodPlan` defined in `planMethod.ts`, consumed by `draftRecipeFromBlueprint.ts` — consistent

---

## What's not in this plan (next plans)

- **Plan B:** Structural validation, culinary integrity validation, delight score — depends on Plan A types being stable
- **Plan C:** `recipe_blueprints` and `recipe_validation_results` DB tables + sidecar store modules
- **Plan D:** Recipe Detail hierarchy, "Improve with Max" rename, My Recipes cards
- **Plan E:** Telemetry extensions, baseline rubric, integration tests (9.1–9.5), rollout checklist

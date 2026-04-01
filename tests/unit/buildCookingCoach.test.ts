import test from "node:test";
import assert from "node:assert/strict";
import { buildCookingCoach } from "../../lib/ai/coaching/buildCookingCoach";
import type { CulinaryBlueprint } from "../../lib/ai/blueprint/blueprintTypes";
import type { MethodPlan } from "../../lib/ai/method/planMethod";
import type { ResolvedCookingIntent } from "../../lib/ai/intent/intentTypes";
import type { RecipeDraft } from "../../lib/recipes/recipeDraft";

function makeIntent(overrides: Partial<ResolvedCookingIntent> = {}): ResolvedCookingIntent {
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
    requestId: "req-coach-001",
    resolvedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeBlueprint(family = "skillet_saute"): CulinaryBlueprint {
  return {
    dishName: "Chicken Stir-Fry",
    dishFamily: family,
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
        textureTarget: null,
      },
    ],
    primaryMethod: "sear then deglaze",
    sequenceLogic: "sear, then deglaze, then toss",
    finishStrategy: "fresh herb",
    textureTargets: ["crispy protein", "silky sauce"],
    chefOpportunities: [],
    checkpoints: [],
    feasibility: {
      familyFit: true,
      ingredientFit: true,
      equipmentFit: true,
      timeBudgetPlausible: true,
      difficultyPlausible: true,
      issues: [],
    },
    generatedFrom: "req-coach-001",
    generatedAt: new Date().toISOString(),
  };
}

function makeMethodPlan(): MethodPlan {
  return {
    prepSequence: ["Pat chicken dry"],
    activeCookSequence: ["Sear chicken over high heat"],
    finishSequence: ["Add fresh herb"],
    checkpoints: [],
    likelyFailurePoints: [],
    holdPoints: ["Rest 3 min"],
  };
}

function makeRecipe(): RecipeDraft {
  return {
    title: "Chicken Stir-Fry with Garlic and Soy",
    description: null,
    tags: null,
    servings: 4,
    prep_time_min: 15,
    cook_time_min: 20,
    difficulty: null,
    ingredients: [
      { name: "500g chicken thigh, cut into strips" },
      { name: "3 cloves garlic, minced" },
      { name: "2 tbsp soy sauce" },
    ],
    steps: [
      { text: "Pat chicken dry and season with salt." },
      { text: "Sear in hot oil over high heat, 4 minutes per side." },
      { text: "Add garlic, then soy sauce. Toss to coat." },
    ],
    notes: null,
    change_log: null,
    ai_metadata_json: null,
  };
}

test("buildCookingCoach returns a CookingCoach with all required fields", () => {
  const coach = buildCookingCoach(makeIntent(), makeBlueprint(), makeRecipe(), makeMethodPlan());
  assert.ok(Array.isArray(coach.chefSecrets));
  assert.ok(Array.isArray(coach.watchFors));
  assert.ok(Array.isArray(coach.mistakePreviews));
  assert.ok(Array.isArray(coach.recoveryMoves));
  assert.equal(typeof coach.generatedFrom, "string");
  assert.equal(typeof coach.generatedAt, "string");
});

test("buildCookingCoach sets generatedFrom to intent.requestId", () => {
  const coach = buildCookingCoach(makeIntent(), makeBlueprint(), makeRecipe(), makeMethodPlan());
  assert.equal(coach.generatedFrom, "req-coach-001");
});

test("buildCookingCoach produces at least 1 chef secret for skillet_saute", () => {
  const coach = buildCookingCoach(makeIntent(), makeBlueprint("skillet_saute"), makeRecipe(), makeMethodPlan());
  assert.ok(coach.chefSecrets.length >= 1);
});

test("buildCookingCoach produces at most 2 chef secrets", () => {
  const coach = buildCookingCoach(makeIntent(), makeBlueprint(), makeRecipe(), makeMethodPlan());
  assert.ok(coach.chefSecrets.length <= 2);
});

test("buildCookingCoach produces at least 1 watch-for", () => {
  const coach = buildCookingCoach(makeIntent(), makeBlueprint(), makeRecipe(), makeMethodPlan());
  assert.ok(coach.watchFors.length >= 1);
});

test("buildCookingCoach includes dry_protein recovery for chicken dish", () => {
  const coach = buildCookingCoach(
    makeIntent(),
    makeBlueprint("chicken_dinners"),
    makeRecipe(),
    makeMethodPlan()
  );
  const hasProteinRescue = coach.recoveryMoves.some((m) => m.scenario === "dry_protein");
  assert.ok(hasProteinRescue, "expected dry_protein recovery move for chicken dish");
});

test("buildCookingCoach includes recovery moves for pasta dish", () => {
  const pastaRecipe = makeRecipe();
  const coach = buildCookingCoach(
    makeIntent({ dishFamily: "pasta" }),
    makeBlueprint("pasta"),
    pastaRecipe,
    makeMethodPlan()
  );
  assert.ok(coach.recoveryMoves.length > 0);
});

test("buildCookingCoach is deterministic — same inputs same output", () => {
  const intent = makeIntent();
  const blueprint = makeBlueprint();
  const recipe = makeRecipe();
  const plan = makeMethodPlan();
  const coach1 = buildCookingCoach(intent, blueprint, recipe, plan);
  const coach2 = buildCookingCoach(intent, blueprint, recipe, plan);
  assert.deepEqual(coach1.chefSecrets.map((s) => s.text), coach2.chefSecrets.map((s) => s.text));
  assert.deepEqual(coach1.watchFors.map((w) => w.cue), coach2.watchFors.map((w) => w.cue));
  assert.deepEqual(coach1.recoveryMoves.map((r) => r.scenario), coach2.recoveryMoves.map((r) => r.scenario));
});

test("buildCookingCoach works for all launch families without throwing", () => {
  const families = [
    "skillet_saute", "pasta", "soups_stews", "sheet_pan",
    "chicken_dinners", "rice_grain_bowls", "roasted_vegetables", "baked_casseroles",
  ];
  for (const family of families) {
    const coach = buildCookingCoach(
      makeIntent({ dishFamily: family }),
      makeBlueprint(family),
      makeRecipe(),
      makeMethodPlan()
    );
    assert.ok(coach.chefSecrets.length >= 1, `No chef secret for ${family}`);
    assert.ok(coach.recoveryMoves.length >= 1, `No recovery moves for ${family}`);
  }
});

test("buildCookingCoach watch-fors have valid importance levels", () => {
  const coach = buildCookingCoach(makeIntent(), makeBlueprint(), makeRecipe(), makeMethodPlan());
  const validImportance = new Set(["critical", "important", "nice_to_know"]);
  for (const wf of coach.watchFors) {
    assert.ok(validImportance.has(wf.importance), `Invalid importance: ${wf.importance}`);
  }
});

import {
  CHEF_EXPECTED_RULES_SEED,
  CHEF_FIX_STRATEGIES_SEED,
  CHEF_RULES_SEED,
  type ChefExpectedRuleRecord,
  type ChefFixStrategyRecord,
  type ChefRuleRecord,
  type ChefScoreProfileRecord,
} from "./chefCatalog";
import { applyChefActions, buildChefIntelligence, type ChefEditAction } from "./chefIntelligence";

export type RecipeAnalysis = {
  recipeVersionId?: string | null;
  recipeId?: string | null;
  recipeTitle: string;
  recipeCategory: string;
  ingredients: string[];
  steps: string[];
  tags: string[];
  always: true;
  isBaking: boolean;
  isCookies: boolean;
  isProtein: boolean;
  isLeanProtein: boolean;
  isChicken: boolean;
  isDough: boolean;
  isSourdough: boolean;
  isNonDairyBaking: boolean;
  isSauce: boolean;
  isPasta: boolean;
  isRice: boolean;
  isRisotto: boolean;
  isGrains: boolean;
  isGrilling: boolean;
  usesSearMethod: boolean;
  usesSauteMethod: boolean;
  usesHighHeat: boolean;
  usesCreamingMethod: boolean;
  usesLowFatDairy: boolean;
  isToughCut: boolean;
  hasSkinOnProtein: boolean;
  hasSpices: boolean;
  hasHerbs: boolean;
  hasHighAcid: boolean;
  hasButter: boolean;
  hasBrownSugar: boolean;
  hasFlour: boolean;
  hasEgg: boolean;
  hasFrozenFruit: boolean;
  hasMushrooms: boolean;
  hasGarlic: boolean;
  hasCheese: boolean;
  hasHighIngredientCount: boolean;
  ingredientCount: number;
  hasBakeTemperature: boolean;
  hasDonenessCue: boolean;
  hasCoolingStep: boolean;
  hasChillStep: boolean;
  hasSaltIngredient: boolean;
  hasFatBehaviorGuidance: boolean;
  hasInternalTempCue: boolean;
  hasRestStep: boolean;
  hasDrySurfaceCue: boolean;
  hasSeasoningCue: boolean;
  hasGarlicTimingCue: boolean;
  hasCheeseHeatCue: boolean;
  hasFrozenFruitGuidance: boolean;
  hasMushroomBrowningCue: boolean;
  hasFinalSeasoningCue: boolean;
  hasPastaWaterCue: boolean;
  hasGentleHeatCue: boolean;
  hasPastaFinishCue: boolean;
  hasSkinRenderingCue: boolean;
  hasCarryoverCue: boolean;
  hasSauceTighteningCue: boolean;
  hasStorageTip: boolean;
  hasMakeAheadTip: boolean;
};

export type ChefScoreFactor = {
  factorType: "positive_rule" | "missing_expected_rule" | "risk_flag" | "clarity_issue" | "chef_bonus";
  factorKey: string;
  impact: number;
  explanation: string;
  bucket: keyof ChefSubscores;
};

export type ChefSubscores = {
  flavor: number;
  technique: number;
  texture: number;
  harmony: number;
  clarity: number;
  risk: number;
  extras: number;
};

export type ChefScoreResult = {
  totalScore: number;
  scoreBand: string;
  summary: string;
  subscores: ChefSubscores;
  improvementPriorities: string[];
  riskFlags: string[];
  factors: ChefScoreFactor[];
  analysis: RecipeAnalysis;
  matchedRules: ChefRuleRecord[];
  missedExpectedRules: Array<{ key: string; description: string; bucket: keyof ChefSubscores; impact: number }>;
  conflicts: Array<{ type: "overlap" | "coverage_gap"; message: string; ruleKeys: string[] }>;
  intelligence: ReturnType<typeof buildChefIntelligence>;
};

type ScoreAccumulator = {
  subscores: ChefSubscores;
  factors: ChefScoreFactor[];
  riskFlags: string[];
};

const DEFAULT_SCORE_PROFILE: ChefScoreProfileRecord = {
  recipeCategory: "general",
  flavorWeight: 20,
  techniqueWeight: 20,
  textureWeight: 15,
  harmonyWeight: 15,
  clarityWeight: 10,
  riskWeight: 10,
  extrasWeight: 10,
};

function lower(values: string[]) {
  return values.map((value) => value.toLowerCase());
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreBand(total: number) {
  if (total >= 90) return "Chef-strong";
  if (total >= 80) return "Very solid";
  if (total >= 70) return "Good foundation";
  if (total >= 60) return "Functional but inconsistent";
  return "Fragile recipe";
}

export function analyzeRecipeForChefScore(input: {
  recipeTitle: string;
  ingredients: string[];
  steps: string[];
  recipeVersionId?: string | null;
  recipeId?: string | null;
  tags?: string[] | null;
}): RecipeAnalysis {
  const title = input.recipeTitle.toLowerCase();
  const ingredients = lower(input.ingredients);
  const steps = lower(input.steps);
  const fullText = [title, ...ingredients, ...steps].join(" ");
  const tags = lower(input.tags ?? []);
  const proteinTerms = /\b(chicken|steak|beef|pork|salmon|shrimp|turkey|tofu|tempeh|fish)\b/;
  const bakedGoodTerms = /\b(cookie|cake|brownie|muffin|biscuit|scone|bread|loaf|pie|tart|cupcake)\b/;
  const isCookies = /\bcookies?\b/.test(fullText);
  const isChicken = /\bchicken\b/.test(fullText);
  const isProtein = proteinTerms.test(fullText);
  const isBaking = bakedGoodTerms.test(fullText) || (/\b(bake|baked|baking)\b/.test(fullText) && !isProtein);
  const isSweetBake = /\b(cookie|cake|brownie|muffin|biscuit|scone|cupcake)\b/.test(fullText);
  const isLeanProtein = /\b(chicken breast|turkey breast|shrimp|white fish|cod|tilapia)\b/.test(fullText);
  const isDough = /\bdough\b/.test(fullText);
  const isSourdough = /\bsourdough discard\b/.test(fullText);
  const isNonDairyBaking =
    isBaking &&
    (isSweetBake || isCookies) &&
    (/\b(vegan butter|plant butter|coconut oil|oat milk|almond milk|soy milk|non-dairy|dairy-free)\b/.test(fullText) ||
      (!/\b(butter|milk|cream|yogurt)\b/.test(fullText) && /\b(oil|margarine)\b/.test(fullText)));
  const isSauce = /\b(sauce|glaze|gravy|vinaigrette|dressing)\b/.test(fullText);
  const isPasta = /\b(pasta|spaghetti|penne|rigatoni|linguine|fettuccine)\b/.test(fullText);
  const isRice = /\brice\b/.test(fullText);
  const isRisotto = /\brisotto\b/.test(fullText);
  const hasStandaloneGrainCue = /\b(quinoa|farro|barley|bulgur|couscous|pilaf|grain bowl)\b/.test(fullText);
  const isGrains = isRice || isRisotto || hasStandaloneGrainCue;
  const isGrilling = /\b(grill|grilled|barbecue|bbq)\b/.test(fullText);
  const usesSearMethod = /\b(sear|brown)\b/.test(fullText);
  const usesSauteMethod = /\b(saute|sauté|skillet|pan)\b/.test(fullText);
  const usesHighHeat = /\b(high heat|broil|sear)\b/.test(fullText);
  const usesCreamingMethod = /\b(cream butter|cream the butter|beat butter and sugar)\b/.test(fullText);
  const usesLowFatDairy = /\b(low-fat milk|skim milk|low-fat yogurt)\b/.test(fullText);
  const isToughCut = /\b(brisket|short rib|chuck|shoulder)\b/.test(fullText);
  const hasSkinOnProtein = /\b(?:skin-on|chicken thighs|chicken drumsticks|duck)\b/.test(fullText);
  const hasSpices = /\b(cumin|coriander|paprika|cinnamon|nutmeg|clove|cardamom|chili|spice)\b/.test(fullText);
  const hasHerbs = /\b(parsley|cilantro|basil|dill|oregano|thyme|rosemary|herb)\b/.test(fullText);
  const hasHighAcid = /\b(lemon|lime|vinegar|tomato|pickle|sourdough)\b/.test(fullText);
  const hasButter = /\bbutter\b/.test(fullText);
  const hasBrownSugar = /\bbrown sugar\b/.test(fullText);
  const hasFlour = /\bflour\b/.test(fullText);
  const hasEgg = /\begg\b/.test(fullText);
  const hasFrozenFruit = /\b(frozen blueberries|frozen berry|frozen fruit|frozen cherries|frozen raspberries)\b/.test(fullText);
  const hasMushrooms = /\bmushrooms?\b/.test(fullText);
  const hasGarlic = /\bgarlic\b/.test(fullText);
  const hasCheese = /\b(parmesan|cheddar|mozzarella|pecorino|gruyere|cheese)\b/.test(fullText);
  const ingredientCount = input.ingredients.length;
  const hasHighIngredientCount = ingredientCount > 12;
  const hasBakeTemperature = steps.some((step) => /\b\d{3,4}\s*°?\s*f\b|\b\d{3,4}\s*degrees\b/.test(step));
  const hasDonenessCue = steps.some((step) =>
    /\b(golden|lightly golden|edges are set|centers? still look slightly soft|soft in the center|until set|until browned|internal temperature|thermometer|until tender|until crisp|just cooked through|coats the back of a spoon)\b/.test(step)
  );
  const hasCoolingStep = steps.some((step) =>
    /\b(cool|cooling rack|wire rack|rack|let cool|cool completely|rest on the tray|rest in the pan|before slicing|before unmolding)\b/.test(step)
  );
  const hasChillStep = steps.some((step) => /\b(chill|refrigerat)\b/.test(step));
  const hasSaltIngredient = ingredients.some((ingredient) => /\bsalt\b/.test(ingredient));
  const hasFatBehaviorGuidance =
    steps.some((step) => /\b(cold dough|keep .* cold|soften\w*|melt faster|spread|if the dough starts to soften|dough temperature)\b/.test(step)) ||
    /\b(non-dairy fats? melt faster|spread risk)\b/.test(fullText);
  const hasInternalTempCue = steps.some((step) =>
    /\b\d{2,3}\s*(?:to|-)\s*\d{2,3}\s*°?\s*f\b|\b\d{2,3}\s*°?\s*f\b|\binternal temperature\b|\bthermometer\b|\breaches? \d{2,3}\b/.test(step)
  );
  const hasRestStep = steps.some((step) => /\b(rest|resting)\b/.test(step));
  const hasDrySurfaceCue = steps.some((step) => /\bpat .* dry|dry the surface|dry thoroughly\b/.test(step));
  const hasSeasoningCue = steps.some((step) => /\bseason|salt|pepper\b/.test(step));
  const hasGarlicTimingCue = steps.some((step) => /\b(add the garlic later|add garlic later|lower the heat before adding garlic|avoid burning the garlic|garlic after)\b/.test(step));
  const hasCheeseHeatCue = steps.some((step) => /\b(lower the heat|off the heat|remove from heat).*\b(cheese|parmesan|pecorino|cheddar|mozzarella)\b|\b(cheese|parmesan|pecorino|cheddar|mozzarella).*\b(off the heat|lower the heat)\b/.test(step));
  const hasFrozenFruitGuidance = steps.some((step) => /\b(frozen fruit|frozen blueberries|do not thaw|longer bake|extra moisture)\b/.test(step));
  const hasMushroomBrowningCue = steps.some((step) => /\b(moisture evaporates|cook off the moisture|until the mushrooms brown|do not crowd the mushrooms)\b/.test(step));
  const hasFinalSeasoningCue = steps.some((step) =>
    /\b(taste before serving|taste and adjust|adjust salt|adjust acid|season to taste|taste for seasoning|finish with lemon|finish with vinegar|add more salt if needed)\b/.test(step)
  );
  const hasPastaWaterCue = steps.some((step) => /\b(reserve .*pasta water|cup of pasta water|starchy pasta water|pasta water)\b/.test(step));
  const hasGentleHeatCue = steps.some((step) => /\b(low heat|gentle heat|warm gently|do not boil|avoid boiling|below a simmer|below simmer)\b/.test(step));
  const hasPastaFinishCue = steps.some((step) => /\b(glossy|coat the pasta|coats the pasta|clings to the pasta|emulsif)\b/.test(step));
  const hasSkinRenderingCue = steps.some((step) => /\b(render|skin-side down|skin side down|start with the skin side)\b/.test(step));
  const hasCarryoverCue = steps.some((step) => /\b(carryover|pull .* before it rises|pull .* at .* and rest)\b/.test(step));
  const hasSauceTighteningCue = steps.some((step) => /\b(tighten as it cools|tightens as it cools|slightly looser than|will thicken as it sits)\b/.test(step));
  const hasStorageTip = steps.some((step) => /\b(store|storage|airtight|leftovers)\b/.test(step));
  const hasMakeAheadTip = steps.some((step) => /\b(make ahead|ahead of time|overnight|chill overnight)\b/.test(step));

  let recipeCategory = "general";
  if (isCookies) recipeCategory = "cookies";
  else if (isChicken) recipeCategory = "chicken";
  else if (isBaking) recipeCategory = "baking";
  else if (isPasta) recipeCategory = "pasta";
  else if (isRice || isGrains) recipeCategory = "grains";
  else if (isSauce) recipeCategory = "sauce";
  else if (isProtein) recipeCategory = "protein";

  return {
    recipeVersionId: input.recipeVersionId ?? null,
    recipeId: input.recipeId ?? null,
    recipeTitle: input.recipeTitle,
    recipeCategory,
    ingredients,
    steps,
    tags,
    always: true,
    isBaking,
    isCookies,
    isProtein,
    isLeanProtein,
    isChicken,
    isDough,
    isSourdough,
    isNonDairyBaking,
    isSauce,
    isPasta,
    isRice,
    isRisotto,
    isGrains,
    isGrilling,
    usesSearMethod,
    usesSauteMethod,
    usesHighHeat,
    usesCreamingMethod,
    usesLowFatDairy,
    isToughCut,
    hasSkinOnProtein,
    hasSpices,
    hasHerbs,
    hasHighAcid,
    hasButter,
    hasBrownSugar,
    hasFlour,
    hasEgg,
    hasFrozenFruit,
    hasMushrooms,
    hasGarlic,
    hasCheese,
    hasHighIngredientCount,
    ingredientCount,
    hasBakeTemperature,
    hasDonenessCue,
    hasCoolingStep,
    hasChillStep,
    hasSaltIngredient,
    hasFatBehaviorGuidance,
    hasInternalTempCue,
    hasRestStep,
    hasDrySurfaceCue,
    hasSeasoningCue,
    hasGarlicTimingCue,
    hasCheeseHeatCue,
    hasFrozenFruitGuidance,
    hasMushroomBrowningCue,
    hasFinalSeasoningCue,
    hasPastaWaterCue,
    hasGentleHeatCue,
    hasPastaFinishCue,
    hasSkinRenderingCue,
    hasCarryoverCue,
    hasSauceTighteningCue,
    hasStorageTip,
    hasMakeAheadTip,
  };
}

export function matchesChefRule(analysis: RecipeAnalysis, rule: ChefRuleRecord) {
  const matchesTriggers = Object.entries(rule.triggerConditions).every(([key, value]) => {
    const actual = analysis[key as keyof RecipeAnalysis];
    if (Array.isArray(value)) {
      if (Array.isArray(actual)) {
        return value.some((item) => actual.includes(item));
      }
      return typeof actual === "string" ? value.includes(actual) : false;
    }
    return actual === value;
  });
  if (!matchesTriggers) {
    return false;
  }

  const blockedByExclusions = Object.entries(rule.exclusionConditions).some(([key, value]) => {
    const actual = analysis[key as keyof RecipeAnalysis];
    if (Array.isArray(value)) {
      if (Array.isArray(actual)) {
        return value.some((item) => actual.includes(item));
      }
      return typeof actual === "string" ? value.includes(actual) : false;
    }
    return actual === value;
  });

  return !blockedByExclusions;
}

export function matchChefRules(analysis: RecipeAnalysis, rules: ChefRuleRecord[] = CHEF_RULES_SEED) {
  return rules.filter((ruleRecord) => matchesChefRule(analysis, ruleRecord)).sort((a, b) => b.priority - a.priority);
}

function addFactor(acc: ScoreAccumulator, factor: ChefScoreFactor, bucketMaximums: ChefSubscores) {
  acc.factors.push(factor);
  acc.subscores[factor.bucket] = clamp(acc.subscores[factor.bucket] + factor.impact, 0, bucketMaximums[factor.bucket]);
}

function bucketMaximumsForProfile(profile?: ChefScoreProfileRecord): ChefSubscores {
  const active = profile ?? DEFAULT_SCORE_PROFILE;
  return {
    flavor: active.flavorWeight,
    technique: active.techniqueWeight,
    texture: active.textureWeight,
    harmony: active.harmonyWeight,
    clarity: active.clarityWeight,
    risk: active.riskWeight,
    extras: active.extrasWeight,
  };
}

function summarize(result: { total: number; riskFlags: string[]; topNegatives: ChefScoreFactor[]; analysis: RecipeAnalysis }) {
  const first = result.topNegatives[0]?.explanation ?? "The recipe has a workable base.";
  const second = result.topNegatives[1]?.explanation;
  const prefix =
    result.total >= 80 ? "This version is strong overall." : result.total >= 70 ? "This version has a good foundation." : "This version is promising but under-optimized.";
  return [prefix, first, second].filter(Boolean).join(" ");
}

export function calculateChefScore(input: {
  recipeTitle: string;
  ingredients: string[];
  steps: string[];
  recipeVersionId?: string | null;
  recipeId?: string | null;
  tags?: string[] | null;
  rules?: ChefRuleRecord[];
  expectedRules?: ChefExpectedRuleRecord[];
  profile?: ChefScoreProfileRecord;
}): ChefScoreResult {
  const analysis = analyzeRecipeForChefScore(input);
  const matchedRules = matchChefRules(analysis, input.rules ?? CHEF_RULES_SEED);
  const bucketMaximums = bucketMaximumsForProfile(input.profile);
  const intelligence = buildChefIntelligence({
    title: input.recipeTitle,
    ingredients: input.ingredients,
    steps: input.steps,
    notes: null,
  });

  const acc: ScoreAccumulator = {
    subscores: {
      flavor: 14,
      technique: 15,
      texture: 11,
      harmony: 12,
      clarity: 9,
      risk: 8,
      extras: 4,
    },
    factors: [],
    riskFlags: [...intelligence.riskFlags],
  };
  const missedExpectedRules: Array<{ key: string; description: string; bucket: keyof ChefSubscores; impact: number }> = [];

  if (analysis.hasSaltIngredient) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "salt_present", impact: 1, explanation: "Salt is present, which supports baseline flavor structure.", bucket: "flavor" }, bucketMaximums);
  }
  if (analysis.hasSpices) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "aromatic_support_present", impact: 1, explanation: "The recipe has an aromatic spice layer, which gives the flavor more depth.", bucket: "flavor" }, bucketMaximums);
  }
  if (analysis.hasDonenessCue) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "doneness_cue_present", impact: 2, explanation: "The recipe includes a sensory doneness cue instead of relying only on time.", bucket: "clarity" }, bucketMaximums);
  }
  if (analysis.hasBakeTemperature) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "bake_temperature_present", impact: 1, explanation: "A specific baking temperature makes the recipe easier to execute consistently.", bucket: "clarity" }, bucketMaximums);
  }
  if (analysis.hasCoolingStep) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "cooling_step_present", impact: 1, explanation: "A cooling step helps the final texture set properly.", bucket: "texture" }, bucketMaximums);
  }
  if (analysis.hasFinalSeasoningCue) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "final_seasoning_cue_present", impact: 1, explanation: "The recipe tells the cook to taste and adjust before serving, which improves final balance.", bucket: "flavor" }, bucketMaximums);
  }
  if (analysis.hasRestStep) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "rest_step_present", impact: 2, explanation: "The recipe includes a rest step, which improves texture and moisture retention.", bucket: "technique" }, bucketMaximums);
  }
  if (analysis.hasInternalTempCue) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "temp_cue_present", impact: 2, explanation: "Specific temperature guidance lowers the chance of overcooking or undercooking.", bucket: "risk" }, bucketMaximums);
  }
  if (analysis.usesLowFatDairy && analysis.hasGentleHeatCue) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "gentle_heat_cue_present", impact: 2, explanation: "The recipe explicitly keeps low-fat dairy on gentle heat, which reduces splitting risk.", bucket: "risk" }, bucketMaximums);
  }
  if (analysis.isPasta && analysis.hasPastaFinishCue) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "pasta_finish_cue_present", impact: 1, explanation: "The pasta method describes the intended glossy, sauce-clinging finish.", bucket: "texture" }, bucketMaximums);
  }
  if (analysis.isPasta && analysis.hasPastaWaterCue) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "pasta_water_cue_present", impact: 1, explanation: "The recipe reserves pasta water, which supports emulsified sauce texture.", bucket: "technique" }, bucketMaximums);
  }
  if (analysis.hasSkinOnProtein && analysis.hasSkinRenderingCue) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "skin_rendering_cue_present", impact: 1, explanation: "The recipe gives the cook a rendering cue for skin-on protein instead of only chasing color.", bucket: "technique" }, bucketMaximums);
  }
  if (analysis.isLeanProtein && analysis.hasCarryoverCue) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "carryover_cue_present", impact: 1, explanation: "Carryover guidance protects lean protein from overshooting doneness.", bucket: "risk" }, bucketMaximums);
  }
  if (analysis.isSauce && analysis.hasCheese && analysis.hasSauceTighteningCue) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "sauce_tightening_cue_present", impact: 1, explanation: "The recipe explains that cheese sauce tightens as it cools, which improves texture control.", bucket: "texture" }, bucketMaximums);
  }
  if (intelligence.notes.length > 0) {
    addFactor(acc, { factorType: "chef_bonus", factorKey: "chef_insights_present", impact: Math.min(intelligence.notes.length, 3), explanation: "Chef-facing notes are already present, which makes the recipe more teachable.", bucket: "extras" }, bucketMaximums);
  }
  if (analysis.isCookies && analysis.hasSaltIngredient) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "cookie_structure_baseline", impact: 1, explanation: "The base cookie formula has some structural support from salt and a recognizable format.", bucket: "harmony" }, bucketMaximums);
  }
  if (analysis.isCookies && analysis.hasChillStep) {
    addFactor(acc, { factorType: "positive_rule", factorKey: "cookie_chill_present", impact: 1, explanation: "The recipe proactively chills the dough, which improves consistency and spread control.", bucket: "technique" }, bucketMaximums);
  }
  if (analysis.isCookies && analysis.hasFatBehaviorGuidance) {
    addFactor(acc, { factorType: "chef_bonus", factorKey: "cookie_fat_guidance_present", impact: 1, explanation: "The recipe explains how dough temperature and fat behavior affect cookie spread.", bucket: "extras" }, bucketMaximums);
  }

  const fallbackCategory = analysis.isBaking ? "baking" : analysis.isProtein ? "protein" : "general";
  const expectedRulesSource = input.expectedRules ?? CHEF_EXPECTED_RULES_SEED;
  const specificExpectedRules = expectedRulesSource.filter((rule) => rule.category === analysis.recipeCategory);
  const expectedRules = specificExpectedRules.length > 0 ? specificExpectedRules : expectedRulesSource.filter((rule) => rule.category === fallbackCategory);
  for (const expected of expectedRules) {
    if (expected.key === "hasCheeseHeatCue" && !analysis.hasCheese) {
      continue;
    }
    if (expected.key === "hasFrozenFruitGuidance" && !analysis.hasFrozenFruit) {
      continue;
    }
    const actual = Boolean(analysis[expected.key as keyof RecipeAnalysis]);
    if (!actual) {
      missedExpectedRules.push({
        key: expected.key,
        description: expected.description,
        bucket: expected.bucket,
        impact: expected.impact,
      });
      addFactor(acc, {
        factorType: "missing_expected_rule",
        factorKey: expected.key,
        impact: expected.impact,
        explanation: expected.description,
        bucket: expected.bucket,
      }, bucketMaximums);
    }
  }

  if (analysis.isCookies && !analysis.hasChillStep && (analysis.isSourdough || analysis.isNonDairyBaking)) {
    acc.riskFlags.push("High spread risk");
    addFactor(acc, { factorType: "risk_flag", factorKey: "cookie_spread_risk", impact: -3, explanation: "This dough is likely to spread without chilling because the formula is structurally fragile.", bucket: "risk" }, bucketMaximums);
    addFactor(acc, { factorType: "clarity_issue", factorKey: "chill_step_missing", impact: -3, explanation: "The method does not tell the cook to chill a spread-prone dough.", bucket: "clarity" }, bucketMaximums);
  }
  if (analysis.isSourdough && !analysis.hasFatBehaviorGuidance) {
    addFactor(acc, { factorType: "risk_flag", factorKey: "sourdough_balance_missing", impact: -2, explanation: "The recipe does not explain how to balance the acidity of sourdough discard.", bucket: "flavor" }, bucketMaximums);
  }
  if (analysis.isNonDairyBaking && !analysis.hasFatBehaviorGuidance) {
    acc.riskFlags.push("Non-dairy fat spread risk");
    addFactor(acc, { factorType: "risk_flag", factorKey: "non_dairy_spread_risk", impact: -2, explanation: "The recipe does not call out that non-dairy fat softens and spreads faster.", bucket: "texture" }, bucketMaximums);
  }
  if (analysis.isChicken && !analysis.hasInternalTempCue) {
    acc.riskFlags.push("Chicken doneness risk");
    addFactor(acc, { factorType: "risk_flag", factorKey: "chicken_temp_missing", impact: -4, explanation: "Chicken is missing a reliable internal-temperature cue.", bucket: "risk" }, bucketMaximums);
  }
  if (analysis.hasFrozenFruit && !analysis.hasFrozenFruitGuidance) {
    acc.riskFlags.push("Frozen fruit moisture risk");
    addFactor(acc, { factorType: "risk_flag", factorKey: "frozen_fruit_guidance_missing", impact: -2, explanation: "The recipe uses frozen fruit without warning the cook about extra moisture and bake-time changes.", bucket: "texture" }, bucketMaximums);
  }
  if (analysis.hasGarlic && analysis.usesHighHeat && !analysis.hasGarlicTimingCue) {
    acc.riskFlags.push("Garlic burn risk");
    addFactor(acc, { factorType: "risk_flag", factorKey: "garlic_timing_missing", impact: -2, explanation: "The recipe uses garlic on high heat without guidance to prevent scorching.", bucket: "flavor" }, bucketMaximums);
  }
  if (analysis.hasCheese && analysis.isSauce && !analysis.hasCheeseHeatCue) {
    acc.riskFlags.push("Cheese split risk");
    addFactor(acc, { factorType: "risk_flag", factorKey: "cheese_heat_control_missing", impact: -2, explanation: "The sauce adds cheese without a heat-control cue, which raises the risk of splitting.", bucket: "risk" }, bucketMaximums);
  }
  if (analysis.hasMushrooms && analysis.usesHighHeat && !analysis.hasMushroomBrowningCue) {
    addFactor(acc, { factorType: "risk_flag", factorKey: "mushroom_browning_guidance_missing", impact: -2, explanation: "The recipe cooks mushrooms hard without explaining that they must first shed moisture before browning.", bucket: "texture" }, bucketMaximums);
  }
  if (analysis.isSauce && !analysis.hasFinalSeasoningCue) {
    addFactor(acc, { factorType: "missing_expected_rule", factorKey: "sauce_final_seasoning_missing", impact: -2, explanation: "The sauce does not include a final taste-and-adjust step before serving.", bucket: "flavor" }, bucketMaximums);
  }
  if (analysis.isProtein && !analysis.hasRestStep) {
    addFactor(acc, { factorType: "missing_expected_rule", factorKey: "protein_rest_missing", impact: -3, explanation: "The recipe omits a rest step that would improve juiciness and slicing.", bucket: "technique" }, bucketMaximums);
  }
  if (!analysis.steps.some((step) => /\b\d+\b/.test(step))) {
    addFactor(acc, { factorType: "clarity_issue", factorKey: "vague_timing", impact: -2, explanation: "The instructions are vague and do not give enough timing guidance.", bucket: "clarity" }, bucketMaximums);
  }

  const totalScore = clamp(
    acc.subscores.flavor +
      acc.subscores.technique +
      acc.subscores.texture +
      acc.subscores.harmony +
      acc.subscores.clarity +
      acc.subscores.risk +
      acc.subscores.extras,
    0,
    100
  );

  const topNegatives = [...acc.factors]
    .filter((factor) => factor.impact < 0)
    .sort((a, b) => a.impact - b.impact)
    .slice(0, 3);
  const conflicts: Array<{ type: "overlap" | "coverage_gap"; message: string; ruleKeys: string[] }> = [];
  const matchedByKey = new Set(matchedRules.map((rule) => rule.ruleKey));
  if (matchedByKey.has("cookie_structure_needs_cold_dough") && matchedByKey.has("chill_cookie_dough")) {
    conflicts.push({
      type: "overlap",
      message: "Multiple cookie chill rules matched for the same structural issue.",
      ruleKeys: ["cookie_structure_needs_cold_dough", "chill_cookie_dough"],
    });
  }
  if (analysis.isCookies && !analysis.hasChillStep && !matchedRules.some((rule) => rule.actionType === "add_step")) {
    conflicts.push({
      type: "coverage_gap",
      message: "Cookie spread risk was detected without a directly attachable fix rule.",
      ruleKeys: matchedRules.filter((rule) => rule.category === "special" || rule.category === "baking").map((rule) => rule.ruleKey),
    });
  }

  return {
    totalScore,
    scoreBand: scoreBand(totalScore),
    summary: summarize({ total: totalScore, riskFlags: acc.riskFlags, topNegatives, analysis }),
    subscores: acc.subscores,
    improvementPriorities: uniqueStrings(topNegatives.map((factor) => factor.explanation)).slice(0, 3),
    riskFlags: uniqueStrings(acc.riskFlags).slice(0, 5),
    factors: acc.factors,
    analysis,
    matchedRules,
    missedExpectedRules,
    conflicts,
    intelligence,
  };
}

export function compareChefScores(base: ChefScoreResult, candidate: ChefScoreResult) {
  const labels: Array<keyof ChefSubscores> = ["flavor", "technique", "texture", "harmony", "clarity", "risk", "extras"];
  const improvedAreas = labels.filter((label) => candidate.subscores[label] > base.subscores[label]).map(toLabel);
  const regressions = labels.filter((label) => candidate.subscores[label] < base.subscores[label]).map(toLabel);
  const baseFactorMap = new Map(base.factors.map((factor) => [factor.factorKey, factor]));
  const candidateFactorMap = new Map(candidate.factors.map((factor) => [factor.factorKey, factor]));
  const factorChanges = Array.from(new Set([...baseFactorMap.keys(), ...candidateFactorMap.keys()]))
    .map((factorKey) => {
      const baseFactor = baseFactorMap.get(factorKey);
      const candidateFactor = candidateFactorMap.get(factorKey);
      return {
        factorKey,
        delta: (candidateFactor?.impact ?? 0) - (baseFactor?.impact ?? 0),
        explanation: candidateFactor?.explanation ?? baseFactor?.explanation ?? factorKey,
      };
    })
    .filter((change) => change.delta !== 0);

  return {
    baseScore: base.totalScore,
    candidateScore: candidate.totalScore,
    delta: candidate.totalScore - base.totalScore,
    improvedAreas,
    regressions,
    improvementDrivers: factorChanges.filter((change) => change.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3),
    regressionDrivers: factorChanges.filter((change) => change.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3),
  };
}

function toLabel(key: keyof ChefSubscores) {
  return {
    flavor: "Flavor Balance",
    technique: "Technique Soundness",
    texture: "Texture Potential",
    harmony: "Ingredient Harmony",
    clarity: "Clarity & Usability",
    risk: "Failure Risk",
    extras: "Chef-Level Extras",
  }[key];
}

export function generateChefFixes(input: {
  score: ChefScoreResult;
  mode?: "reliability" | "flavor" | "expert";
  strategies?: ChefFixStrategyRecord[];
}) {
  const strategies = input.strategies ?? CHEF_FIX_STRATEGIES_SEED;
  const categoryBonus = (category: ChefFixStrategyRecord["category"]) =>
    input.mode === "reliability"
      ? category === "reliability" ? 4 : category === "quality" ? 2 : 0
      : input.mode === "flavor"
      ? category === "quality" ? 4 : category === "reliability" ? 2 : 0
      : input.mode === "expert"
      ? category === "teaching" ? 4 : category === "quality" ? 2 : 1
      : category === "reliability" ? 3 : category === "quality" ? 2 : 1;

  const candidateIssues = new Set<string>();
  const directIssues = new Set<string>();
  const issueReasons = new Map<string, { reasons: Set<string>; areas: Set<string> }>();
  const registerIssueReason = (issueKey: string, reason: string, area?: string) => {
    const existing = issueReasons.get(issueKey) ?? { reasons: new Set<string>(), areas: new Set<string>() };
    existing.reasons.add(reason);
    if (area) existing.areas.add(area);
    issueReasons.set(issueKey, existing);
  };
  const addDirectIssue = (issueKey: string, reason?: string, area?: string) => {
    candidateIssues.add(issueKey);
    directIssues.add(issueKey);
    if (reason) {
      registerIssueReason(issueKey, reason, area);
    }
  };
  for (const factor of input.score.factors) {
    const area = toLabel(factor.bucket);
    if (factor.factorKey === "hasChillStep" || factor.factorKey === "cookie_spread_risk" || factor.factorKey === "chill_step_missing") addDirectIssue("cookie_chill_step_missing", factor.explanation, area);
    if (factor.factorKey === "hasDonenessCue") addDirectIssue("vague_cookie_doneness", factor.explanation, area);
    if (factor.factorKey === "hasCoolingStep") {
      addDirectIssue(input.score.analysis.isCookies ? "cookie_cooling_step_missing" : "baking_cooling_step_missing", factor.explanation, area);
    }
    if (factor.factorKey === "hasFatBehaviorGuidance") {
      addDirectIssue(input.score.analysis.isNonDairyBaking ? "non_dairy_spread_risk" : "cookie_fat_behavior_guidance_missing", factor.explanation, area);
    }
    if (factor.factorKey === "non_dairy_spread_risk") addDirectIssue("non_dairy_spread_risk", factor.explanation, area);
    if (factor.factorKey === "sourdough_balance_missing") addDirectIssue("sourdough_balance_missing", factor.explanation, area);
    if (factor.factorKey === "hasInternalTempCue" || factor.factorKey === "chicken_temp_missing") addDirectIssue("protein_temp_guidance_missing", factor.explanation, area);
    if (factor.factorKey === "hasRestStep" || factor.factorKey === "protein_rest_missing") addDirectIssue("chicken_rest_step_missing", factor.explanation, area);
    if (factor.factorKey === "hasDrySurfaceCue") addDirectIssue("dry_surface_prep_missing", factor.explanation, area);
    if (factor.factorKey === "frozen_fruit_guidance_missing") addDirectIssue("frozen_fruit_moisture_missing", factor.explanation, area);
    if (factor.factorKey === "garlic_timing_missing") addDirectIssue("garlic_timing_control_missing", factor.explanation, area);
    if (factor.factorKey === "cheese_heat_control_missing") addDirectIssue("cheese_heat_control_missing", factor.explanation, area);
    if (factor.factorKey === "mushroom_browning_guidance_missing") addDirectIssue("mushroom_browning_guidance_missing", factor.explanation, area);
    if (factor.factorKey === "sauce_final_seasoning_missing") addDirectIssue("sauce_final_seasoning_missing", factor.explanation, area);
  }
  if (!input.score.analysis.hasStorageTip) {
    candidateIssues.add("storage_tip_missing");
    registerIssueReason("storage_tip_missing", "The recipe does not tell the cook how to store the finished dish.", "Chef-Level Extras");
  }
  if (!input.score.analysis.hasMakeAheadTip) {
    candidateIssues.add("make_ahead_tip_missing");
    registerIssueReason("make_ahead_tip_missing", "The recipe is missing make-ahead guidance that would make execution easier.", "Chef-Level Extras");
  }
  if (input.score.analysis.isSauce) {
    candidateIssues.add("acid_finish_missing");
    registerIssueReason("acid_finish_missing", "The sauce would benefit from a clearer finishing move to brighten the final flavor.", "Flavor Balance");
  }
  if (input.score.analysis.isPasta && !input.score.analysis.hasPastaWaterCue) {
    candidateIssues.add("pasta_water_missing");
    registerIssueReason("pasta_water_missing", "The pasta method is missing reserved pasta water for emulsifying the sauce.", "Technique Soundness");
  }
  if (input.score.analysis.isRice || input.score.analysis.isGrains) {
    candidateIssues.add("grain_rest_missing");
    registerIssueReason("grain_rest_missing", "The grain method is missing a rest step to finish texture cleanly.", "Texture Potential");
  }

  const fixes = strategies
    .filter((strategy) => candidateIssues.has(strategy.issueKey))
    .map((strategy) => ({
      ...strategy,
      rank: strategy.priority + strategy.expectedScoreImpact + categoryBonus(strategy.category) + (directIssues.has(strategy.issueKey) ? 3 : 0),
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3);

  const projectedDelta = fixes.reduce((sum, fix) => sum + fix.expectedScoreImpact, 0);
  return {
    currentScore: input.score.totalScore,
    projectedScore: clamp(input.score.totalScore + projectedDelta, 0, 100),
    projectedDelta,
    fixes: fixes.map((fix) => ({
      issueKey: fix.issueKey,
      title: fix.title,
      category: fix.category,
      rationale: fix.description,
      estimatedImpact: fix.expectedScoreImpact,
      targetAreas: Array.from(issueReasons.get(fix.issueKey)?.areas ?? []).slice(0, 2),
      targetReasons: Array.from(issueReasons.get(fix.issueKey)?.reasons ?? []).slice(0, 2),
      actions: fix.actions,
    })),
  };
}

export function applyChefFixActions(recipe: {
  title: string;
  ingredients: string[];
  steps: string[];
  notes?: string | null;
}, actions: ChefEditAction[]) {
  const fromIntelligence = buildChefIntelligence(recipe);
  const initialNotes = uniqueStrings([recipe.notes, ...fromIntelligence.notes]).join("\n");
  return applyChefActions({ ...recipe, notes: initialNotes || null }, actions);
}

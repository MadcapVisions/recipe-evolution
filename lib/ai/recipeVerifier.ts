import type { CookingBrief } from "./contracts/cookingBrief";
import type { CanonicalRecipeSessionState } from "./contracts/sessionState";
import type { VerificationResult } from "./contracts/verificationResult";
import { recipeMatchesRequestedDirection } from "./homeRecipeAlignment";
import { ingredientPhraseMatches } from "./ingredientCanonicalization";
import { createCachedResolver } from "./ingredientResolver";
import { ingredientsMatch } from "./ingredientMatching";
import { validateCulinaryFit } from "./culinaryValidator";
import { buildRequiredNamedIngredient, matchesRequiredIngredient, ingredientMentionedInSteps } from "./requiredNamedIngredient";
import { stepMentionsEquipment, stepSatisfiesMethod } from "./methodRegistry";

type RecipeLike = {
  title: string;
  description: string | null;
  ingredients: Array<{ name: string }>;
  /** methodTag is optional — present in AI pipeline, absent after DB round-trip. */
  steps: Array<{ text: string; methodTag?: string | null }>;
};

const GENERIC_TITLE_PATTERNS = [
  /^chef conversation recipe$/i,
  /^chef-directed /i,
  /^chef direction$/i,
  /^chef special$/i,
];

// Dish-format words that appear in derived titles (e.g. "Chicken Bowl", "Skillet Dinner") but
// would not reliably appear in a recipe's title/description/ingredients. The dish-family check
// in recipeMatchesRequestedDirection already enforces these, so centerpieceMatch should ignore them.
const CENTERPIECE_STOP_WORDS = new Set([
  "the", "a", "an", "with", "and", "of", "style", "recipe",
  "dish", "bowl", "dinner", "taco", "skillet",
  // Generic direction-title words that would never appear in recipe content
  "chef", "conversation", "direction", "base", "locked",
]);

function normalizeMatchToken(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.length > 4 && normalized.endsWith("es")) {
    return normalized.slice(0, -2);
  }
  if (normalized.length > 3 && normalized.endsWith("s")) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function buildVerificationContext(brief: CookingBrief, fallbackText = "") {
  return [
    brief.dish.normalized_name,
    brief.dish.dish_family,
    brief.dish.raw_user_phrase,
    brief.style.tags.join(" "),
    brief.style.texture_tags.join(" "),
    brief.style.format_tags.join(" "),
    brief.ingredients.required.join(" "),
    brief.ingredients.forbidden.join(" "),
    brief.directives.must_have.join(" "),
    brief.directives.must_not_have.join(" "),
    fallbackText,
  ]
    .filter(Boolean)
    .join(" ");
}

function titleQualityPass(title: string) {
  const trimmed = title.trim();
  if (trimmed.length < 4) return false;
  return !GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function requiredIngredientsPresent(
  recipe: RecipeLike,
  brief: CookingBrief,
  resolve: ReturnType<typeof createCachedResolver>
) {
  if (brief.ingredients.required.length === 0) return true;
  return brief.ingredients.required.every((constraint) => {
    const resolvedConstraint = resolve(constraint);
    return recipe.ingredients.some((item) => {
      const resolvedCandidate = resolve(item.name);
      // Primary: canonical matching
      if (ingredientsMatch(resolvedConstraint, resolvedCandidate, "canonical_with_family_fallback")) {
        return true;
      }
      // Fallback: legacy token overlap (preserves existing behavior for unresolved phrases)
      return ingredientPhraseMatches(constraint, item.name);
    });
  });
}

function forbiddenIngredientsAvoided(
  recipe: RecipeLike,
  brief: CookingBrief,
  resolve: ReturnType<typeof createCachedResolver>
) {
  if (brief.ingredients.forbidden.length === 0) return true;
  return brief.ingredients.forbidden.every((constraint) => {
    const resolvedConstraint = resolve(constraint);
    return !recipe.ingredients.some((item) => {
      const resolvedCandidate = resolve(item.name);
      // Primary: strict canonical matching for forbidden
      if (ingredientsMatch(resolvedConstraint, resolvedCandidate, "strict_canonical")) {
        return true;
      }
      // Fallback: legacy token overlap
      return ingredientPhraseMatches(constraint, item.name);
    });
  });
}

// Bread-type words that satisfy the "bread base" requirement for bread pudding.
const BREAD_PUDDING_BREAD_WORDS = [
  "bread", "brioche", "challah", "croissant", "panettone", "sourdough",
  "baguette", "pullman", "pain", "stale", "loaf",
];

// Egg/dairy words that satisfy the "custard base" requirement for bread pudding.
const BREAD_PUDDING_CUSTARD_WORDS = [
  "egg", "eggs", "milk", "cream", "custard",
];

function centerpieceMatch(recipe: RecipeLike, brief: CookingBrief) {
  if (!brief.ingredients.centerpiece) return true;

  const text = `${recipe.title} ${recipe.description ?? ""} ${recipe.ingredients.map((item) => item.name).join(" ")}`.toLowerCase();

  // Bread pudding is a composite dish — its "centerpiece" is a structural combination of
  // bread + custard base, not a single ingredient. Token matching would fail for bread
  // pudding made with brioche or challah because neither word contains "bread".
  if (brief.dish.dish_family === "bread_pudding") {
    const hasBreadBase = BREAD_PUDDING_BREAD_WORDS.some((w) => text.includes(w));
    const hasCustardBase = BREAD_PUDDING_CUSTARD_WORDS.some((w) => text.includes(w));
    if (!hasBreadBase || !hasCustardBase) {
      return false;
    }
    return true;
  }

  const normalizedCenterpiece = brief.ingredients.centerpiece.toLowerCase().trim();
  if (text.includes(normalizedCenterpiece)) {
    return true;
  }

  const centerpieceTokens = normalizedCenterpiece
    .split(/\s+/)
    .map(normalizeMatchToken)
    .filter((token) => token.length > 1 && !CENTERPIECE_STOP_WORDS.has(token));

  if (centerpieceTokens.length === 0) {
    return true;
  }

  const recipeTokens = new Set(
    text
      .split(/\s+/)
      .map(normalizeMatchToken)
      .filter((token) => token.length > 1)
  );
  const matchedTokenCount = centerpieceTokens.filter((token) => recipeTokens.has(token)).length;
  const requiredMatches = centerpieceTokens.length <= 2 ? centerpieceTokens.length : Math.ceil(centerpieceTokens.length * 0.6);

  return matchedTokenCount >= requiredMatches;
}

function specificDishNameMatch(recipe: RecipeLike, brief: CookingBrief) {
  const normalizedName = brief.dish.normalized_name?.trim();
  if (!normalizedName || brief.dish.dish_family) {
    return true;
  }

  const text = `${recipe.title} ${recipe.description ?? ""}`.toLowerCase();
  const normalizedDish = normalizedName.toLowerCase();
  if (text.includes(normalizedDish)) {
    return true;
  }

  const dishTokens = normalizedDish
    .split(/\s+/)
    .map(normalizeMatchToken)
    .filter((token) => token.length > 2 && !CENTERPIECE_STOP_WORDS.has(token));

  if (dishTokens.length === 0) {
    return true;
  }

  const recipeTokens = new Set(
    text
      .split(/\s+/)
      .map(normalizeMatchToken)
      .filter((token) => token.length > 2)
  );
  const matchedTokenCount = dishTokens.filter((token) => recipeTokens.has(token)).length;
  const requiredMatches = dishTokens.length <= 2 ? dishTokens.length : Math.ceil(dishTokens.length * 0.6);

  return matchedTokenCount >= requiredMatches;
}

function sessionSelectedDirectionMatch(recipe: RecipeLike, sessionState: CanonicalRecipeSessionState | null | undefined) {
  if (!sessionState?.active_dish.locked) {
    return true;
  }

  const candidateTitle = sessionState.selected_direction?.title?.trim() || sessionState.active_dish.title?.trim() || "";
  if (!candidateTitle) {
    return true;
  }

  const text = `${recipe.title} ${recipe.description ?? ""}`.toLowerCase();
  const normalizedTitle = candidateTitle.toLowerCase();
  if (text.includes(normalizedTitle)) {
    return true;
  }

  const titleTokens = normalizedTitle
    .split(/\s+/)
    .map(normalizeMatchToken)
    .filter((token) => token.length > 2 && !CENTERPIECE_STOP_WORDS.has(token));
  if (titleTokens.length === 0) {
    return true;
  }

  const recipeTokens = new Set(
    text
      .split(/\s+/)
      .map(normalizeMatchToken)
      .filter((token) => token.length > 2)
  );
  const matchedTokenCount = titleTokens.filter((token) => recipeTokens.has(token)).length;
  const requiredMatches = titleTokens.length <= 2 ? titleTokens.length : Math.ceil(titleTokens.length * 0.6);
  return matchedTokenCount >= requiredMatches;
}

// Style synonyms so that e.g. "crispy" in the brief passes when the AI writes "crunchy".
const STYLE_TAG_SYNONYMS: Record<string, string[]> = {
  crispy: ["crunchy", "crisp"],
  crunchy: ["crispy", "crisp"],
  bright: ["fresh", "vibrant", "zesty", "citrusy"],
  creamy: ["velvety", "silky", "smooth"],
  lighter: ["light", "refreshing"],
  richer: ["rich", "indulgent"],
  heartier: ["hearty", "robust", "filling"],
  spicy: ["spiced", "fiery", "peppery"],
};

function styleMatch(recipe: RecipeLike, brief: CookingBrief) {
  if (brief.style.tags.length === 0 && brief.style.texture_tags.length === 0 && brief.style.format_tags.length === 0) {
    return true;
  }
  const text = `${recipe.title} ${recipe.description ?? ""} ${recipe.steps.map((item) => item.text).join(" ")}`.toLowerCase();
  const targetTags = [...brief.style.tags, ...brief.style.texture_tags, ...brief.style.format_tags].filter(Boolean);
  return (
    targetTags.some((tag) => {
      const normalizedTag = tag.toLowerCase();
      if (text.includes(normalizedTag) || text.includes(normalizedTag.replace(/-/g, " "))) {
        return true;
      }
      const synonyms = STYLE_TAG_SYNONYMS[normalizedTag] ?? [];
      return synonyms.some((synonym) => text.includes(synonym));
    }) || targetTags.length === 0
  );
}

function requiredTechniquesPresent(recipe: RecipeLike, brief: CookingBrief) {
  if (brief.directives.required_techniques.length === 0) return true;
  return brief.directives.required_techniques.every((method) =>
    recipe.steps.some((step) => stepSatisfiesMethod(step, method))
  );
}

function equipmentLimitsPresent(recipe: RecipeLike, brief: CookingBrief) {
  if (brief.constraints.equipment_limits.length === 0) return true;
  return brief.constraints.equipment_limits.every((equipment) =>
    recipe.steps.some((step) => stepMentionsEquipment(step, equipment))
  );
}

export function verifyRecipeAgainstBrief(input: {
  recipe: RecipeLike;
  brief: CookingBrief | null | undefined;
  fallbackContext?: string;
  sessionState?: CanonicalRecipeSessionState | null;
}): VerificationResult {
  const brief = input.brief;
  if (!brief) {
    const titlePass = titleQualityPass(input.recipe.title);
    return {
      passes: titlePass,
      confidence: titlePass ? 0.55 : 0.2,
      score: titlePass ? 0.7 : 0.2,
      reasons: titlePass ? [] : ["Recipe title is too generic."],
      checks: {
        dish_family_match: true,
        style_match: true,
        centerpiece_match: true,
        required_ingredients_present: true,
        forbidden_ingredients_avoided: true,
        title_quality_pass: titlePass,
        recipe_completeness_pass: input.recipe.ingredients.length > 0 && input.recipe.steps.length > 0,
      },
      retry_strategy: titlePass ? "none" : "regenerate_stricter",
    };
  }

  const context = buildVerificationContext(brief, input.fallbackContext);
  const resolve = createCachedResolver();
  const dishFamilyMatch = recipeMatchesRequestedDirection(input.recipe, context) && specificDishNameMatch(input.recipe, brief);
  const selectedDirectionMatch = sessionSelectedDirectionMatch(input.recipe, input.sessionState);
  const titlePass = titleQualityPass(input.recipe.title);
  const requiredPass = requiredIngredientsPresent(input.recipe, brief, resolve);
  const forbiddenPass = forbiddenIngredientsAvoided(input.recipe, brief, resolve);
  const centerpiecePass = centerpieceMatch(input.recipe, brief);
  const stylePass = styleMatch(input.recipe, brief);
  const requiredTechniquesPass =
    requiredTechniquesPresent(input.recipe, brief) &&
    (input.sessionState?.hard_constraints.required_techniques.length
      ? input.sessionState.hard_constraints.required_techniques.every((method) =>
          input.recipe.steps.some((step) => stepSatisfiesMethod(step, method))
        )
      : true);
  const equipmentPass =
    equipmentLimitsPresent(input.recipe, brief) &&
    (input.sessionState?.hard_constraints.equipment_limits.length
      ? input.sessionState.hard_constraints.equipment_limits.every((equipment) =>
          input.recipe.steps.some((step) => stepMentionsEquipment(step, equipment))
        )
      : true);
  const completenessPass = input.recipe.ingredients.length > 0 && input.recipe.steps.length > 0;

  const culinary = validateCulinaryFit(
    brief.dish.dish_family,
    input.recipe.ingredients,
    input.recipe.steps
  );

  // Hard-required named ingredients — ingredient list presence + step usage
  const hardRequired = (brief.ingredients.requiredNamedIngredients ?? []).filter(
    (r) => r.requiredStrength === "hard"
  );
  const sessionHardRequired = (input.sessionState?.hard_constraints.required_named_ingredients ?? [])
    .filter((name) => name.trim().length > 0)
    .map((name) => buildRequiredNamedIngredient(name, "must_include"));
  const mergedHardRequired = [...hardRequired];
  for (const req of sessionHardRequired) {
    if (!mergedHardRequired.some((existing) => existing.normalizedName === req.normalizedName)) {
      mergedHardRequired.push(req);
    }
  }
  const recipeIngredientNames = input.recipe.ingredients.map((i) => i.name);
  const missingFromList = mergedHardRequired.filter(
    (req) => !recipeIngredientNames.some((name) => matchesRequiredIngredient(name, req))
  );
  const missingFromSteps = mergedHardRequired.filter(
    (req) =>
      recipeIngredientNames.some((name) => matchesRequiredIngredient(name, req)) &&
      !ingredientMentionedInSteps(req, input.recipe.steps)
  );
  const namedListPass = missingFromList.length === 0;
  const namedStepsPass = missingFromSteps.length === 0;
  const hasNamedRequirements = mergedHardRequired.length > 0;

  const checks = {
    dish_family_match: dishFamilyMatch && selectedDirectionMatch,
    style_match: stylePass,
    centerpiece_match: centerpiecePass,
    required_ingredients_present: requiredPass,
    forbidden_ingredients_avoided: forbiddenPass,
    required_techniques_present: requiredTechniquesPass,
    equipment_limits_present: equipmentPass,
    selected_direction_match: selectedDirectionMatch,
    title_quality_pass: titlePass,
    recipe_completeness_pass: completenessPass,
    culinary_family_valid: culinary.valid,
    ...(hasNamedRequirements && {
      required_named_ingredients_present: namedListPass,
      required_named_ingredients_used_in_steps: namedStepsPass,
    }),
  };
  const reasons: string[] = [];

  if (!dishFamilyMatch) reasons.push("Recipe drifted from the requested dish family or direction.");
  if (!selectedDirectionMatch) reasons.push("Recipe no longer matches the locked direction this session committed to.");
  if (!stylePass) reasons.push("Recipe does not reflect the requested style or texture cues.");
  if (!centerpiecePass) {
    if (brief.dish.dish_family === "bread_pudding") {
      reasons.push("Bread pudding must retain bread plus a custard base with eggs and milk or cream.");
    } else {
      reasons.push("Recipe lost the intended centerpiece ingredient or dish.");
    }
  }
  if (!requiredPass) reasons.push("Recipe is missing one or more required ingredients from the brief.");
  if (!forbiddenPass) reasons.push("Recipe includes an ingredient the user asked to avoid.");
  if (!requiredTechniquesPass) reasons.push("Recipe does not preserve the cooking method the user explicitly requested.");
  if (!equipmentPass) reasons.push("Recipe does not use the requested cooking tool or appliance.");
  if (!titlePass) reasons.push("Recipe title is too generic to save as a final recipe.");
  if (!completenessPass) reasons.push("Recipe is incomplete.");
  for (const v of culinary.violations) {
    if (v.severity === "error") reasons.push(v.message);
  }
  for (const req of missingFromList) {
    reasons.push(`Recipe is missing required ingredient "${req.normalizedName}" that the user explicitly requested.`);
  }
  for (const req of missingFromSteps) {
    reasons.push(`Required ingredient "${req.normalizedName}" appears in the ingredient list but is not used in any cooking step.`);
  }

  const passedChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;
  const score = totalChecks === 0 ? 0 : passedChecks / totalChecks;

  return {
    passes: reasons.length === 0,
    confidence: reasons.length === 0 ? 0.92 : Math.max(0.2, score),
    score,
    reasons,
    checks,
    culinary_violations: culinary.violations,
    retry_strategy: reasons.length === 0 ? "none" : "regenerate_stricter",
  };
}

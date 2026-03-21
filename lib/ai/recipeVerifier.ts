import type { CookingBrief } from "./contracts/cookingBrief";
import type { VerificationResult } from "./contracts/verificationResult";
import { recipeMatchesRequestedDirection } from "./homeRecipeAlignment";

type RecipeLike = {
  title: string;
  description: string | null;
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
};

const GENERIC_TITLE_PATTERNS = [
  /^chef conversation recipe$/i,
  /^chef-directed /i,
  /^chef direction$/i,
  /^chef special$/i,
];

const CENTERPIECE_STOP_WORDS = new Set(["the", "a", "an", "with", "and", "of", "style", "recipe", "dish"]);

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

function requiredIngredientsPresent(recipe: RecipeLike, brief: CookingBrief) {
  if (brief.ingredients.required.length === 0) return true;
  const text = recipe.ingredients.map((item) => item.name.toLowerCase()).join(" ");
  return brief.ingredients.required.every((ingredient) => text.includes(ingredient.toLowerCase()));
}

function forbiddenIngredientsAvoided(recipe: RecipeLike, brief: CookingBrief) {
  if (brief.ingredients.forbidden.length === 0) return true;
  const text = recipe.ingredients.map((item) => item.name.toLowerCase()).join(" ");
  return brief.ingredients.forbidden.every((ingredient) => !text.includes(ingredient.toLowerCase()));
}

function centerpieceMatch(recipe: RecipeLike, brief: CookingBrief) {
  if (!brief.ingredients.centerpiece) return true;
  const text = `${recipe.title} ${recipe.description ?? ""} ${recipe.ingredients.map((item) => item.name).join(" ")}`.toLowerCase();
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

function styleMatch(recipe: RecipeLike, brief: CookingBrief) {
  if (brief.style.tags.length === 0 && brief.style.texture_tags.length === 0 && brief.style.format_tags.length === 0) {
    return true;
  }
  const text = `${recipe.title} ${recipe.description ?? ""} ${recipe.steps.map((item) => item.text).join(" ")}`.toLowerCase();
  const targetTags = [...brief.style.tags, ...brief.style.texture_tags, ...brief.style.format_tags].filter(Boolean);
  return (
    targetTags.some((tag) => {
      const normalizedTag = tag.toLowerCase();
      return text.includes(normalizedTag) || text.includes(normalizedTag.replace(/-/g, " "));
    }) || targetTags.length === 0
  );
}

export function verifyRecipeAgainstBrief(input: {
  recipe: RecipeLike;
  brief: CookingBrief | null | undefined;
  fallbackContext?: string;
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
  const dishFamilyMatch = recipeMatchesRequestedDirection(input.recipe, context) && specificDishNameMatch(input.recipe, brief);
  const titlePass = titleQualityPass(input.recipe.title);
  const requiredPass = requiredIngredientsPresent(input.recipe, brief);
  const forbiddenPass = forbiddenIngredientsAvoided(input.recipe, brief);
  const centerpiecePass = centerpieceMatch(input.recipe, brief);
  const stylePass = styleMatch(input.recipe, brief);
  const completenessPass = input.recipe.ingredients.length > 0 && input.recipe.steps.length > 0;
  const checks = {
    dish_family_match: dishFamilyMatch,
    style_match: stylePass,
    centerpiece_match: centerpiecePass,
    required_ingredients_present: requiredPass,
    forbidden_ingredients_avoided: forbiddenPass,
    title_quality_pass: titlePass,
    recipe_completeness_pass: completenessPass,
  };
  const reasons: string[] = [];

  if (!dishFamilyMatch) reasons.push("Recipe drifted from the requested dish family or direction.");
  if (!stylePass) reasons.push("Recipe does not reflect the requested style or texture cues.");
  if (!centerpiecePass) reasons.push("Recipe lost the intended centerpiece ingredient or dish.");
  if (!requiredPass) reasons.push("Recipe is missing one or more required ingredients from the brief.");
  if (!forbiddenPass) reasons.push("Recipe includes an ingredient the user asked to avoid.");
  if (!titlePass) reasons.push("Recipe title is too generic to save as a final recipe.");
  if (!completenessPass) reasons.push("Recipe is incomplete.");

  const passedChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;
  const score = totalChecks === 0 ? 0 : passedChecks / totalChecks;

  return {
    passes: reasons.length === 0,
    confidence: reasons.length === 0 ? 0.92 : Math.max(0.2, score),
    score,
    reasons,
    checks,
    retry_strategy: reasons.length === 0 ? "none" : "regenerate_stricter",
  };
}

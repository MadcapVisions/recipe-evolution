import type { RecipeDraft } from "../recipes/recipeDraft";
import { repairRecipeDraftIngredientLines, normalizeAiIngredients } from "../recipes/recipeDraft";
import type { RecipeOutline } from "./contracts/recipeOutline";
import type { RecipeIngredientSection, RecipeInstructionSection, RecipeSections } from "./contracts/recipeSections";
import type { HomeGeneratedRecipe } from "./recipeNormalization";

function normalizeDifficulty(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "Easy";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

function buildTipsFromOutline(outline?: RecipeOutline | null) {
  if (!outline) {
    return [];
  }

  return uniqueStrings(
    outline.chef_tip_topics
      .slice(0, 3)
      .map((topic) => topic.trim())
      .filter(Boolean)
      .map((topic) => `${topic.charAt(0).toUpperCase()}${topic.slice(1)}.`)
  );
}

export function buildRecipeSections(input: {
  recipe: HomeGeneratedRecipe;
  outline?: RecipeOutline | null;
}): RecipeSections {
  const { recipe, outline } = input;

  return {
    header: {
      title: recipe.title.trim() || outline?.title?.trim() || "Untitled Recipe",
      description: recipe.description?.trim() || outline?.summary?.trim() || null,
      servings: recipe.servings ?? 4,
      prep_time_min: recipe.prep_time_min ?? 15,
      cook_time_min: recipe.cook_time_min ?? 30,
      difficulty: normalizeDifficulty(recipe.difficulty),
    },
    ingredients: repairRecipeDraftIngredientLines(recipe.ingredients).map((item) => item.name),
    steps: recipe.steps.map((item) => item.text.trim()).filter(Boolean),
    tips: recipe.chefTips.length > 0 ? uniqueStrings(recipe.chefTips) : buildTipsFromOutline(outline),
  };
}

/** Strip AI pipeline metadata before writing to DB. */
export function stripStepMetadata(
  steps: Array<{ text: string; methodTag?: string | null; [key: string]: unknown }>
): Array<{ text: string }> {
  return steps.map((step) => ({ text: step.text }));
}

export function assembleRecipeDraftFromSections(input: {
  sections: RecipeSections;
  ai_metadata_json?: unknown;
}): RecipeDraft {
  const { sections } = input;

  return {
    title: sections.header.title,
    description: sections.header.description,
    tags: null,
    servings: sections.header.servings,
    prep_time_min: sections.header.prep_time_min,
    cook_time_min: sections.header.cook_time_min,
    difficulty: sections.header.difficulty,
    ingredients: sections.ingredients.map((name) => ({ name })),
    steps: sections.steps.map((text) => ({ text })),
    notes: sections.tips.length > 0 ? sections.tips.map((tip) => `• ${tip}`).join("\n") : null,
    change_log: null,
    ai_metadata_json: input.ai_metadata_json ?? null,
  };
}

export function buildGeneratedRecipeFromSectionPayloads(input: {
  title: string;
  outline?: RecipeOutline | null;
  ingredientSection: RecipeIngredientSection;
  instructionSection: RecipeInstructionSection;
}): HomeGeneratedRecipe {
  return {
    title: input.title.trim() || input.outline?.title?.trim() || "Untitled Recipe",
    description: input.instructionSection.description?.trim() || input.outline?.summary?.trim() || null,
    servings: input.ingredientSection.servings ?? 4,
    prep_time_min: input.ingredientSection.prep_time_min ?? 15,
    cook_time_min: input.ingredientSection.cook_time_min ?? 30,
    difficulty: normalizeDifficulty(input.ingredientSection.difficulty),
    ingredients: normalizeAiIngredients(input.ingredientSection.ingredients),
    steps: input.instructionSection.steps
      .map((item) => ({ text: item.text.trim(), methodTag: item.methodTag ?? null }))
      .filter((item) => item.text.length > 0),
    chefTips: input.instructionSection.chefTips.length > 0 ? uniqueStrings(input.instructionSection.chefTips) : buildTipsFromOutline(input.outline),
  };
}

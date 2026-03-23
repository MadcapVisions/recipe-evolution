import type { CookingBrief } from "./contracts/cookingBrief";
import { parseIngredientPhrase } from "./ingredientParsing";
function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

function sanitizeIngredientList(values: string[]) {
  return unique(
    values
      .map((value) => parseIngredientPhrase(value))
      .filter((value): value is string => Boolean(value))
  );
}

export function sanitizeCookingBriefIngredients(brief: CookingBrief): CookingBrief {
  const required = sanitizeIngredientList(brief.ingredients.required);
  const preferred = sanitizeIngredientList(brief.ingredients.preferred);
  const forbidden = sanitizeIngredientList(brief.ingredients.forbidden);
  const mustHave = unique([
    ...(brief.dish.dish_family ? [brief.dish.dish_family] : []),
    ...brief.style.tags,
    ...required,
  ]);

  return {
    ...brief,
    ingredients: {
      ...brief.ingredients,
      required,
      preferred,
      forbidden,
      centerpiece: brief.ingredients.centerpiece,
    },
    directives: {
      ...brief.directives,
      must_have: mustHave,
      must_not_have: forbidden,
    },
  };
}

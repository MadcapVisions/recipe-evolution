export function validateRecipe(recipe: unknown): recipe is {
  title: string;
  ingredients: string[];
  steps: string[];
  chefTips?: string[];
} {
  if (!recipe || typeof recipe !== "object") return false;

  const candidate = recipe as {
    title?: unknown;
    ingredients?: unknown;
    steps?: unknown;
    chefTips?: unknown;
  };

  if (typeof candidate.title !== "string") return false;
  if (!Array.isArray(candidate.ingredients)) return false;
  if (!Array.isArray(candidate.steps)) return false;
  if (!candidate.ingredients.every((item) => typeof item === "string")) return false;
  if (!candidate.steps.every((item) => typeof item === "string")) return false;
  if (candidate.chefTips !== undefined) {
    if (!Array.isArray(candidate.chefTips)) return false;
    if (!candidate.chefTips.every((item) => typeof item === "string")) return false;
  }

  return true;
}

import { RECIPE_TEMPLATES } from "./recipeTemplates";

export type RecipeTemplateKey = keyof typeof RECIPE_TEMPLATES;

export function selectTemplate(text: string): RecipeTemplateKey {
  const lower = text.toLowerCase();

  if (lower.includes("pasta")) return "pasta";
  if (lower.includes("stir fry") || lower.includes("stir-fry")) return "stir_fry";
  if (lower.includes("sheet pan") || lower.includes("roasted")) return "sheet_pan";
  if (lower.includes("soup")) return "soup";
  if (lower.includes("sandwich")) return "sandwich";

  return "stir_fry";
}


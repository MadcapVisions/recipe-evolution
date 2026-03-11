import { RECIPE_TEMPLATES } from "./recipeTemplates";
import { selectTemplate } from "./templateSelector";

export function buildTemplateContext(userText: string): string {
  const templateKey = selectTemplate(userText);
  const template = RECIPE_TEMPLATES[templateKey];

  return `

Recipe Template:

${template.structure}

Use this structure when generating the recipe.

`;
}


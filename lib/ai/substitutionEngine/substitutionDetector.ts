import { SUBSTITUTION_DATABASE } from "./substitutionDatabase";

export type SubstitutionSuggestion = {
  ingredient: string;
  options: string[];
};

export function detectSubstitutions(ingredients: string[]): SubstitutionSuggestion[] {
  const suggestions: SubstitutionSuggestion[] = [];

  ingredients.forEach((item) => {
    const key = item.trim().toLowerCase().replace(/\s+/g, "_");
    const replacements = SUBSTITUTION_DATABASE[key];

    if (replacements) {
      suggestions.push({
        ingredient: item,
        options: replacements.slice(0, 3),
      });
    }
  });

  return suggestions;
}

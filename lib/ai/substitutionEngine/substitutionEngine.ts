import { detectSubstitutions } from "./substitutionDetector";

export function generateSubstitutionContext(ingredients: string[]): string {
  const substitutions = detectSubstitutions(ingredients);

  if (!substitutions.length) {
    return "";
  }

  let text = "Ingredient Substitution Options:\n";

  substitutions.forEach((s) => {
    text += `
${s.ingredient} can be replaced with:
${s.options.join(", ")}
`;
  });

  return text;
}

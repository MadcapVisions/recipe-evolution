import { TECHNIQUE_LIBRARY } from "./techniqueLibrary";

export function injectTechniques(steps: string[], techniqueKeys: string[]): string[] {
  const enhancedSteps = [...steps];

  techniqueKeys.forEach((key) => {
    const technique = TECHNIQUE_LIBRARY[key];

    if (technique) {
      enhancedSteps.unshift(
        `Chef Technique: ${technique.name}

${technique.description}

Chef Tip: ${technique.chefTip}`
      );
    }
  });

  return enhancedSteps;
}

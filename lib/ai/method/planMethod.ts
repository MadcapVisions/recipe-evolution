import type { CulinaryBlueprint, BlueprintCheckpoint } from "../blueprint/blueprintTypes";

export type MethodPlan = {
  prepSequence: string[];
  activeCookSequence: string[];
  finishSequence: string[];
  checkpoints: BlueprintCheckpoint[];
  likelyFailurePoints: string[];
  holdPoints: string[];
};

/**
 * Produce a structured method plan from a CulinaryBlueprint.
 *
 * This plan is deterministic and is consumed by draftRecipeFromBlueprint.ts
 * to inform prompt construction. It does NOT replace step generation in the
 * LLM call — it constrains and guides it.
 *
 * Method authority in migrated flows belongs here, not in stepGenerator.ts
 * (which is frozen for legacy flow only).
 */
export function planMethod(blueprint: CulinaryBlueprint): MethodPlan {
  return {
    prepSequence: buildPrepSequence(blueprint),
    activeCookSequence: buildActiveCookSequence(blueprint),
    finishSequence: buildFinishSequence(blueprint),
    checkpoints: [...blueprint.checkpoints],
    likelyFailurePoints: blueprint.checkpoints.map((c) => c.failureRisk),
    holdPoints: buildHoldPoints(blueprint),
  };
}

function buildPrepSequence(blueprint: CulinaryBlueprint): string[] {
  const steps: string[] = [];

  for (const component of blueprint.components) {
    for (const ingredient of component.ingredients) {
      if (ingredient.role === "protein") {
        steps.push(`Prep ${ingredient.name}: pat completely dry, season generously with salt and pepper`);
      } else if (ingredient.role === "aromatic") {
        steps.push(`Prep ${ingredient.name}: mince or slice finely`);
      } else if (ingredient.role === "base") {
        steps.push(`Prepare ${ingredient.name} per standard method`);
      }
    }
  }

  if (steps.length === 0) {
    steps.push("Mise en place: measure and prep all ingredients before starting heat");
  }

  return steps;
}

function buildActiveCookSequence(blueprint: CulinaryBlueprint): string[] {
  const steps: string[] = [];

  // Main and base components first
  for (const component of blueprint.components) {
    if (component.purpose === "main" || component.purpose === "base") {
      steps.push(
        `Cook ${component.name} using ${component.cookMethod} method${
          component.textureTarget ? ` — target: ${component.textureTarget}` : ""
        }`
      );
    }
  }

  // Sauces after mains
  for (const component of blueprint.components) {
    if (component.purpose === "sauce") {
      steps.push(`Build ${component.name} using ${component.cookMethod}`);
    }
  }

  // Sides and other components last
  for (const component of blueprint.components) {
    if (component.purpose === "side" || component.purpose === "texture_contrast") {
      steps.push(`Prepare ${component.name}`);
    }
  }

  if (steps.length === 0) {
    steps.push(`Cook using ${blueprint.primaryMethod}`);
  }

  return steps;
}

function buildFinishSequence(blueprint: CulinaryBlueprint): string[] {
  const steps: string[] = [];

  steps.push(`Finish: ${blueprint.finishStrategy}`);

  const garnishComponents = blueprint.components.filter(
    (c) => c.purpose === "garnish" || c.purpose === "texture_contrast"
  );
  for (const g of garnishComponents) {
    steps.push(`Add ${g.name} just before serving`);
  }

  steps.push("Taste and adjust seasoning before plating");

  return steps;
}

function buildHoldPoints(blueprint: CulinaryBlueprint): string[] {
  const holds: string[] = [];

  const hasProtein = blueprint.components.some((c) =>
    c.ingredients.some((i) => i.role === "protein")
  );
  if (hasProtein) {
    holds.push("Rest protein 3–5 minutes before slicing or serving");
  }

  if (blueprint.dishFamily === "baked_casseroles") {
    holds.push("Rest casserole 10 minutes before cutting — prevents runny center");
  }

  return holds;
}

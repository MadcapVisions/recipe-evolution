/**
 * Culinary Blueprint generator.
 *
 * Takes ResolvedCookingIntent and produces a deterministic CulinaryBlueprint.
 * No LLM call — heuristic/rule-based. LLM drafting happens downstream in
 * draftRecipeFromBlueprint.ts.
 *
 * See docs/decisions/authority-boundaries.md for contract hierarchy.
 */

import type { ResolvedCookingIntent } from "../intent/intentTypes";
import type {
  CulinaryBlueprint,
  BlueprintComponent,
  BlueprintCheckpoint,
  ComponentPurpose,
  BlueprintIngredient,
} from "./blueprintTypes";
import {
  getFamilyBlueprintRule,
  FALLBACK_BLUEPRINT_RULE,
  type FamilyBlueprintRule,
} from "./familyBlueprintRules";
import { assignIngredientRoles } from "./ingredientRoles";
import { checkBlueprintFeasibility } from "./feasibility";

export function buildCulinaryBlueprint(intent: ResolvedCookingIntent): CulinaryBlueprint {
  const family = intent.dishFamily ?? "unknown";
  const rule = getFamilyBlueprintRule(family) ?? FALLBACK_BLUEPRINT_RULE;
  const isFamilyKnown = getFamilyBlueprintRule(family) !== null;

  const components = buildComponents(intent, rule);
  const checkpoints = buildCheckpoints(rule);
  const feasibility = checkBlueprintFeasibility(intent, isFamilyKnown);

  return {
    dishName: intent.dishName ?? intent.rawUserPhrase ?? "recipe",
    dishFamily: family,
    cuisineHint: intent.cuisineHint,
    richnessLevel: rule.defaultRichnessLevel,
    flavorArchitecture: buildFlavorArchitecture(rule, intent),
    components,
    primaryMethod: rule.defaultCookMethods[0] ?? "cook",
    sequenceLogic: rule.defaultCookMethods.join(", then "),
    finishStrategy: rule.finishStrategies[0] ?? "season and serve",
    textureTargets: [...rule.textureTargets],
    chefOpportunities: buildChefOpportunities(rule),
    checkpoints,
    feasibility,
    generatedFrom: intent.requestId,
    generatedAt: new Date().toISOString(),
  };
}

function buildComponents(
  intent: ResolvedCookingIntent,
  rule: FamilyBlueprintRule
): BlueprintComponent[] {
  const roleMap = assignIngredientRoles(intent.ingredientMentions, rule.family);

  const components: BlueprintComponent[] = rule.typicalComponents.map(
    (componentName, i): BlueprintComponent => ({
      name: componentName,
      purpose: mapComponentPurpose(componentName, i),
      ingredients: [],
      cookMethod: rule.defaultCookMethods[i] ?? rule.defaultCookMethods[0] ?? "cook",
      textureTarget: rule.textureTargets[i] ?? null,
    })
  );

  // Attach mentioned ingredients to the most appropriate component
  for (const [ingredient, role] of Object.entries(roleMap)) {
    if (role === null) continue;
    const target = findBestComponent(components, role) ?? components[0];
    if (target) {
      const entry: BlueprintIngredient = {
        name: ingredient,
        role,
        rationale: "explicitly mentioned by user",
      };
      target.ingredients.push(entry);
    }
  }

  return components;
}

function mapComponentPurpose(componentName: string, index: number): ComponentPurpose {
  const name = componentName.toLowerCase();
  if (name.includes("sauce") || name.includes("glaze") || name.includes("dressing")) return "sauce";
  if (
    name.includes("grain") ||
    name.includes("rice") ||
    name.includes("pasta") ||
    name.includes("base")
  )
    return "base";
  if (name.includes("garnish") || name.includes("herb")) return "garnish";
  if (
    name.includes("topping") ||
    name.includes("crunch") ||
    name.includes("crisp")
  )
    return "texture_contrast";
  if (index === 0) return "main";
  return "side";
}

function findBestComponent(
  components: BlueprintComponent[],
  role: string
): BlueprintComponent | null {
  if (role === "protein" || role === "aromatic" || role === "fat") {
    return components.find((c) => c.purpose === "main") ?? components[0] ?? null;
  }
  if (role === "base" || role === "liquid") {
    return components.find((c) => c.purpose === "base") ?? components[0] ?? null;
  }
  if (role === "finish" || role === "garnish") {
    return (
      components.find((c) => c.purpose === "garnish") ??
      components[components.length - 1] ??
      null
    );
  }
  if (role === "acid" || role === "umami" || role === "sweetness") {
    return components.find((c) => c.purpose === "sauce") ?? components[0] ?? null;
  }
  return components[0] ?? null;
}

function buildFlavorArchitecture(
  rule: FamilyBlueprintRule,
  intent: ResolvedCookingIntent
): string[] {
  const arch: string[] = ["savory base"];
  if (rule.requiredRoles.includes("umami") || rule.optionalRoles.includes("umami")) {
    arch.push("umami depth");
  }
  if (rule.requiredRoles.includes("acid") || rule.optionalRoles.includes("acid")) {
    arch.push("bright acid finish");
  }
  const hasSpicyConstraint = intent.constraints.some(
    (c) => c.type === "style" && c.value.toLowerCase().includes("spicy")
  );
  if (rule.requiredRoles.includes("heat") || hasSpicyConstraint) {
    arch.push("spiced heat");
  }
  return arch;
}

function buildChefOpportunities(rule: FamilyBlueprintRule): string[] {
  const opportunities: string[] = [];
  if (rule.defaultCookMethods.includes("sear")) {
    opportunities.push(
      "high-heat sear builds Maillard crust — pat protein completely dry before it hits the pan"
    );
  }
  if (rule.defaultCookMethods.includes("deglaze")) {
    opportunities.push(
      "deglaze the fond thoroughly — that browned residue is the sauce foundation"
    );
  }
  if (rule.defaultCookMethods.includes("emulsify")) {
    opportunities.push(
      "reserve pasta water before draining — the starch is what makes sauce cling"
    );
  }
  if (rule.defaultCookMethods.includes("roast")) {
    opportunities.push(
      "do not crowd the pan — crowding causes steam, not caramelization"
    );
  }
  if (rule.defaultCookMethods.includes("simmer")) {
    opportunities.push(
      "taste and season the liquid early — you cannot season broth at the end and expect depth"
    );
  }
  return opportunities;
}

function buildCheckpoints(rule: FamilyBlueprintRule): BlueprintCheckpoint[] {
  return rule.commonFailureRisks.map((risk): BlueprintCheckpoint => ({
    phase: inferPhaseFromRisk(risk),
    description: `Watch for: ${risk}`,
    failureRisk: risk,
  }));
}

function inferPhaseFromRisk(risk: string): BlueprintCheckpoint["phase"] {
  const r = risk.toLowerCase();
  if (r.includes("cut") || r.includes("rinse") || r.includes("dry") || r.includes("size")) {
    return "prep";
  }
  if (r.includes("rest") || r.includes("cutting") || r.includes("serve")) {
    return "finish";
  }
  return "active_cook";
}

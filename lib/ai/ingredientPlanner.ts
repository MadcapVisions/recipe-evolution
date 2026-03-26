import { validateRatios } from "./ratioValidator";
import { calculateRecipeNutrition } from "./nutritionCalculator";
import { validateMacroTargets, type MacroTargets } from "./macroTargetValidator";
import { classifyIngredient } from "./ingredientClassifier";
import { checkPlannerMacroFeasibility } from "./plannerMacroFeasibility";
import type { DishFamilyRule } from "./dishFamilyRules";
import { matchesRequiredIngredient, type RequiredNamedIngredient } from "./requiredNamedIngredient";

export type CreativityMode = "safe" | "balanced" | "creative";

export type PlannerIngredient = {
  ingredientName: string;
  normalizedName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  grams?: number | null;
  classes?: string[];
};

export type IngredientCatalogItem = {
  canonicalName: string;
  displayName: string;
  aliases?: string[];
  classes: string[];
  dietaryFlags?: Record<string, boolean>;
};

export type IngredientPlannerInput = {
  userIntent?: string | null;
  titleHint?: string | null;
  dishFamily: DishFamilyRule;
  dietaryConstraints?: string[] | null;
  availableIngredients?: string[] | null;
  preferredIngredients?: string[] | null;
  forbiddenIngredients?: string[] | null;
  /** Hard-required named ingredients extracted from the user's message (e.g. "use sourdough discard"). */
  requiredNamedIngredients?: RequiredNamedIngredient[] | null;
  macroTargets?: MacroTargets | null;
  servings?: number | null;
  creativityMode?: CreativityMode;
  ingredientCatalog?: IngredientCatalogItem[] | null;
};

export type IngredientPlanCandidate = {
  title?: string | null;
  ingredients: PlannerIngredient[];
  notes?: string[] | null;
};

export type IngredientPlannerValidationIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  metadata?: Record<string, unknown>;
};

export type IngredientPlannerValidationResult = {
  passed: boolean;
  score: number;
  issues: IngredientPlannerValidationIssue[];
  nutritionConfidenceScore?: number;
};

export type IngredientPlanPromptPayload = {
  systemPrompt: string;
  userPrompt: string;
};

// ── Internal helpers ─────────────────────────────────────────────────────────

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ingredientMatchesName(ingredientName: string, target: string): boolean {
  const a = normalizeText(ingredientName);
  const b = normalizeText(target);
  return a === b || a.includes(b) || b.includes(a);
}

function inferClassesFromCatalog(
  ingredientName: string,
  ingredientCatalog?: IngredientCatalogItem[] | null
): string[] {
  if (!ingredientCatalog?.length) return [];

  const normalized = normalizeText(ingredientName);
  let best: IngredientCatalogItem | null = null;
  let bestScore = 0;

  for (const item of ingredientCatalog) {
    const candidates = [item.canonicalName, item.displayName, ...(item.aliases ?? [])];

    for (const candidate of candidates) {
      const c = normalizeText(candidate);

      let score = 0;
      if (normalized === c) {
        score = 1;
      } else if (normalized.includes(c) || c.includes(normalized)) {
        score = 0.85;
      } else {
        const aSet = new Set(normalized.split(" ").filter(Boolean));
        const bSet = new Set(c.split(" ").filter(Boolean));
        let overlap = 0;
        for (const token of aSet) {
          if (bSet.has(token)) overlap += 1;
        }
        const union = new Set([...aSet, ...bSet]).size;
        score = union > 0 ? overlap / union : 0;
      }

      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
  }

  return best && bestScore >= 0.8 ? best.classes : [];
}

function hasAnyClass(ingredient: PlannerIngredient, classes: string[]): boolean {
  return ingredient.classes?.some((c) => classes.includes(c)) ?? false;
}

function classGroupSatisfied(
  ingredients: PlannerIngredient[],
  classGroup: string[]
): boolean {
  return ingredients.some((ingredient) => hasAnyClass(ingredient, classGroup));
}

function countUncommonIngredients(
  ingredients: PlannerIngredient[],
  dishFamily: DishFamilyRule
): number {
  const allowed = new Set([
    ...dishFamily.commonClasses,
    ...dishFamily.optionalClasses,
    ...dishFamily.requiredClassGroups.flat(),
  ]);

  let count = 0;
  for (const ingredient of ingredients) {
    const classes = ingredient.classes ?? [];
    const inForbidden = classes.some((c) => dishFamily.forbiddenClasses.includes(c));
    if (inForbidden) continue;
    const anyAllowed = classes.some((c) => allowed.has(c));
    if (!anyAllowed) count += 1;
  }
  return count;
}

// Maps each constraint to ingredient classes that must be absent from the plan.
const DIETARY_FORBIDDEN_FOR_PLANNER: Partial<Record<string, string[]>> = {
  vegan:      ["dairy", "protein_meat", "protein_fish", "egg"],
  vegetarian: ["protein_meat", "protein_fish"],
  dairy_free: ["dairy"],
  nut_free:   ["nut"],
  low_carb:   ["starch", "flour_grain"],
};

function buildDietaryPromptText(dietaryConstraints?: string[] | null): string {
  if (!dietaryConstraints?.length) return "No dietary constraints.";

  const lines: string[] = [
    `Required dietary constraints: ${dietaryConstraints.join(", ")}.`,
    "Plans that violate these constraints will be rejected. Satisfy all constraints in your first draft.",
  ];

  for (const constraint of dietaryConstraints) {
    const forbidden = DIETARY_FORBIDDEN_FOR_PLANNER[constraint];
    if (forbidden?.length) {
      lines.push(
        `- ${constraint}: do not include ingredients with classes ${forbidden.join(", ")}.`
      );
    }
  }

  if (dietaryConstraints.includes("vegan")) {
    lines.push(
      "- vegan guidance: use plant-based proteins (tempeh, tofu, lentils, chickpeas, edamame) and plant milks (coconut milk, oat milk, soy milk). No meat, fish, dairy, eggs, honey, gelatin."
    );
    lines.push(
      "- NOTE on required class groups: if a dish family lists 'dairy' in a required group, satisfy it with a plant-based liquid (coconut milk = liquid_base class) instead. Required class groups are OR-groups — pick the class that fits the constraint."
    );
  }

  if (dietaryConstraints.includes("low_carb")) {
    lines.push(
      "- low_carb guidance: avoid bread, tortillas, pasta, rice, and starchy vegetables. Use lettuce wraps, cauliflower, or zucchini as low-carb substitutes."
    );
  }

  return lines.join("\n");
}

function buildMacroPromptText(macroTargets?: MacroTargets | null, dietaryConstraints?: string[] | null): string {
  if (!macroTargets) return "No macro targets.";

  const parts: string[] = [];
  if (macroTargets.caloriesMax != null) parts.push(`calories <= ${macroTargets.caloriesMax}`);
  if (macroTargets.caloriesMin != null) parts.push(`calories >= ${macroTargets.caloriesMin}`);
  if (macroTargets.proteinMinG != null) parts.push(`protein >= ${macroTargets.proteinMinG}g`);
  if (macroTargets.proteinMaxG != null) parts.push(`protein <= ${macroTargets.proteinMaxG}g`);
  if (macroTargets.carbsMinG != null) parts.push(`carbs >= ${macroTargets.carbsMinG}g`);
  if (macroTargets.carbsMaxG != null) parts.push(`carbs <= ${macroTargets.carbsMaxG}g`);
  if (macroTargets.fatMinG != null) parts.push(`fat >= ${macroTargets.fatMinG}g`);
  if (macroTargets.fatMaxG != null) parts.push(`fat <= ${macroTargets.fatMaxG}g`);
  if (macroTargets.fiberMinG != null) parts.push(`fiber >= ${macroTargets.fiberMinG}g`);
  if (macroTargets.fiberMaxG != null) parts.push(`fiber <= ${macroTargets.fiberMaxG}g`);
  if (macroTargets.sugarMaxG != null) parts.push(`sugar <= ${macroTargets.sugarMaxG}g`);
  if (macroTargets.sodiumMaxMg != null) parts.push(`sodium <= ${macroTargets.sodiumMaxMg}mg`);

  const hints: string[] = [];

  // Protein density: suggest high-protein ingredients when target is meaningful.
  // Filter suggestions by dietary constraints to avoid conflicting guidance.
  if ((macroTargets.proteinMinG ?? 0) >= 15) {
    const isVegan = dietaryConstraints?.includes("vegan");
    const isVegetarian = isVegan || dietaryConstraints?.includes("vegetarian");
    const isDairyFree = isVegan || dietaryConstraints?.includes("dairy_free");

    let proteinSources: string[];
    if (isVegan) {
      proteinSources = ["tempeh", "tofu", "lentils", "chickpeas", "edamame", "black beans", "hemp seeds", "soy milk"];
    } else if (isDairyFree) {
      proteinSources = ["lean chicken", "eggs", "tofu", "lentils", "chickpeas", "edamame", "tuna", "shrimp"];
    } else if (isVegetarian) {
      proteinSources = ["Greek yogurt", "cottage cheese", "eggs", "tofu", "lentils", "chickpeas", "low-fat cheese"];
    } else {
      proteinSources = ["Greek yogurt", "cottage cheese", "lean chicken", "eggs", "lentils", "edamame", "tofu", "tuna"];
    }

    hints.push(
      `To reach protein >= ${macroTargets.proteinMinG}g: prioritize high-protein ingredients ` +
      `(${proteinSources.join(", ")}). Use generous quantities of the best protein source for this dish family.`
    );
  }

  // Low-calorie + high-protein combination: extra guidance
  if (macroTargets.caloriesMax != null && (macroTargets.proteinMinG ?? 0) >= 15) {
    hints.push(
      `Calories <= ${macroTargets.caloriesMax} and protein >= ${macroTargets.proteinMinG}g requires ` +
      `lean, protein-dense choices. Avoid high-fat ingredients unless essential to dish identity. ` +
      `Reduce portion sizes of high-calorie components and increase protein sources.`
    );
  }

  // Low-carb: suggest avoidance strategies
  if ((macroTargets.carbsMaxG ?? Infinity) <= 25) {
    hints.push(
      `To stay under ${macroTargets.carbsMaxG}g carbs: avoid starchy ingredients (bread, pasta, rice, ` +
      `tortillas, potatoes). Use low-carb substitutes where possible (lettuce wraps, cauliflower, ` +
      `zucchini noodles). All remaining carbs must come from vegetables and small amounts of sauce.`
    );
  }

  const base = parts.length ? `Macro targets: ${parts.join(", ")}.` : "No macro targets.";
  return hints.length ? `${base}\n${hints.join("\n")}` : base;
}

/**
 * Returns required class groups with classes forbidden by dietary constraints removed.
 * Prevents the LLM from seeing "dairy" as required when vegan is active, etc.
 * If filtering would empty a group, the original group is preserved (edge case).
 */
function buildDisplayedRequiredGroups(
  dishFamily: DishFamilyRule,
  dietaryConstraints?: string[] | null
): string[][] {
  if (!dietaryConstraints?.length) return dishFamily.requiredClassGroups;

  const forbidden = new Set<string>();
  for (const constraint of dietaryConstraints) {
    const fb = DIETARY_FORBIDDEN_FOR_PLANNER[constraint];
    if (fb) for (const cls of fb) forbidden.add(cls);
  }

  return dishFamily.requiredClassGroups.map((group) => {
    const filtered = group.filter((cls) => !forbidden.has(cls));
    return filtered.length > 0 ? filtered : group;
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

export function buildIngredientPlanPrompt(
  input: IngredientPlannerInput
): IngredientPlanPromptPayload {
  const {
    userIntent,
    titleHint,
    dishFamily,
    dietaryConstraints,
    availableIngredients,
    preferredIngredients,
    forbiddenIngredients,
    macroTargets,
    servings,
    creativityMode = "safe",
  } = input;

  const displayedRequiredGroups = buildDisplayedRequiredGroups(dishFamily, dietaryConstraints);

  const systemPrompt = [
    "You are planning ingredients for a recipe before any cooking steps are written.",
    "Your job is to produce a coherent ingredient list that fits the dish family exactly.",
    "Do not output steps.",
    "Do not invent bizarre fusion ingredients.",
    "Respect dish identity, dietary constraints, and macro targets.",
    "Keep creativity controlled.",
    "",
    "You must obey the dish-family constraints below.",
    `Dish family: ${dishFamily.key} (${dishFamily.displayName})`,
    `Required class groups (OR-groups: satisfy at least ONE class per group): ${JSON.stringify(displayedRequiredGroups)}`,
    "HARD RULE: A plan that is missing ANY required class group will be REJECTED immediately.",
    "Do not return a partial or empty ingredient list.",
    "Satisfy every required class group in your FIRST draft — do not rely on retry.",
    "When uncertain which ingredient covers a group, choose the simplest canonical example for this dish family.",
    `Common classes: ${dishFamily.commonClasses.join(", ") || "(none)"}`,
    `Optional classes: ${dishFamily.optionalClasses.join(", ") || "(none)"}`,
    `Forbidden classes: ${dishFamily.forbiddenClasses.join(", ") || "(none)"}`,
    `Suspicious classes: ${dishFamily.suspiciousClasses.join(", ") || "(none)"}`,
    `Generation constraints: ${dishFamily.generationConstraints.join(" | ") || "(none)"}`,
    `Strictness: ${dishFamily.strictness ?? "medium"}`,
    `Creativity mode: ${creativityMode}`,
    `Max uncommon ingredients: ${dishFamily.maxUncommonIngredients ?? 0}`,
    "",
    "Quantity requirements:",
    "- Every core ingredient MUST have either quantity+unit OR grams set.",
    "- Acceptable units: g, kg, ml, l, cup, tbsp, tsp, oz, lb, count, slice, piece, can, bunch.",
    "- Do NOT omit quantity and unit for major ingredients (proteins, starches, liquids, fats).",
    "- Only optional garnishes (e.g. salt to taste, fresh herbs for serving) may omit exact amounts.",
    "",
    "Return JSON only with this exact schema:",
    JSON.stringify(
      {
        title: "",
        ingredients: [{ ingredientName: "", quantity: 0, unit: "", grams: null, classes: [] }],
        notes: [],
      },
      null,
      2
    ),
  ].join("\n");

  const hardRequired = (input.requiredNamedIngredients ?? []).filter(
    (r) => r.requiredStrength === "hard"
  );

  const userPrompt = [
    userIntent ? `User intent: ${userIntent}` : "User intent: (not provided)",
    titleHint ? `Title hint: ${titleHint}` : "Title hint: (not provided)",
    servings != null ? `Servings: ${servings}` : "Servings: (not provided)",
    buildDietaryPromptText(dietaryConstraints),
    buildMacroPromptText(macroTargets, dietaryConstraints),
    availableIngredients?.length
      ? `Available ingredients: ${availableIngredients.join(", ")}`
      : "Available ingredients: not restricted",
    preferredIngredients?.length
      ? `Preferred ingredients: ${preferredIngredients.join(", ")}`
      : "Preferred ingredients: none",
    forbiddenIngredients?.length
      ? `Forbidden ingredients by name: ${forbiddenIngredients.join(", ")}`
      : "Forbidden ingredients by name: none",
    ...(hardRequired.length > 0
      ? [
          "",
          "MANDATORY user-requested ingredients (HARD REQUIREMENT — MUST appear in the ingredient list):",
          ...hardRequired.map((r) => `- ${r.normalizedName}`),
          "These were explicitly requested by the user. Do not omit them under any circumstances.",
        ]
      : []),
    "",
    "Requirements:",
    "- Include at least one ingredient satisfying EVERY required class group listed above.",
    "- Do not include forbidden classes.",
    "- Avoid suspicious classes unless clearly necessary and still coherent.",
    "- Keep the ingredient list realistic for the dish family.",
    "- Make quantities plausible.",
    "- If macro targets are present, bias the ingredient plan toward meeting them without breaking the dish.",
    "- Do not omit core identity ingredients (e.g. eggs for custard, rice for fried rice, protein for curry).",
  ].join("\n");

  return { systemPrompt, userPrompt };
}

export function validateIngredientPlanCandidate(
  input: IngredientPlannerInput,
  candidate: IngredientPlanCandidate
): IngredientPlannerValidationResult {
  const issues: IngredientPlannerValidationIssue[] = [];

  // Enrich classes: always merge all three sources (LLM + catalog + classifier).
  // Do NOT skip the classifier when the LLM provides non-empty classes — the LLM
  // often returns invented class names ("protein", "dairy_product") that don't match
  // the required-group keys. Merging all sources is always safe because the classifier
  // is conservative and only adds classes it is confident about.
  const ingredients = candidate.ingredients.map((ingredient) => {
    const fromCatalog = inferClassesFromCatalog(ingredient.ingredientName, input.ingredientCatalog);
    const fromClassifier = classifyIngredient(ingredient.ingredientName);
    const llmClasses = ingredient.classes ?? [];
    const classes = Array.from(new Set([...llmClasses, ...fromCatalog, ...fromClassifier]));
    return { ...ingredient, classes };
  });

  // Dietary constraint violations — checked before required groups so retry prompt
  // can name the specific offending ingredients.
  // IMPORTANT: Use classifier+catalog classes only (not LLM-provided classes) to
  // avoid false violations from LLM hallucinations (e.g., LLM tagging coconut milk as dairy).
  for (const constraint of input.dietaryConstraints ?? []) {
    const forbidden = DIETARY_FORBIDDEN_FOR_PLANNER[constraint];
    if (!forbidden?.length) continue;

    for (const ingredient of ingredients) {
      const safeClasses = Array.from(new Set([
        ...inferClassesFromCatalog(ingredient.ingredientName, input.ingredientCatalog),
        ...classifyIngredient(ingredient.ingredientName),
      ]));
      for (const cls of forbidden) {
        if (safeClasses.includes(cls)) {
          issues.push({
            code: `dietary_violation:${constraint}`,
            severity: "error",
            message: `"${ingredient.ingredientName}" has class "${cls}" which is forbidden for ${constraint}.`,
            metadata: { ingredient: ingredient.ingredientName, forbiddenClass: cls, constraint },
          });
          break;
        }
      }
    }
  }

  // Required class groups
  for (const group of input.dishFamily.requiredClassGroups) {
    if (!classGroupSatisfied(ingredients, group)) {
      issues.push({
        code: "PLANNER_MISSING_REQUIRED_CLASS_GROUP",
        severity: "error",
        message: `Missing required class group: [${group.join(", ")}].`,
        metadata: { classGroup: group },
      });
    }
  }

  // Per-ingredient class checks
  for (const ingredient of ingredients) {
    const classes = ingredient.classes ?? [];

    const forbiddenFound = classes.filter((c) =>
      input.dishFamily.forbiddenClasses.includes(c)
    );
    if (forbiddenFound.length) {
      issues.push({
        code: "PLANNER_FORBIDDEN_CLASS",
        severity: "error",
        message: `Ingredient "${ingredient.ingredientName}" contains forbidden classes: ${forbiddenFound.join(", ")}.`,
        metadata: { ingredient: ingredient.ingredientName, forbiddenClasses: forbiddenFound },
      });
    }

    const suspiciousFound = classes.filter((c) =>
      input.dishFamily.suspiciousClasses.includes(c)
    );
    if (suspiciousFound.length) {
      issues.push({
        code: "PLANNER_SUSPICIOUS_CLASS",
        severity: input.creativityMode === "creative" ? "warning" : "error",
        message: `Ingredient "${ingredient.ingredientName}" contains suspicious classes: ${suspiciousFound.join(", ")}.`,
        metadata: {
          ingredient: ingredient.ingredientName,
          suspiciousClasses: suspiciousFound,
        },
      });
    }

    if (ingredient.quantity == null && ingredient.grams == null) {
      issues.push({
        code: "PLANNER_MISSING_QUANTITY",
        severity: "warning",
        message: `Ingredient "${ingredient.ingredientName}" is missing quantity and grams.`,
      });
    }
  }

  // Hard-required named ingredients
  for (const req of input.requiredNamedIngredients ?? []) {
    if (req.requiredStrength !== "hard") continue;
    const matched = ingredients.some((ing) => matchesRequiredIngredient(ing.ingredientName, req));
    if (!matched) {
      issues.push({
        code: "PLANNER_MISSING_REQUIRED_NAMED_INGREDIENT",
        severity: "error",
        message: `Required ingredient "${req.normalizedName}" is missing from the ingredient plan.`,
        metadata: { normalizedName: req.normalizedName },
      });
    }
  }

  // Forbidden by name
  if (input.forbiddenIngredients?.length) {
    for (const ingredient of ingredients) {
      const matched = input.forbiddenIngredients.find((f) =>
        ingredientMatchesName(ingredient.ingredientName, f)
      );
      if (matched) {
        issues.push({
          code: "PLANNER_FORBIDDEN_INGREDIENT_NAME",
          severity: "error",
          message: `Ingredient "${ingredient.ingredientName}" matches forbidden ingredient "${matched}".`,
          metadata: { ingredient: ingredient.ingredientName, forbiddenIngredient: matched },
        });
      }
    }
  }

  // Available ingredients — info only, not hard fail
  if (input.availableIngredients?.length) {
    const availableNormalized = input.availableIngredients.map(normalizeText);
    const nonMatching = ingredients.filter((ingredient) => {
      const ing = normalizeText(ingredient.ingredientName);
      return !availableNormalized.some(
        (available) => ing.includes(available) || available.includes(ing)
      );
    });
    if (nonMatching.length > 0) {
      issues.push({
        code: "PLANNER_USES_NON_LISTED_INGREDIENTS",
        severity: "info",
        message: `Plan includes ${nonMatching.length} ingredient(s) not explicitly listed in available ingredients.`,
        metadata: { nonMatchingIngredients: nonMatching.map((i) => i.ingredientName) },
      });
    }
  }

  // Uncommon ingredient count
  const uncommonCount = countUncommonIngredients(ingredients, input.dishFamily);
  const maxUncommon = input.dishFamily.maxUncommonIngredients ?? 0;
  if (uncommonCount > maxUncommon) {
    issues.push({
      code: "PLANNER_TOO_MANY_UNCOMMON_INGREDIENTS",
      severity: "error",
      message: `Plan contains too many uncommon ingredients (${uncommonCount} > ${maxUncommon}).`,
      metadata: { uncommonCount, maxUncommon },
    });
  }

  // Ratio validation
  const ratioResult = validateRatios({ dishFamily: input.dishFamily, ingredients });
  for (const issue of ratioResult.issues) {
    issues.push({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      metadata: {
        ratioKey: issue.ratioKey,
        actual: issue.actual,
        expectedMin: issue.expectedMin,
        expectedMax: issue.expectedMax,
      },
    });
  }

  // Nutrition + macro validation
  // Use exact macro validation only when the nutrition calculator can actually
  // resolve grams for a meaningful portion of ingredients. When quantities are
  // missing (common at planner stage), fall back to class-based feasibility —
  // which avoids false hard failures from protein=0/calories=0 zero-totals.
  const nutritionResult = calculateRecipeNutrition(
    ingredients.map((ing) => ({ name: ing.normalizedName || ing.ingredientName })),
    input.servings ?? null
  );

  const resolvedWithGrams = nutritionResult.ingredientMatches.filter(
    (m) => m.matched && m.gramsUsed != null
  ).length;
  const nutritionReliable = resolvedWithGrams >= 2;

  if (nutritionReliable) {
    // Exact mode: grams available → trust the computed values
    const macroResult = validateMacroTargets({
      nutrition: nutritionResult,
      targets: input.macroTargets ?? null,
      preferPerServing: true,
    });
    for (const issue of macroResult.issues) {
      issues.push({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        metadata: {
          metric: issue.metric,
          actual: issue.actual,
          expected: issue.expected,
        },
      });
    }
  } else if (input.macroTargets || input.dietaryConstraints?.some((c) => c === "low_carb" || c === "high_protein")) {
    // Fallback mode: no reliable grams → check structural feasibility by class
    const feasibility = checkPlannerMacroFeasibility({
      ingredients,
      macroTargets: input.macroTargets ?? null,
      hasLowCarbConstraint: input.dietaryConstraints?.includes("low_carb"),
      hasHighProteinConstraint: input.dietaryConstraints?.includes("high_protein"),
    });
    for (const issue of feasibility.issues) {
      issues.push({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  let score = 1;
  score -= errorCount * 0.2;
  score -= warningCount * 0.06;
  score -= infoCount * 0.02;
  score = Math.max(0, Math.min(1, score));

  return {
    passed: errorCount === 0,
    score: Number(score.toFixed(2)),
    issues,
    nutritionConfidenceScore: nutritionResult.confidenceScore,
  };
}

export type IngredientPlannerDependencies = {
  callPlannerModel: (payload: IngredientPlanPromptPayload) => Promise<IngredientPlanCandidate>;
};

export type IngredientPlannerRunResult = {
  candidate: IngredientPlanCandidate;
  validation: IngredientPlannerValidationResult;
  prompt: IngredientPlanPromptPayload;
};

function buildIngredientPlanRetryPrompt(
  input: IngredientPlannerInput,
  missingGroups: string[][],
  dietaryViolations?: string[],
  missingNamedIngredients?: string[]
): IngredientPlanPromptPayload {
  const base = buildIngredientPlanPrompt(input);
  const groupList = missingGroups.map((g) => `[${g.join(" | ")}]`).join(", ");

  let suffix = missingGroups.length > 0
    ? `\n\nCRITICAL: The previous plan was REJECTED because it was missing these required class groups: ${groupList}. ` +
      `You MUST include at least one ingredient satisfying EACH of these groups. ` +
      `Do not return a partial or empty plan. ` +
      `Do not omit core identity ingredients for this dish family. ` +
      `If you are unsure which ingredient covers a group, choose the simplest canonical example. ` +
      `A plan that still misses any required group will be rejected again.`
    : "";

  if (dietaryViolations?.length) {
    suffix +=
      `\n\nALSO CRITICAL: The previous plan violated dietary constraints. ` +
      `Offending ingredients: ${dietaryViolations.join(", ")}. ` +
      `Remove ALL of them and replace with compliant alternatives. ` +
      `Do not include any ingredient that conflicts with the stated dietary constraints.`;
  }

  if (missingNamedIngredients?.length) {
    suffix +=
      `\n\nALSO CRITICAL: The previous plan omitted mandatory user-requested ingredients: ${missingNamedIngredients.join(", ")}. ` +
      `These MUST appear in the ingredient list. The user explicitly requested them. Do not drop them.`;
  }

  return {
    systemPrompt: base.systemPrompt + suffix,
    userPrompt: base.userPrompt,
  };
}

export async function runIngredientPlanner(
  input: IngredientPlannerInput,
  deps: IngredientPlannerDependencies
): Promise<IngredientPlannerRunResult> {
  const prompt = buildIngredientPlanPrompt(input);
  const candidate = await deps.callPlannerModel(prompt);
  const validation = validateIngredientPlanCandidate(input, candidate);

  // Hard-retry when required class groups, dietary constraints, or mandatory named ingredients are missing.
  // All are identity/compliance failures that must not silently flow into repair.
  const missingGroupIssues = validation.issues.filter(
    (i) => i.code === "PLANNER_MISSING_REQUIRED_CLASS_GROUP"
  );
  const dietaryViolationIssues = validation.issues.filter(
    (i) => i.code.startsWith("dietary_violation:")
  );
  const missingNamedIssues = validation.issues.filter(
    (i) => i.code === "PLANNER_MISSING_REQUIRED_NAMED_INGREDIENT"
  );

  const needsRetry =
    missingGroupIssues.length > 0 ||
    dietaryViolationIssues.length > 0 ||
    missingNamedIssues.length > 0;

  if (needsRetry) {
    const missingGroups = missingGroupIssues.map(
      (i) => (i.metadata?.classGroup as string[] | undefined) ?? []
    );
    const dietaryViolatingIngredients = dietaryViolationIssues
      .map((i) => {
        const match = i.message.match(/"([^"]+)"/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];
    const missingNamedIngredients = missingNamedIssues
      .map((i) => (i.metadata?.normalizedName as string | undefined) ?? null)
      .filter(Boolean) as string[];

    const retryPrompt = buildIngredientPlanRetryPrompt(
      input,
      missingGroups,
      dietaryViolatingIngredients.length ? dietaryViolatingIngredients : undefined,
      missingNamedIngredients.length ? missingNamedIngredients : undefined
    );
    const retryCandidate = await deps.callPlannerModel(retryPrompt);
    const retryValidation = validateIngredientPlanCandidate(input, retryCandidate);

    // Accept the retry if it reduced errors overall
    const originalErrorCount = validation.issues.filter((i) => i.severity === "error").length;
    const retryErrorCount = retryValidation.issues.filter((i) => i.severity === "error").length;
    if (retryErrorCount < originalErrorCount || retryValidation.passed) {
      return { candidate: retryCandidate, validation: retryValidation, prompt: retryPrompt };
    }
  }

  return { candidate, validation, prompt };
}

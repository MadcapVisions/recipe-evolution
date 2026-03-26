import type { MacroRepairHint } from "./macroRepairHints";
import type { DishAwareRepairAction } from "./dishAwareRepairPlanner";
import type { MacroTargetIssue } from "./macroTargetValidator";
import type { DishFamilyRule } from "./dishFamilyRules";
import type { ConstraintRepairHint } from "./constraintAwareRepairHints";

export type RepairableIngredient = {
  ingredientName: string;
  normalizedName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  grams?: number | null;
  classes?: string[];
};

export type RepairableStep = {
  text: string;
  methodTag?: string | null;
  estimatedMinutes?: number | null;
  temperatureC?: number | null;
};

export type ValidationIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  ingredientName?: string;
  stepNumber?: number;
  metadata?: Record<string, unknown>;
};

export type BuildRepairPromptParams = {
  dishFamily: DishFamilyRule;
  title?: string | null;
  ingredients: RepairableIngredient[];
  steps: RepairableStep[];
  dietaryConstraints?: string[] | null;
  macroIssues?: MacroTargetIssue[] | null;
  macroHints?: MacroRepairHint[] | null;
  dishAwareActions?: DishAwareRepairAction[] | null;
  validationIssues?: ValidationIssue[] | null;
  userIntent?: string | null;
  constraintHints?: ConstraintRepairHint[] | null;
};

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatMacroIssues(issues: MacroTargetIssue[] | null | undefined): string[] {
  if (!issues?.length) return [];

  return issues.map((issue) => {
    const expectedParts: string[] = [];
    if (issue.expected?.min != null) expectedParts.push(`min=${issue.expected.min}`);
    if (issue.expected?.max != null) expectedParts.push(`max=${issue.expected.max}`);

    return `- [${issue.severity}] ${issue.metric}: ${issue.message}${
      expectedParts.length ? ` (${expectedParts.join(", ")})` : ""
    }`;
  });
}

function formatValidationIssues(issues: ValidationIssue[] | null | undefined): string[] {
  if (!issues?.length) return [];

  return issues.map((issue) => {
    const locationParts: string[] = [];
    if (issue.ingredientName) locationParts.push(`ingredient=${issue.ingredientName}`);
    if (issue.stepNumber != null) locationParts.push(`step=${issue.stepNumber}`);

    return `- [${issue.severity}] ${issue.code}: ${issue.message}${
      locationParts.length ? ` (${locationParts.join(", ")})` : ""
    }`;
  });
}

function formatMacroHints(hints: MacroRepairHint[] | null | undefined): string[] {
  if (!hints?.length) return [];

  return hints.map((hint) => {
    const actions =
      hint.suggestedActions?.length
        ? ` Suggested actions: ${hint.suggestedActions.join("; ")}`
        : "";

    return `- [${hint.priority}] ${hint.targetMetric}: ${hint.promptHint}${actions}`;
  });
}

function formatConstraintHints(hints: ConstraintRepairHint[] | null | undefined): string[] {
  if (!hints?.length) return [];

  return hints.map((hint) => {
    const candidates = hint.candidateReplacements.length
      ? ` Candidates: ${hint.candidateReplacements.slice(0, 5).join(", ")}.`
      : "";
    return `- [${hint.priority}] ${hint.constraint}: ${hint.promptInstruction}${candidates}`;
  });
}

function formatDishAwareActions(actions: DishAwareRepairAction[] | null | undefined): string[] {
  if (!actions?.length) return [];

  return actions.map((action) => {
    const candidateText =
      action.candidateIngredients?.length
        ? ` Candidates: ${action.candidateIngredients.join(", ")}.`
        : "";

    const avoidText =
      action.avoidClasses?.length
        ? ` Avoid classes: ${action.avoidClasses.join(", ")}.`
        : "";

    return `- [${action.priority}] ${action.type}: ${action.promptInstruction}${candidateText}${avoidText}`.trim();
  });
}

function buildDoNotChangeRules(params: {
  dishFamily: DishFamilyRule;
  dietaryConstraints?: string[] | null;
}): string[] {
  const rules: string[] = [
    "Do not change the dish family.",
    "Do not introduce forbidden ingredient classes.",
    "Do not add unrelated creative ingredients.",
    "Do not rewrite the recipe into a different dish.",
    "Do not remove required ingredient classes unless replacing them with a valid equivalent.",
    "Do not introduce ingredients that conflict with the stated dietary constraints.",
    "Keep edits as small and targeted as possible.",
  ];

  if (params.dishFamily.requiredMethods?.length) {
    rules.push(
      `Preserve or restore these required methods if relevant: ${params.dishFamily.requiredMethods.join(", ")}.`
    );
  }

  if (params.dietaryConstraints?.length) {
    rules.push(`Respect these dietary constraints: ${params.dietaryConstraints.join(", ")}.`);
  }

  return rules;
}

function buildRepairPriorities(params: {
  validationIssues?: ValidationIssue[] | null;
  macroIssues?: MacroTargetIssue[] | null;
}): string[] {
  const priorities: string[] = [];

  const hasHardValidationErrors =
    params.validationIssues?.some((issue) => issue.severity === "error") ?? false;

  const hasMacroErrors =
    params.macroIssues?.some((issue) => issue.severity === "error") ?? false;

  if (hasHardValidationErrors) {
    priorities.push(
      "First fix structural and culinary validity issues such as forbidden ingredients, missing required components, broken method flow, or invalid dish-family fit."
    );
  }

  if (hasMacroErrors) {
    priorities.push(
      "After the recipe is structurally valid, improve macro target fit without breaking dish identity."
    );
  }

  if (priorities.length === 0) {
    priorities.push(
      "Make the smallest targeted changes needed to improve the recipe while preserving identity."
    );
  }

  return priorities;
}

export function buildRepairPrompt(params: BuildRepairPromptParams): string {
  const {
    dishFamily,
    title,
    ingredients,
    steps,
    dietaryConstraints,
    macroIssues,
    macroHints,
    dishAwareActions,
    validationIssues,
    userIntent,
    constraintHints,
  } = params;

  const macroIssueLines = formatMacroIssues(macroIssues);
  const validationIssueLines = formatValidationIssues(validationIssues);
  const macroHintLines = formatMacroHints(macroHints);
  const dishAwareActionLines = formatDishAwareActions(dishAwareActions);
  const constraintHintLines = formatConstraintHints(constraintHints);
  const doNotChangeRules = buildDoNotChangeRules({ dishFamily, dietaryConstraints });
  const repairPriorities = buildRepairPriorities({ validationIssues, macroIssues });

  return [
    "You are repairing a recipe draft.",
    "",
    "Your job is to make the smallest effective changes needed to fix the recipe.",
    "Preserve the dish identity. Be conservative. Do not get creative.",
    "",
    "## Recipe context",
    `Dish family: ${dishFamily.key} (${dishFamily.displayName})`,
    title ? `Title: ${title}` : "Title: (not provided)",
    userIntent ? `Original user intent: ${userIntent}` : "Original user intent: (not provided)",
    dietaryConstraints?.length
      ? `Dietary constraints: ${dietaryConstraints.join(", ")}`
      : "Dietary constraints: none",
    "",
    "## Dish family rules",
    `Required class groups: ${safeJson(dishFamily.requiredClassGroups)}`,
    `Common classes: ${dishFamily.commonClasses.join(", ") || "(none)"}`,
    `Optional classes: ${dishFamily.optionalClasses.join(", ") || "(none)"}`,
    `Forbidden classes: ${dishFamily.forbiddenClasses.join(", ") || "(none)"}`,
    `Suspicious classes: ${dishFamily.suspiciousClasses.join(", ") || "(none)"}`,
    `Generation constraints: ${dishFamily.generationConstraints.join(" | ") || "(none)"}`,
    "",
    "## Current ingredients",
    safeJson(ingredients),
    "",
    "## Current steps",
    safeJson(steps),
    "",
    "## Repair priorities",
    ...repairPriorities.map((line) => `- ${line}`),
    "",
    "## Validation issues",
    ...(validationIssueLines.length ? validationIssueLines : ["- none"]),
    "",
    "## Macro target issues",
    ...(macroIssueLines.length ? macroIssueLines : ["- none"]),
    "",
    "## Macro repair hints",
    ...(macroHintLines.length ? macroHintLines : ["- none"]),
    "",
    "## Constraint-aware repair hints",
    ...(constraintHintLines.length ? constraintHintLines : ["- none"]),
    "",
    "## Dish-aware repair actions",
    ...(dishAwareActionLines.length ? dishAwareActionLines : ["- none"]),
    "",
    "## Do not change rules",
    ...doNotChangeRules.map((line) => `- ${line}`),
    "",
    "## Output requirements",
    "Return JSON only.",
    "Do not include commentary.",
    "Do not explain your reasoning.",
    "Do not include markdown.",
    "",
    "Use this exact schema:",
    safeJson({
      title: title ?? "",
      ingredients: [
        {
          ingredientName: "",
          quantity: 0,
          unit: "",
          grams: null,
          classes: [],
        },
      ],
      steps: [
        {
          text: "",
          methodTag: "",
          estimatedMinutes: null,
          temperatureC: null,
        },
      ],
      notes: ["Short note explaining important repair tradeoffs, if any."],
    }),
    "",
    "## Final instruction",
    "Repair the recipe now. Keep it valid for the dish family. Keep the changes minimal but sufficient.",
  ].join("\n");
}

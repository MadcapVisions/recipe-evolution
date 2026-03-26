import type { MacroTargetIssue, MacroTargets } from "./macroTargetValidator";
import type { NutritionCalculationResult } from "./nutritionTypes";

export type MacroRepairHint = {
  code: string;
  priority: "high" | "medium" | "low";
  category: "increase" | "decrease" | "swap" | "rebalance";
  targetMetric: string;
  message: string;
  promptHint: string;
  suggestedActions: string[];
};

export type MacroRepairHintsResult = {
  hints: MacroRepairHint[];
  summary: string[];
};

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function buildProteinLowHint(): MacroRepairHint {
  return {
    code: "REPAIR_PROTEIN_LOW",
    priority: "high",
    category: "increase",
    targetMetric: "protein_g",
    message: "Protein is below target.",
    promptHint:
      "Increase protein density without sharply increasing calories or carbs. Prefer lean protein, Greek yogurt, egg whites, tofu, cottage cheese, legumes, or protein-rich swaps that fit the dish family.",
    suggestedActions: [
      "Add or increase lean protein.",
      "Swap lower-protein dairy for higher-protein dairy where appropriate.",
      "Replace part of the starch with a protein-rich ingredient if the dish allows it.",
      "Increase egg whites, tofu, chicken breast, Greek yogurt, cottage cheese, or legumes depending on dish type.",
    ],
  };
}

function buildCaloriesHighHint(): MacroRepairHint {
  return {
    code: "REPAIR_CALORIES_HIGH",
    priority: "high",
    category: "decrease",
    targetMetric: "calories",
    message: "Calories exceed target.",
    promptHint:
      "Reduce calorie density while preserving dish identity. Cut excess fat, sugar, cheese, cream, or oversized starch portions first before changing the core dish structure.",
    suggestedActions: [
      "Reduce added oils, butter, cream, or cheese.",
      "Reduce added sugar if dish type allows.",
      "Reduce portion-heavy starches or rich toppings.",
      "Use lower-fat substitutions where they make culinary sense.",
    ],
  };
}

function buildCarbsHighHint(): MacroRepairHint {
  return {
    code: "REPAIR_CARBS_HIGH",
    priority: "high",
    category: "decrease",
    targetMetric: "carbs_g",
    message: "Carbs exceed target.",
    promptHint:
      "Reduce carb-heavy ingredients such as sugar, flour, pasta, rice, bread, or sweet fruit. Preserve dish coherence by replacing part of the carb load with vegetables, protein, or lower-carb structure where possible.",
    suggestedActions: [
      "Reduce sugar or sweetener.",
      "Reduce flour, pasta, rice, bread, or other starches.",
      "Replace some starch with vegetables or protein if dish family supports it.",
      "Use lower-carb thickening or structure where appropriate.",
    ],
  };
}

function buildFatHighHint(): MacroRepairHint {
  return {
    code: "REPAIR_FAT_HIGH",
    priority: "high",
    category: "decrease",
    targetMetric: "fat_g",
    message: "Fat exceeds target.",
    promptHint:
      "Reduce fat-heavy ingredients first, especially oil, butter, cream, cheese, fatty cuts of meat, nuts, and high-fat sauces. Keep enough fat for flavor and texture.",
    suggestedActions: [
      "Reduce oil, butter, cream, or cheese.",
      "Use leaner protein.",
      "Use lower-fat dairy where appropriate.",
      "Trim rich toppings, dressings, or finishing fats.",
    ],
  };
}

function buildFiberLowHint(): MacroRepairHint {
  return {
    code: "REPAIR_FIBER_LOW",
    priority: "medium",
    category: "increase",
    targetMetric: "fiber_g",
    message: "Fiber is below target.",
    promptHint:
      "Increase fiber with vegetables, legumes, seeds, oats, berries, or whole-grain substitutions that fit the dish family. Do not break the dish identity.",
    suggestedActions: [
      "Add vegetables or legumes.",
      "Use a higher-fiber grain or flour if dish type allows.",
      "Add seeds, oats, berries, or leafy greens where appropriate.",
      "Replace part of low-fiber starch with higher-fiber ingredients.",
    ],
  };
}

function buildSugarHighHint(): MacroRepairHint {
  return {
    code: "REPAIR_SUGAR_HIGH",
    priority: "medium",
    category: "decrease",
    targetMetric: "sugar_g",
    message: "Sugar exceeds target.",
    promptHint:
      "Reduce added sugar first, then reduce sweet ingredients if needed. Keep enough sweetness for the recipe style but avoid unnecessary sugar load.",
    suggestedActions: [
      "Reduce added sugar, honey, syrup, or sweetened ingredients.",
      "Use less sweet fruit or reduce fruit quantity where appropriate.",
      "Avoid adding sweetness unless necessary for the dish family.",
    ],
  };
}

function buildSodiumHighHint(): MacroRepairHint {
  return {
    code: "REPAIR_SODIUM_HIGH",
    priority: "medium",
    category: "decrease",
    targetMetric: "sodium_mg",
    message: "Sodium exceeds target.",
    promptHint:
      "Reduce sodium-heavy ingredients such as soy sauce, broth concentrates, salty cheeses, processed meats, and excess added salt. Preserve flavor with acid, herbs, aromatics, and spices.",
    suggestedActions: [
      "Reduce added salt.",
      "Reduce soy sauce, bouillon, stock concentrate, processed meats, or salty cheese.",
      "Use acid, herbs, and spices to replace some salt impact.",
    ],
  };
}

function buildCaloriesLowHint(): MacroRepairHint {
  return {
    code: "REPAIR_CALORIES_LOW",
    priority: "medium",
    category: "increase",
    targetMetric: "calories",
    message: "Calories are below target.",
    promptHint:
      "Increase calorie density in a controlled way using coherent additions such as healthy fats, starch, dairy, nuts, or larger portions, depending on the dish family and other macro constraints.",
    suggestedActions: [
      "Increase portion size moderately.",
      "Add more starch, dairy, or healthy fats if compatible with the recipe goals.",
      "Use calorie-dense but coherent additions.",
    ],
  };
}

function buildCarbsLowHint(): MacroRepairHint {
  return {
    code: "REPAIR_CARBS_LOW",
    priority: "low",
    category: "increase",
    targetMetric: "carbs_g",
    message: "Carbs are below target.",
    promptHint:
      "Increase carbohydrates in a dish-appropriate way, such as grains, fruit, legumes, pasta, rice, oats, or bread components depending on dish family.",
    suggestedActions: [
      "Increase grains, fruit, legumes, pasta, rice, oats, or bread where appropriate.",
      "Add a carb side or base if the dish supports it.",
    ],
  };
}

function buildFatLowHint(): MacroRepairHint {
  return {
    code: "REPAIR_FAT_LOW",
    priority: "low",
    category: "increase",
    targetMetric: "fat_g",
    message: "Fat is below target.",
    promptHint:
      "Increase fat carefully with oil, butter, avocado, dairy, nuts, seeds, or fattier proteins if that fits the dish and does not break other targets.",
    suggestedActions: [
      "Increase oil, butter, avocado, dairy, nuts, or seeds where appropriate.",
      "Use a slightly richer protein or dairy component if allowed.",
    ],
  };
}

function buildGenericRebalanceHint(metrics: string[]): MacroRepairHint {
  return {
    code: "REPAIR_REBALANCE_MACROS",
    priority: "high",
    category: "rebalance",
    targetMetric: metrics.join(","),
    message: "Multiple macro targets conflict or need rebalancing.",
    promptHint:
      "Rebalance the recipe holistically. Reduce calorie-dense ingredients that do not contribute enough protein or fiber, and strengthen ingredients that better fit the macro goals while preserving dish identity.",
    suggestedActions: [
      "Reduce low-value calories first.",
      "Increase macro-efficient ingredients such as lean protein or fiber-rich components.",
      "Keep the dish family recognizable while rebalancing.",
    ],
  };
}

export function buildMacroRepairHints(params: {
  issues: MacroTargetIssue[];
  nutrition: NutritionCalculationResult;
  targets?: MacroTargets | null;
}): MacroRepairHintsResult {
  const { issues, nutrition, targets } = params;

  const hints: MacroRepairHint[] = [];
  const summary: string[] = [];

  const errorOrWarningIssues = issues.filter(
    (issue) => issue.severity === "error" || issue.severity === "warning"
  );

  const metrics = uniqueStrings(errorOrWarningIssues.map((i) => i.metric));

  for (const metric of metrics) {
    switch (metric) {
      case "protein_g": {
        const below = errorOrWarningIssues.some(
          (i) => i.metric === metric && i.code.includes("BELOW_MIN")
        );
        const above = errorOrWarningIssues.some(
          (i) => i.metric === metric && i.code.includes("ABOVE_MAX")
        );

        if (below) hints.push(buildProteinLowHint());

        if (above) {
          hints.push({
            code: "REPAIR_PROTEIN_HIGH",
            priority: "low",
            category: "decrease",
            targetMetric: "protein_g",
            message: "Protein exceeds target.",
            promptHint:
              "Reduce excessive protein while preserving dish balance. Cut concentrated protein ingredients slightly instead of removing them entirely.",
            suggestedActions: [
              "Reduce portion of the main protein slightly.",
              "Balance protein-heavy additions against the rest of the recipe.",
            ],
          });
        }
        break;
      }

      case "calories": {
        const below = errorOrWarningIssues.some(
          (i) => i.metric === metric && i.code.includes("BELOW_MIN")
        );
        const above = errorOrWarningIssues.some(
          (i) => i.metric === metric && i.code.includes("ABOVE_MAX")
        );

        if (below) hints.push(buildCaloriesLowHint());
        if (above) hints.push(buildCaloriesHighHint());
        break;
      }

      case "carbs_g": {
        const below = errorOrWarningIssues.some(
          (i) => i.metric === metric && i.code.includes("BELOW_MIN")
        );
        const above = errorOrWarningIssues.some(
          (i) => i.metric === metric && i.code.includes("ABOVE_MAX")
        );

        if (below) hints.push(buildCarbsLowHint());
        if (above) hints.push(buildCarbsHighHint());
        break;
      }

      case "fat_g": {
        const below = errorOrWarningIssues.some(
          (i) => i.metric === metric && i.code.includes("BELOW_MIN")
        );
        const above = errorOrWarningIssues.some(
          (i) => i.metric === metric && i.code.includes("ABOVE_MAX")
        );

        if (below) hints.push(buildFatLowHint());
        if (above) hints.push(buildFatHighHint());
        break;
      }

      case "fiber_g": {
        const below = errorOrWarningIssues.some(
          (i) => i.metric === metric && i.code.includes("BELOW_MIN")
        );
        const above = errorOrWarningIssues.some(
          (i) => i.metric === metric && i.code.includes("ABOVE_MAX")
        );

        if (below) hints.push(buildFiberLowHint());

        if (above) {
          hints.push({
            code: "REPAIR_FIBER_HIGH",
            priority: "low",
            category: "decrease",
            targetMetric: "fiber_g",
            message: "Fiber exceeds target.",
            promptHint:
              "Reduce very high-fiber ingredients slightly if needed for digestibility or target matching, while keeping enough structure and nutrition.",
            suggestedActions: [
              "Reduce legumes, bran-heavy ingredients, seeds, or very high-fiber add-ins slightly.",
            ],
          });
        }
        break;
      }

      case "sugar_g": {
        const above = errorOrWarningIssues.some(
          (i) => i.metric === metric && i.code.includes("ABOVE_MAX")
        );
        if (above) hints.push(buildSugarHighHint());
        break;
      }

      case "sodium_mg": {
        const above = errorOrWarningIssues.some(
          (i) => i.metric === metric && i.code.includes("ABOVE_MAX")
        );
        if (above) hints.push(buildSodiumHighHint());
        break;
      }

      default:
        break;
    }
  }

  const highPriorityMetrics = hints
    .filter((h) => h.priority === "high")
    .map((h) => h.targetMetric);

  if (highPriorityMetrics.length >= 2) {
    hints.push(buildGenericRebalanceHint(uniqueStrings(highPriorityMetrics)));
  }

  if (nutrition.confidenceScore < 0.85) {
    summary.push(
      `Nutrition confidence is low (${nutrition.confidenceScore}), so repair hints should be treated as directional rather than exact.`
    );
  }

  if (!targets) {
    summary.push("No explicit macro targets were provided.");
  }

  if (hints.length === 0) {
    summary.push("No macro repair hints were generated.");
  } else {
    summary.push(
      `Generated ${hints.length} macro repair hint(s) across ${metrics.length} metric(s).`
    );
  }

  return { hints, summary };
}

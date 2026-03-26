import type { MacroRepairHint } from "./macroRepairHints";
import type { DishFamilyRule } from "./dishFamilyRules";

export type DietaryConstraint =
  | "vegetarian"
  | "vegan"
  | "gluten_free"
  | "dairy_free"
  | "nut_free"
  | "low_carb"
  | "high_protein";

export type RepairableIngredient = {
  ingredientName: string;
  normalizedName?: string | null;
  classes?: string[];
};

export type DishAwareRepairAction = {
  code: string;
  priority: "high" | "medium" | "low";
  type: "add" | "remove" | "reduce" | "increase" | "swap" | "rebalance";
  reason: string;
  promptInstruction: string;
  targetClasses?: string[];
  avoidClasses?: string[];
  candidateIngredients?: string[];
};

export type DishAwareRepairPlan = {
  actions: DishAwareRepairAction[];
  blockedActions: string[];
  summary: string[];
};

type BuildDishAwareRepairPlanParams = {
  dishFamily: DishFamilyRule;
  macroHints: MacroRepairHint[];
  ingredients: RepairableIngredient[];
  dietaryConstraints?: DietaryConstraint[] | null;
};

function hasClass(ingredient: RepairableIngredient, className: string): boolean {
  return ingredient.classes?.includes(className) ?? false;
}

function hasAnyClass(
  ingredients: RepairableIngredient[],
  classNames: string[]
): boolean {
  return ingredients.some((ingredient) =>
    classNames.some((className) => hasClass(ingredient, className))
  );
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isConstraintActive(
  dietaryConstraints: DietaryConstraint[] | null | undefined,
  constraint: DietaryConstraint
): boolean {
  return dietaryConstraints?.includes(constraint) ?? false;
}

function getAllowedProteinCandidates(
  dietaryConstraints?: DietaryConstraint[] | null
): string[] {
  if (isConstraintActive(dietaryConstraints, "vegan")) {
    return ["tofu", "tempeh", "edamame", "lentils", "beans"];
  }
  if (isConstraintActive(dietaryConstraints, "vegetarian")) {
    return ["egg whites", "greek yogurt", "cottage cheese", "tofu", "lentils", "beans"];
  }
  if (isConstraintActive(dietaryConstraints, "dairy_free")) {
    return ["chicken breast", "turkey breast", "egg whites", "tofu", "shrimp", "lentils"];
  }
  return [
    "chicken breast",
    "turkey breast",
    "egg whites",
    "greek yogurt",
    "cottage cheese",
    "tofu",
    "shrimp",
    "lentils",
  ];
}

function getAllowedFiberCandidates(
  dietaryConstraints?: DietaryConstraint[] | null
): string[] {
  if (isConstraintActive(dietaryConstraints, "low_carb")) {
    return ["spinach", "broccoli", "cauliflower", "chia seeds", "zucchini"];
  }
  return ["beans", "lentils", "berries", "oats", "chia seeds", "vegetables", "leafy greens"];
}

function getDishFamilySpecificProteinInstruction(dishFamilyKey: string): string {
  switch (dishFamilyKey) {
    case "creamy_pasta":
    case "tomato_pasta":
    case "pasta":
      return "Increase protein in a pasta-appropriate way, such as chicken breast, shrimp, Greek yogurt, cottage cheese, tofu, or legumes. Avoid breaking sauce texture.";
    case "smoothie":
      return "Increase protein with smoothie-appropriate ingredients like Greek yogurt, protein-rich dairy, tofu, or protein powder if allowed. Do not make the drink chalky or overly thick.";
    case "salad":
      return "Increase protein with salad-appropriate ingredients like chicken, tuna, tofu, beans, lentils, eggs, or cottage cheese.";
    case "omelet_frittata":
      return "Increase protein with eggs, egg whites, cottage cheese, lean meat, or tofu while preserving egg structure.";
    case "tacos":
      return "Increase protein with taco-appropriate fillings such as chicken, beans, lean beef, shrimp, tofu, or extra fish.";
    case "custard_flan":
    case "bread_pudding":
    case "brownie":
    case "cookie":
    case "cheesecake":
      return "Do not force a high-protein repair that breaks the dessert identity. Use dairy or egg-based improvements only if they remain culinarily coherent.";
    default:
      return "Increase protein in a dish-appropriate way without breaking the identity of the dish.";
  }
}

function getDishFamilySpecificCalorieReductionInstruction(dishFamilyKey: string): string {
  switch (dishFamilyKey) {
    case "pasta":
    case "creamy_pasta":
    case "tomato_pasta":
      return "Reduce calories by trimming excess cheese, cream, butter, oil, and oversized pasta portions before changing the core sauce.";
    case "smoothie":
      return "Reduce calories by trimming nut butters, oils, sugary add-ins, sweetened yogurt, and excess fruit while preserving drinkability.";
    case "salad":
      return "Reduce calories by trimming dressing, cheese, fried toppings, nuts, seeds, and calorie-dense add-ons before reducing vegetables.";
    case "bread_pudding":
    case "brownie":
    case "cookie":
    case "cheesecake":
      return "Reduce calories carefully by trimming sugar, butter, cream, and portion size while preserving dessert structure.";
    default:
      return "Reduce calories by trimming low-value calorie sources first, especially excess fat, sugar, and oversized starch portions.";
  }
}

function getDishFamilySpecificCarbReductionInstruction(dishFamilyKey: string): string {
  switch (dishFamilyKey) {
    case "pasta":
    case "tomato_pasta":
    case "creamy_pasta":
      return "Reduce carbs by reducing pasta quantity or replacing part of it with vegetables or protein, without destroying the dish identity.";
    case "smoothie":
      return "Reduce carbs by reducing high-sugar fruit, juice, sweeteners, and other sugary add-ins.";
    case "tacos":
      return "Reduce carbs by using fewer tortillas or a lower-carb carrier and strengthening the filling.";
    case "custard_flan":
    case "brownie":
    case "cookie":
      return "Reduce carbs mainly through sweetener or flour reduction, but stay within dessert structure limits.";
    default:
      return "Reduce carbs by trimming sugar and starch-heavy ingredients in a dish-appropriate way.";
  }
}

function getDishFamilySpecificFatReductionInstruction(dishFamilyKey: string): string {
  switch (dishFamilyKey) {
    case "creamy_pasta":
    case "pasta":
      return "Reduce fat by trimming butter, oil, cream, and cheese first, while keeping enough sauce body.";
    case "salad":
      return "Reduce fat by trimming dressing, nuts, cheese, seeds, and fried toppings before cutting the salad base.";
    case "smoothie":
      return "Reduce fat by trimming nut butter, coconut cream, seeds, and full-fat dairy if present.";
    case "cheesecake":
      return "Reduce fat only cautiously. Over-correcting will break cheesecake texture.";
    default:
      return "Reduce fat by trimming added oils, butter, cheese, cream, and fatty protein sources first.";
  }
}

function blocksDessertProteinRepair(dishFamilyKey: string): boolean {
  return ["custard_flan", "bread_pudding", "brownie", "cookie", "cheesecake", "chocolate_cake"].includes(
    dishFamilyKey
  );
}

function canUseDairy(dietaryConstraints?: DietaryConstraint[] | null): boolean {
  return (
    !isConstraintActive(dietaryConstraints, "vegan") &&
    !isConstraintActive(dietaryConstraints, "dairy_free")
  );
}

export function buildDishAwareRepairPlan(
  params: BuildDishAwareRepairPlanParams
): DishAwareRepairPlan {
  const { dishFamily, macroHints, ingredients, dietaryConstraints = [] } = params;

  const actions: DishAwareRepairAction[] = [];
  const blockedActions: string[] = [];
  const summary: string[] = [];

  for (const hint of macroHints) {
    switch (hint.code) {
      case "REPAIR_PROTEIN_LOW": {
        if (blocksDessertProteinRepair(dishFamily.key)) {
          if (dishFamily.key === "cheesecake" && canUseDairy(dietaryConstraints)) {
            actions.push({
              code: "DISH_AWARE_PROTEIN_LOW_DESSERT_DAIRY",
              priority: "medium",
              type: "rebalance",
              reason: "Protein is low, but dessert identity limits aggressive fixes.",
              promptInstruction:
                "Improve protein only through dessert-compatible changes, such as increasing dairy protein density or slightly adjusting eggs if the dessert structure supports it. Do not turn this dessert into a protein gimmick.",
              targetClasses: ["dairy", "egg"],
              avoidClasses: ["protein_meat", "protein_fish", "allium", "savory_herb"],
              candidateIngredients: ["greek yogurt", "cottage cheese", "cream cheese", "egg whites"],
            });
          } else {
            blockedActions.push(
              `Blocked aggressive protein repair for ${dishFamily.key} because it would likely break dessert identity.`
            );
          }
          break;
        }

        actions.push({
          code: "DISH_AWARE_PROTEIN_LOW",
          priority: "high",
          type: "increase",
          reason: "Protein is below target and can be improved within this dish family.",
          promptInstruction: getDishFamilySpecificProteinInstruction(dishFamily.key),
          targetClasses: ["protein_meat", "protein_fish", "protein_plant", "egg", "dairy"],
          avoidClasses: dishFamily.forbiddenClasses,
          candidateIngredients: getAllowedProteinCandidates(dietaryConstraints),
        });
        break;
      }

      case "REPAIR_CALORIES_HIGH": {
        actions.push({
          code: "DISH_AWARE_CALORIES_HIGH",
          priority: "high",
          type: "reduce",
          reason: "Calories exceed target.",
          promptInstruction: getDishFamilySpecificCalorieReductionInstruction(dishFamily.key),
          targetClasses: ["fat_oil", "sweetener", "dairy", "starch"],
          avoidClasses: [],
          candidateIngredients: [],
        });
        break;
      }

      case "REPAIR_CARBS_HIGH": {
        actions.push({
          code: "DISH_AWARE_CARBS_HIGH",
          priority: "high",
          type: "reduce",
          reason: "Carbs exceed target.",
          promptInstruction: getDishFamilySpecificCarbReductionInstruction(dishFamily.key),
          targetClasses: ["sweetener", "flour_grain", "starch", "fruit"],
          avoidClasses: [],
          candidateIngredients: [],
        });
        break;
      }

      case "REPAIR_FAT_HIGH": {
        actions.push({
          code: "DISH_AWARE_FAT_HIGH",
          priority: "high",
          type: "reduce",
          reason: "Fat exceeds target.",
          promptInstruction: getDishFamilySpecificFatReductionInstruction(dishFamily.key),
          targetClasses: ["fat_oil", "dairy", "cheese", "nut", "seed", "protein_meat"],
          avoidClasses: [],
          candidateIngredients: [],
        });
        break;
      }

      case "REPAIR_FIBER_LOW": {
        actions.push({
          code: "DISH_AWARE_FIBER_LOW",
          priority: "medium",
          type: "increase",
          reason: "Fiber is below target.",
          promptInstruction:
            "Increase fiber with dish-compatible vegetables, legumes, seeds, oats, berries, or whole-grain substitutions. Do not break texture or identity.",
          targetClasses: ["vegetable", "leafy_green", "legume", "seed", "fruit", "flour_grain"],
          avoidClasses: dishFamily.forbiddenClasses,
          candidateIngredients: getAllowedFiberCandidates(dietaryConstraints),
        });
        break;
      }

      case "REPAIR_SUGAR_HIGH": {
        actions.push({
          code: "DISH_AWARE_SUGAR_HIGH",
          priority: "medium",
          type: "reduce",
          reason: "Sugar exceeds target.",
          promptInstruction:
            "Reduce added sugar first. Keep enough sweetness for the recipe style, but remove unnecessary sweeteners and sugary add-ins.",
          targetClasses: ["sweetener", "fruit"],
          avoidClasses: [],
          candidateIngredients: [],
        });
        break;
      }

      case "REPAIR_SODIUM_HIGH": {
        actions.push({
          code: "DISH_AWARE_SODIUM_HIGH",
          priority: "medium",
          type: "reduce",
          reason: "Sodium exceeds target.",
          promptInstruction:
            "Reduce salt-heavy ingredients first, such as soy sauce, salty cheese, processed meat, broth concentrate, and excess added salt. Replace part of the flavor load with acid, herbs, or spices if appropriate.",
          targetClasses: ["soy_sauce", "salt", "cheese", "protein_meat", "broth"],
          avoidClasses: [],
          candidateIngredients: [],
        });
        break;
      }

      case "REPAIR_CALORIES_LOW": {
        actions.push({
          code: "DISH_AWARE_CALORIES_LOW",
          priority: "low",
          type: "increase",
          reason: "Calories are below target.",
          promptInstruction:
            "Increase calories in a dish-appropriate way using coherent additions such as starch, dairy, healthy fat, or larger portions without violating other macro targets.",
          targetClasses: ["starch", "fat_oil", "dairy", "nut", "seed"],
          avoidClasses: dishFamily.forbiddenClasses,
          candidateIngredients: [],
        });
        break;
      }

      case "REPAIR_CARBS_LOW": {
        actions.push({
          code: "DISH_AWARE_CARBS_LOW",
          priority: "low",
          type: "increase",
          reason: "Carbs are below target.",
          promptInstruction:
            "Increase carbohydrates in a dish-compatible way using grains, starches, fruit, oats, legumes, or bread components depending on the dish family.",
          targetClasses: ["starch", "flour_grain", "fruit", "legume"],
          avoidClasses: dishFamily.forbiddenClasses,
          candidateIngredients: [],
        });
        break;
      }

      case "REPAIR_FAT_LOW": {
        actions.push({
          code: "DISH_AWARE_FAT_LOW",
          priority: "low",
          type: "increase",
          reason: "Fat is below target.",
          promptInstruction:
            "Increase fat carefully using dish-compatible sources like oil, butter, avocado, dairy, nuts, or seeds, without overshooting calories.",
          targetClasses: ["fat_oil", "dairy", "nut", "seed"],
          avoidClasses: dishFamily.forbiddenClasses,
          candidateIngredients: [],
        });
        break;
      }

      case "REPAIR_REBALANCE_MACROS": {
        actions.push({
          code: "DISH_AWARE_REBALANCE",
          priority: "high",
          type: "rebalance",
          reason: "Multiple macro targets need coordinated repair.",
          promptInstruction:
            "Rebalance the recipe holistically. Remove low-value calories first, then strengthen protein and fiber where appropriate, while keeping the dish family recognizable.",
          targetClasses: [
            "protein_meat", "protein_fish", "protein_plant",
            "vegetable", "legume", "fat_oil", "sweetener", "starch",
          ],
          avoidClasses: dishFamily.forbiddenClasses,
          candidateIngredients: [],
        });
        break;
      }

      default:
        break;
    }
  }

  // Constraint cleanup — remove invalid candidates based on dietary restrictions
  for (const action of actions) {
    if (!action.candidateIngredients?.length) continue;

    let filtered = [...action.candidateIngredients];

    if (isConstraintActive(dietaryConstraints, "vegan")) {
      filtered = filtered.filter(
        (name) =>
          !["chicken breast", "turkey breast", "shrimp", "greek yogurt", "cottage cheese", "egg whites", "cream cheese"].includes(name)
      );
    }
    if (isConstraintActive(dietaryConstraints, "vegetarian")) {
      filtered = filtered.filter(
        (name) => !["chicken breast", "turkey breast", "shrimp"].includes(name)
      );
    }
    if (isConstraintActive(dietaryConstraints, "dairy_free")) {
      filtered = filtered.filter(
        (name) => !["greek yogurt", "cottage cheese", "cream cheese"].includes(name)
      );
    }
    if (isConstraintActive(dietaryConstraints, "nut_free")) {
      filtered = filtered.filter(
        (name) => !["almonds", "walnuts", "cashews"].includes(name)
      );
    }

    action.candidateIngredients = uniqueStrings(filtered);
  }

  if (actions.length === 0) {
    summary.push("No dish-aware repair actions were generated.");
  } else {
    summary.push(`Generated ${actions.length} dish-aware repair action(s).`);
  }

  if (blockedActions.length > 0) {
    summary.push(
      `${blockedActions.length} repair action(s) were blocked by dish-family or dietary logic.`
    );
  }

  if (hasAnyClass(ingredients, ["sweetener"]) && dishFamily.key === "smoothie") {
    summary.push(
      "Smoothie repairs should preserve drinkability and avoid over-thickening."
    );
  }

  return { actions, blockedActions, summary };
}

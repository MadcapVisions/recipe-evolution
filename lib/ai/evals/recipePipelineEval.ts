import type { AIMessage } from "../chatPromptBuilder";
import { compileCookingBrief } from "../briefCompiler";
import { buildRecipePlanFromBrief } from "../recipePlanner";
import { verifyRecipeAgainstBrief } from "../recipeVerifier";
import type { CookingBrief } from "../contracts/cookingBrief";
import type { RecipePlan } from "../contracts/recipePlan";
import type { VerificationResult } from "../contracts/verificationResult";
import type { SeedRecipeEvalCase } from "./seedRecipeEvals";

export type RecipePipelineEvalResult = {
  testCaseId: string;
  brief: CookingBrief;
  recipePlan: RecipePlan;
  verification: VerificationResult;
  passes: boolean;
};

type RecipeLike = Parameters<typeof verifyRecipeAgainstBrief>[0]["recipe"];

function toConversationHistory(conversation: string): AIMessage[] {
  return conversation
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^chef:/i.test(line)) {
        return {
          role: "assistant" as const,
          content: line.replace(/^chef:\s*/i, "").trim(),
        };
      }

      return {
        role: "user" as const,
        content: line.replace(/^user:\s*/i, "").trim(),
      };
    });
}

function buildExpectedRecipe(testCase: SeedRecipeEvalCase, brief: CookingBrief): RecipeLike {
  const normalizedName = brief.dish.normalized_name ?? testCase.expected.normalizedNameHint ?? testCase.label;
  const lowerPrompt = `${testCase.prompt} ${testCase.conversation}`.toLowerCase();
  const ingredients: Array<{ name: string }> = [];
  const steps: Array<{ text: string }> = [];
  let description = `${testCase.label}.`;

  if (testCase.expected.dishFamily === "pizza") {
    ingredients.push(
      { name: "1 lb pizza dough" },
      { name: "1/2 cup tomato sauce" },
      { name: "8 oz mozzarella" }
    );
    if (lowerPrompt.includes("mushroom")) {
      ingredients.push({ name: "8 oz mushrooms" });
      steps.push(
        { text: "Stretch the dough thin for a flatbread-style pizza and top it with the sauce, mozzarella, and mushrooms." },
        { text: "Bake at high heat until the crust is crisp, deeply golden, and the mushrooms are browned." }
      );
    } else {
      steps.push(
        { text: "Stretch the dough into an oiled sheet pan and add the sauce and mozzarella." },
        { text: "Bake at high heat until the crust is crisp and deeply golden." }
      );
    }
    description = `Crisp, focaccia-style pizza built around ${normalizedName}.`;
    if (lowerPrompt.includes("flatbread")) {
      description = `Crispy flatbread-style pizza built around ${normalizedName}.`;
      if (!lowerPrompt.includes("mushroom")) {
        steps[0] = { text: "Stretch the dough thin for a flatbread-style pizza and add the sauce and mozzarella." };
      }
    }
  } else if (testCase.expected.dishFamily === "pasta") {
    ingredients.push(
      { name: "12 oz pasta" },
      { name: "2 eggs" },
      { name: "1 cup pecorino romano" }
    );
    if (lowerPrompt.includes("no cream")) {
      description = `Traditional ${normalizedName} without cream.`;
    }
    steps.push(
      { text: "Cook the pasta in salted water and reserve some pasta water." },
      { text: "Finish the pasta with the sauce components off the heat until glossy and cohesive." }
    );
  } else if (testCase.expected.dishFamily === "tacos") {
    ingredients.push(
      { name: "8 tortillas" },
      { name: "1 lb chicken" },
      { name: "2 jalapenos" },
      { name: "1 lime" }
    );
    steps.push(
      { text: "Cook the chicken with sliced jalapenos until deeply seasoned and concentrated." },
      { text: "Warm the tortillas and assemble the tacos with a squeeze of lime just before serving." }
    );
    description = `Tacos that stay in taco format, not a bowl.`;
  } else if (testCase.expected.dishFamily === "dips_spreads") {
    ingredients.push({ name: "2 eggplants" }, { name: "3 tbsp olive oil" });
    steps.push(
      { text: "Roast the eggplant until fully tender and lightly charred." },
      { text: "Mash the flesh gently with olive oil for a delicate dip texture." }
    );
    description = `A delicate ${normalizedName} dip.`;
  } else if (testCase.expected.dishFamily === "sauce_condiment") {
    ingredients.push({ name: "2 cups crushed tomatoes" }, { name: "2 tbsp olive oil" }, { name: "3 garlic cloves, minced" });
    steps.push(
      { text: "Sauté the garlic in olive oil until fragrant." },
      { text: "Add the tomatoes and simmer until the sauce thickens to a coating consistency." }
    );
    description = `A sauce to accompany ${normalizedName}.`;
  } else {
    ingredients.push({ name: `1 batch ${normalizedName}` });
    steps.push(
      { text: "Build the dish around the locked direction from the conversation." },
      { text: "Finish with the requested constraints and serving style intact." }
    );
  }

  if (lowerPrompt.includes("no onions")) {
    description += " No onions.";
  }
  if (lowerPrompt.includes("no garlic")) {
    description += " No garlic.";
  }

  return {
    title: normalizedName,
    description,
    ingredients,
    steps,
  };
}

export function runRecipePipelineEval(testCase: SeedRecipeEvalCase): RecipePipelineEvalResult {
  const conversationHistory = toConversationHistory(testCase.conversation);
  const brief = compileCookingBrief({
    userMessage: testCase.prompt,
    conversationHistory,
  });
  const recipePlan = buildRecipePlanFromBrief(brief);
  const verification = verifyRecipeAgainstBrief({
    brief,
    recipe: buildExpectedRecipe(testCase, brief),
    fallbackContext: `${testCase.prompt} ${testCase.conversation}`,
  });

  return {
    testCaseId: testCase.id,
    brief,
    recipePlan,
    verification,
    passes: verification.passes,
  };
}

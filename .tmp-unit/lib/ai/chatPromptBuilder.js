"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildChefChatPrompt = buildChefChatPrompt;
const chefSystemPrompt_1 = require("./chefSystemPrompt");
const chefChatExamples_1 = require("./chefChatExamples");
const flavorAnalyzer_1 = require("./chefEngine/flavorAnalyzer");
const flavorGraphEngine_1 = require("./flavorGraph/flavorGraphEngine");
const substitutionEngine_1 = require("./substitutionEngine/substitutionEngine");
const buildCookingContext_1 = require("./preprocessing/buildCookingContext");
function buildChefChatPrompt(userMessage, recipeContext, conversationHistory = [], userTasteSummary) {
    let contextText = "";
    if (recipeContext) {
        contextText = `
Current Recipe Context

Title: ${recipeContext.title ?? "Unknown"}

Ingredients:
${recipeContext.ingredients?.join(", ") ?? "None provided"}

Steps:
${recipeContext.steps?.join("\n") ?? "None provided"}
`;
    }
    const flavorAdvice = (0, flavorAnalyzer_1.analyzeFlavor)(recipeContext?.ingredients || []);
    const flavorGraphContext = (0, flavorGraphEngine_1.generateFlavorContext)(recipeContext?.ingredients || []);
    const substitutionContext = (0, substitutionEngine_1.generateSubstitutionContext)(recipeContext?.ingredients || []);
    const cookingContext = (0, buildCookingContext_1.buildCookingContext)(recipeContext?.ingredients || []);
    return [
        {
            role: "system",
            content: chefSystemPrompt_1.CHEF_SYSTEM_PROMPT,
        },
        {
            role: "system",
            content: `
You are in conversation mode only.
Give the user concrete meal direction quickly.
If the user asks for "best options", "what would be flavorful", or something similar, respond with actual options instead of asking them to restate their goal.
When the user has already supplied meal type, main ingredients, or flavor direction, synthesize that information and move forward.
When the user explicitly asks for multiple options, give exactly 2-3 compact options.
Requests for sauces, dips, spreads, snack pairings, or appetizer ideas are cooking requests and should be answered directly.
Format each option on its own line as:
OPTION 1: ...
OPTION 2: ...
OPTION 3: ...
After that, add one short line that names the strongest option.
`,
        },
        {
            role: "system",
            content: `
${contextText}

User Taste Profile:
${userTasteSummary?.trim() || "No user taste profile available."}

Flavor Suggestions From Chef Engine:
${flavorAdvice.length > 0 ? flavorAdvice.join("\n") : "None"}

${flavorGraphContext}

${substitutionContext}

${cookingContext}
`,
        },
        // Home hub gets general meal-discovery examples; recipe-bound chat gets
        // recipe-modification examples that stay anchored to the current dish.
        ...(recipeContext ? chefChatExamples_1.RECIPE_CHAT_EXAMPLES : chefChatExamples_1.CHEF_CHAT_REGRESSION_EXAMPLES),
        ...conversationHistory,
        {
            role: "user",
            content: userMessage,
        },
    ];
}

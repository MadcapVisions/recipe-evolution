import { callAIForJson } from "./jsonResponse";
import { CHEF_SYSTEM_PROMPT } from "./chefSystemPrompt";
import { validateRecipe } from "./schema/recipeValidator";
import { hashAiCacheInput, readAiCache, writeAiCache } from "./cache";
import { createAiRecipeResult, parseAiRecipeResult, type AiRecipeResult } from "./recipeResult";
import { compileCookingBrief } from "./briefCompiler";
import { validateRequiredNamedIngredientsInRecipe } from "./requiredNamedIngredientValidation";
import { adjudicateRecipeFailure, buildCiaConstraintProvenance } from "./failureAdjudicator";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAiIngredients } from "../recipes/recipeDraft";
import { resolveAiTaskSettings } from "./taskSettings";
import { normalizeRecipeEditInstruction } from "./recipeOrchestrator";
import type { CookingBrief } from "./contracts/cookingBrief";
import { storeCiaAdjudication } from "./ciaStore";

export class ImproveRecipeGenerationError extends Error {
  debugPayload: unknown;

  constructor(message: string, debugPayload: unknown = null) {
    super(message);
    this.name = "ImproveRecipeGenerationError";
    this.debugPayload = debugPayload;
  }
}

type ImproveRecipeInput = {
  instruction: string;
  userTasteSummary?: string;
  sessionBrief?: CookingBrief | null;
  recipe: {
    title: string;
    servings: number | null;
    prep_time_min: number | null;
    cook_time_min: number | null;
    difficulty: string | null;
    ingredients: Array<{ name: string }>;
    steps: Array<{ text: string }>;
  };
};

type ImproveRecipeCacheContext = {
  supabase: SupabaseClient;
  userId: string;
  conversationKey?: string | null;
  recipeId?: string | null;
  versionId?: string | null;
};

function normalizeIngredientKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleWords(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildPersistentConstraintBlock(brief: CookingBrief | null | undefined) {
  if (!brief) {
    return "";
  }

  const lines: string[] = [];
  const hardRequiredIngredients = (brief.ingredients.requiredNamedIngredients ?? [])
    .filter((ingredient) => ingredient.requiredStrength === "hard")
    .map((ingredient) => ingredient.normalizedName);

  if (hardRequiredIngredients.length > 0) {
    lines.push(`Persistent must-use ingredients: ${hardRequiredIngredients.join(", ")}`);
  }
  if (brief.ingredients.forbidden.length > 0) {
    lines.push(`Persistent forbidden ingredients: ${brief.ingredients.forbidden.join(", ")}`);
  }
  if (brief.constraints.equipment_limits.length > 0) {
    lines.push(`Persistent equipment or tool constraints: ${brief.constraints.equipment_limits.join(", ")}`);
  }
  if (brief.directives.required_techniques.length > 0) {
    lines.push(`Persistent required cooking methods: ${brief.directives.required_techniques.join(", ")}`);
  }
  if (brief.directives.must_have.length > 0) {
    lines.push(`Persistent must-have details: ${brief.directives.must_have.join(", ")}`);
  }
  if (brief.directives.must_not_have.length > 0) {
    lines.push(`Persistent must-not-have details: ${brief.directives.must_not_have.join(", ")}`);
  }

  return lines.length > 0 ? `Recipe session constraints:\n${lines.map((line) => `- ${line}`).join("\n")}\n\n` : "";
}

function buildImproveUserMessage(input: ImproveRecipeInput, hardRequiredIngredients: ReturnType<typeof extractHardRequiredIngredients>, attempt: number): string {
  const normalizedInstruction = normalizeRecipeEditInstruction(input.instruction);
  const conversationalHint =
    normalizedInstruction !== input.instruction.trim()
      ? `Original user instruction: ${input.instruction}
Interpreted edit request: ${normalizedInstruction}`
      : `Instruction:
${input.instruction}`;

  const retryHint =
    attempt > 0
      ? `

The previous answer was invalid. Return a complete rewritten recipe JSON only.
Do not answer conversationally. Do not explain whether the change is possible.`
      : "";

  return `${conversationalHint}

${buildPersistentConstraintBlock(input.sessionBrief)}
${hardRequiredIngredients.length > 0
  ? `Mandatory user-requested ingredients that must appear in the edited recipe and be used in the steps:
${hardRequiredIngredients.map((ingredient) => `- ${ingredient.normalizedName}`).join("\n")}

Do not substitute a related ingredient. If the user asked for "sourdough discard", "sourdough bread" does not satisfy the request.`
  : ""}

Current recipe:
${JSON.stringify(input.recipe, null, 2)}${retryHint}`;
}

function normalizeSteps(value: unknown): Array<{ text: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const text = (item as Record<string, unknown>).text;
      if (typeof text !== "string" || !text.trim()) {
        return null;
      }
      return { text: text.trim() };
    })
    .filter((item): item is { text: string } => item !== null);
}

// Stopwords excluded from keyword extraction when verifying instruction was applied.
const VERIFY_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "this", "that", "it", "can", "you", "i", "we", "my", "me", "please",
  "some", "add", "make", "use", "swap", "want", "would", "like", "could",
  "recipe", "dish", "version", "into", "from", "more", "less", "also", "just",
]);

/**
 * Checks that key content words from the instruction appear somewhere in the
 * improved recipe's ingredients or steps. Returns false only when clear evidence
 * shows the instruction was ignored — used to trigger a single retry.
 */
function verifyInstructionApplied(instruction: string, result: AiRecipeResult): boolean {
  const resultText = [
    ...result.recipe.ingredients.map((i) => i.name.toLowerCase()),
    ...result.recipe.steps.map((s) => s.text.toLowerCase()),
  ].join(" ");

  const keyWords = instruction
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !VERIFY_STOPWORDS.has(w));

  if (keyWords.length === 0) return true;

  const matches = keyWords.filter((w) => resultText.includes(w));
  // Require at least 40% of key words to appear in the result.
  return matches.length >= Math.ceil(keyWords.length * 0.4);
}

function extractHardRequiredIngredients(input: ImproveRecipeInput) {
  const instructionBrief = compileCookingBrief({
    userMessage: input.instruction,
    conversationHistory: [],
    recipeContext: {
      title: input.recipe.title,
      ingredients: input.recipe.ingredients.map((item) => item.name),
      steps: input.recipe.steps.map((item) => item.text),
    },
  });

  const merged = [
    ...((input.sessionBrief?.ingredients.requiredNamedIngredients ?? []).filter(
      (ingredient) => ingredient.requiredStrength === "hard"
    )),
    ...((instructionBrief.ingredients.requiredNamedIngredients ?? []).filter(
      (ingredient) => ingredient.requiredStrength === "hard"
    )),
  ];

  return Array.from(
    new Map(merged.map((ingredient) => [ingredient.normalizedName.toLowerCase(), ingredient])).values()
  );
}

function buildIngredientAdditionFallback(
  input: ImproveRecipeInput,
  hardRequiredIngredients: ReturnType<typeof extractHardRequiredIngredients>
): AiRecipeResult | null {
  const ingredientToAdd = hardRequiredIngredients[0]?.normalizedName?.trim();
  if (!ingredientToAdd) {
    return null;
  }

  const normalizedRequested = normalizeIngredientKey(ingredientToAdd);
  if (!normalizedRequested) {
    return null;
  }

  const alreadyPresent = input.recipe.ingredients.some((item) => normalizeIngredientKey(item.name).includes(normalizedRequested));
  const hasMatchingStep = input.recipe.steps.some((item) => normalizeIngredientKey(item.text).includes(normalizedRequested));
  const recipeText = [input.recipe.title, ...input.recipe.steps.map((item) => item.text)].join(" ").toLowerCase();
  const defaultStep = /\b(brownie|cake|cookie|muffin|loaf|bake|oven|batter)\b/.test(recipeText)
    ? `Fold in 1 cup ${ingredientToAdd} just before transferring the batter to the pan.`
    : `Stir in 1 cup ${ingredientToAdd} during the final cooking steps so the addition stays noticeable.`;
  const versionWords = toTitleWords(ingredientToAdd).split(/\s+/).slice(0, 3).join(" ");

  return createAiRecipeResult({
    purpose: "refine",
    source: "fallback",
    provider: null,
    model: null,
    cached: false,
    inputHash: null,
    createdAt: new Date().toISOString(),
    explanation: `Built with the deterministic fallback recipe editor to add ${ingredientToAdd}.`,
    version_label: versionWords ? `With ${versionWords}` : "Updated Version",
    recipe: {
      title: input.recipe.title,
      description: null,
      tags: null,
      servings: input.recipe.servings,
      prep_time_min: input.recipe.prep_time_min,
      cook_time_min: input.recipe.cook_time_min,
      difficulty: input.recipe.difficulty,
      ingredients: alreadyPresent ? input.recipe.ingredients : [...input.recipe.ingredients, { name: `1 cup ${ingredientToAdd}` }],
      steps: hasMatchingStep ? input.recipe.steps : [...input.recipe.steps, { text: defaultStep }],
    },
  });
}

function createCandidateFromParsed(params: {
  parsed: Record<string, unknown>;
  provider: string | null | undefined;
  model: string | null | undefined;
  input: ImproveRecipeInput;
  inputHash: string | null;
}): AiRecipeResult | null {
  const ingredients = normalizeAiIngredients(params.parsed.ingredients);
  const steps = normalizeSteps(params.parsed.steps);
  const title =
    typeof params.parsed.title === "string" && params.parsed.title.trim()
      ? params.parsed.title.trim()
      : params.input.recipe.title;
  const normalizedForValidation = {
    title,
    ingredients: ingredients.map((item) => item.name),
    steps: steps.map((item) => item.text),
    chefTips: Array.isArray(params.parsed.chefTips)
      ? params.parsed.chefTips
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim())
      : [],
  };

  if (!validateRecipe(normalizedForValidation) || ingredients.length === 0 || steps.length === 0) {
    return null;
  }

  const explanation =
    typeof params.parsed.explanation === "string" && params.parsed.explanation.trim().length > 0
      ? params.parsed.explanation.trim()
      : null;
  const version_label =
    typeof params.parsed.version_label === "string" && params.parsed.version_label.trim().length > 0
      ? params.parsed.version_label.trim()
      : null;

  try {
    return createAiRecipeResult({
      purpose: "refine",
      source: "ai",
      provider: params.provider,
      model: params.model ?? params.provider,
      cached: false,
      inputHash: params.inputHash,
      createdAt: new Date().toISOString(),
      explanation,
      version_label,
      recipe: {
        title,
        description: null,
        tags: null,
        servings:
          typeof params.parsed.servings === "number" ? params.parsed.servings : params.input.recipe.servings,
        prep_time_min:
          typeof params.parsed.prep_time_min === "number"
            ? params.parsed.prep_time_min
            : params.input.recipe.prep_time_min,
        cook_time_min:
          typeof params.parsed.cook_time_min === "number"
            ? params.parsed.cook_time_min
            : params.input.recipe.cook_time_min,
        difficulty: (() => {
          const raw = typeof params.parsed.difficulty === "string" ? params.parsed.difficulty.trim() : "";
          if (!raw) return params.input.recipe.difficulty;
          return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
        })(),
        ingredients,
        steps,
      },
    });
  } catch {
    return null;
  }
}

export async function improveRecipe(
  input: ImproveRecipeInput,
  cacheContext?: ImproveRecipeCacheContext
): Promise<AiRecipeResult> {
  let hardRequiredIngredients = extractHardRequiredIngredients(input);
  const inputHash = cacheContext
    ? hashAiCacheInput({
        instruction: input.instruction,
        userTasteSummary: input.userTasteSummary?.trim() || null,
        recipe: input.recipe,
      })
    : null;

  if (cacheContext && inputHash) {
    const cached = await readAiCache<unknown>(cacheContext.supabase, cacheContext.userId, "refine", inputHash);
    if (cached) {
      const parsedCached = parseAiRecipeResult(cached.response_json);
      if (parsedCached) {
        return parsedCached;
      }
    }
  }

  const messages = [
    {
      role: "system" as const,
      content: `${CHEF_SYSTEM_PROMPT}

User taste summary: ${input.userTasteSummary?.trim() || "No user taste summary available."}

When asked to improve a recipe, you must return ONLY valid JSON with no markdown:
{
  "title": string,
  "version_label": string,
  "explanation": string,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string, "quantity": number, "unit": string|null, "prep": string|null }],
  "steps": [{ "text": string }]
}

Rules:
- version_label: 2-4 words describing what changed, suitable for a version badge. Examples: "With Potatoes", "Dairy-Free", "Spicier Version", "Faster Cook", "Added Lemon". Use title case. Do not include the word "recipe".
- Always make changes that directly and visibly address the instruction. Vague rewrites are not acceptable.
- For "spicier" or "more heat": increase or add chili, cayenne, jalapeño, gochujang, or hot sauce — make at least 2 ingredient-level changes.
- For "simpler" or "fewer ingredients": reduce the ingredient count by at least 2-3 items and combine or cut steps.
- For "faster" or "quicker": lower cook_time_min meaningfully, prefer high-heat techniques over braises, and cut prep steps.
- For "healthier" or "lighter": reduce butter, oil, cream, and cheese; add vegetables or lean protein; lower calorie density.
- For "richer" or "creamier": add cream, butter, or cheese; deepen the sauce base; use fond or stock reduction.
- For "more flavor" or "bolder": amplify aromatics (garlic, onion, shallot), add acid (lemon, vinegar), or add umami (parmesan, soy, miso, fish sauce).
- For "vegetarian" or "vegan": swap meat proteins for legumes, tofu, or tempeh; ensure the swap preserves texture and flavor weight.
- Preserve the core dish identity and format unless the instruction explicitly says to change it.
- Every ingredient must include an explicit quantity. Good: 2 onions, 1.5 lb chicken, 2 tbsp olive oil. Bad: onion, chicken, olive oil.
- Keep steps practical and home-cook friendly.
- Each step must contain an actionable cooking verb and enough detail to be unambiguous — include timing, temperature, or doneness cues where relevant. Never write vague steps like "Cook until done" or "Add ingredients."
- Produce a complete recipe, not notes. Every step should be executable without guessing.
- Do not include any text outside the JSON object.`,
    },
  ];

  const [taskSetting, ciaTaskSetting] = await Promise.all([
    resolveAiTaskSettings("recipe_improvement"),
    resolveAiTaskSettings("recipe_cia"),
  ]);
  if (!taskSetting.enabled) {
    throw new Error("Recipe improvement AI task is disabled.");
  }
  const aiOptions = {
    max_tokens: taskSetting.maxTokens,
    temperature: taskSetting.temperature,
    model: taskSetting.primaryModel,
    fallback_models: taskSetting.fallbackModel ? [taskSetting.fallbackModel] : [],
  };

  // Attempt the generation up to 2 times: once normally, once if validation
  // fails or the instruction keywords don't appear in the result.
  let improved: AiRecipeResult | null = null;
  let lastError = "";
  let lastCandidate: AiRecipeResult | null = null;
  let lastDebugPayload: unknown = null;
  let lastMissingRequiredIngredientIssues: Array<{ message: string }> = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptMessages = [
      messages[0]!,
      {
        role: "user" as const,
        content: buildImproveUserMessage(input, hardRequiredIngredients, attempt),
      },
    ];
    const result = await callAIForJson(attemptMessages, aiOptions);
    lastDebugPayload = {
      provider: result.provider,
      model: result.model ?? null,
      finishReason: result.finishReason ?? null,
      text: result.text,
      parsed: result.parsed,
      usage: result.usage,
      attempt,
    };
    const { parsed } = result;
    if (!parsed || typeof parsed !== "object") {
      lastError = "AI returned invalid recipe payload.";
      continue;
    }

    const candidate = createCandidateFromParsed({
      parsed: parsed as Record<string, unknown>,
      provider: result.provider,
      model: result.model,
      input,
      inputHash,
    });
    if (!candidate) {
      lastError = "AI returned an invalid structured recipe format.";
      continue;
    }
    lastCandidate = candidate;

    const missingRequiredIngredientIssues = validateRequiredNamedIngredientsInRecipe({
      ingredients: candidate.recipe.ingredients.map((item) => ({ ingredientName: item.name })),
      steps: candidate.recipe.steps,
      requiredNamedIngredients: hardRequiredIngredients,
    });

    if (missingRequiredIngredientIssues.length > 0) {
      lastMissingRequiredIngredientIssues = missingRequiredIngredientIssues;
      lastError = missingRequiredIngredientIssues.map((issue) => issue.message).join(" ");
      continue;
    }

    // Verify the instruction's key changes actually appear in the result.
    // If not on the first attempt, retry once; accept the second attempt regardless.
    if (attempt === 0 && !verifyInstructionApplied(input.instruction, candidate)) {
      lastError = "Instruction not reflected in result";
      continue;
    }

    improved = candidate;
    break;
  }

  if (
    !improved &&
    /invalid structured recipe format|invalid recipe payload/i.test(lastError)
  ) {
    const deterministicFallback = buildIngredientAdditionFallback(input, hardRequiredIngredients);
    if (deterministicFallback) {
      improved = deterministicFallback;
    }
  }

  if (!improved && hardRequiredIngredients.length > 0) {
    const repairBase =
      lastCandidate ??
      createAiRecipeResult({
        purpose: "refine",
        source: "ai",
        provider: null,
        model: null,
        cached: false,
        inputHash,
        createdAt: new Date().toISOString(),
        explanation: null,
        version_label: null,
        recipe: {
          title: input.recipe.title,
          description: null,
          tags: null,
          servings: input.recipe.servings,
          prep_time_min: input.recipe.prep_time_min,
          cook_time_min: input.recipe.cook_time_min,
          difficulty: input.recipe.difficulty,
          ingredients: input.recipe.ingredients,
          steps: input.recipe.steps,
        },
      });

    const repairMessages = [
      messages[0]!,
      {
        role: "assistant" as const,
        content: JSON.stringify(repairBase.recipe, null, 2),
      },
      {
        role: "user" as const,
        content: `Repair this recipe so it fully satisfies the user's explicit ingredient request.

Required ingredients that must appear exactly and be used in the steps:
${hardRequiredIngredients.map((ingredient) => `- ${ingredient.normalizedName}`).join("\n")}

Rules:
- Add each required ingredient to the ingredient list with a realistic quantity.
- Explicitly mention and use each required ingredient in at least one cooking step.
- Do not substitute a related ingredient. "Sourdough bread" does not satisfy "sourdough discard".
- Keep the same dish identity and return the same JSON schema only.`,
      },
    ];

    const repairResult = await callAIForJson(repairMessages, aiOptions);
    lastDebugPayload = {
      provider: repairResult.provider,
      model: repairResult.model ?? null,
      finishReason: repairResult.finishReason ?? null,
      text: repairResult.text,
      parsed: repairResult.parsed,
      usage: repairResult.usage,
      attempt: "repair",
    };
    const repairedParsed = repairResult.parsed;
    if (repairedParsed && typeof repairedParsed === "object") {
      const repairedCandidate = createCandidateFromParsed({
        parsed: repairedParsed as Record<string, unknown>,
        provider: repairResult.provider,
        model: repairResult.model,
        input,
        inputHash,
      });
      if (repairedCandidate) {
        lastCandidate = repairedCandidate;
        const repairIssues = validateRequiredNamedIngredientsInRecipe({
          ingredients: repairedCandidate.recipe.ingredients.map((item) => ({ ingredientName: item.name })),
          steps: repairedCandidate.recipe.steps,
          requiredNamedIngredients: hardRequiredIngredients,
        });
        if (repairIssues.length > 0) {
          lastMissingRequiredIngredientIssues = repairIssues;
        }
        const finalRepairIssues = validateRequiredNamedIngredientsInRecipe({
          ingredients: repairedCandidate.recipe.ingredients.map((item) => ({ ingredientName: item.name })),
          steps: repairedCandidate.recipe.steps,
          requiredNamedIngredients: hardRequiredIngredients,
        });
        if (finalRepairIssues.length === 0 && verifyInstructionApplied(input.instruction, repairedCandidate)) {
          improved = repairedCandidate;
        } else if (finalRepairIssues.length > 0) {
          lastError = finalRepairIssues.map((issue) => issue.message).join(" ");
        }
      }
    }
  }

  if (!improved && lastMissingRequiredIngredientIssues.length > 0) {
    const ciaPacket = {
      flow: "recipe_improve",
      instruction: input.instruction,
      cookingBrief: input.sessionBrief ?? null,
      constraintProvenance: buildCiaConstraintProvenance({
        flow: "recipe_improve",
        failureKind: "verification_failed",
        instruction: input.instruction,
        cookingBrief: input.sessionBrief ?? null,
        recipeCandidate: lastCandidate?.recipe ?? null,
        reasons: lastMissingRequiredIngredientIssues.map((issue) => issue.message),
        rawModelOutput: lastDebugPayload,
      }),
      recipeCandidate: lastCandidate?.recipe ?? null,
      reasons: lastMissingRequiredIngredientIssues.map((issue) => issue.message),
      rawModelOutput: lastDebugPayload,
    };
    const adjudication = await adjudicateRecipeFailure({
      flow: "recipe_improve",
      taskSetting: ciaTaskSetting,
      failureKind: "verification_failed",
      instruction: input.instruction,
      cookingBrief: input.sessionBrief ?? null,
      recipeCandidate: lastCandidate?.recipe ?? null,
      reasons: lastMissingRequiredIngredientIssues.map((issue) => issue.message),
      rawModelOutput: lastDebugPayload,
    });
    if (cacheContext) {
      await storeCiaAdjudication(cacheContext.supabase, {
        ownerId: cacheContext.userId,
        conversationKey: cacheContext.conversationKey ?? null,
        scope: "recipe_detail",
        recipeId: cacheContext.recipeId ?? null,
        versionId: cacheContext.versionId ?? null,
        flow: "recipe_improve",
        taskKey: "recipe_cia",
        parentTaskKey: "recipe_improvement",
        failureKind: "verification_failed",
        failureStage: "verification",
        model: ciaTaskSetting.primaryModel,
        provider: null,
        packet: ciaPacket,
        adjudication,
      });
    }

    if (adjudication.decision === "sanitize_constraints" && adjudication.dropRequiredNamedIngredients.length > 0) {
      hardRequiredIngredients = hardRequiredIngredients.filter(
        (ingredient) => !adjudication.dropRequiredNamedIngredients.includes(ingredient.normalizedName.toLowerCase())
      );

      const salvageCandidate = lastCandidate;
      if (salvageCandidate) {
        const salvageIssues = validateRequiredNamedIngredientsInRecipe({
          ingredients: salvageCandidate.recipe.ingredients.map((item) => ({ ingredientName: item.name })),
          steps: salvageCandidate.recipe.steps,
          requiredNamedIngredients: hardRequiredIngredients,
        });
        if (salvageIssues.length === 0) {
          improved = salvageCandidate;
        } else if (salvageIssues.length > 0) {
          lastError = salvageIssues.map((issue) => issue.message).join(" ");
        }
      }
    }
  }

  if (!improved) {
    throw new ImproveRecipeGenerationError(lastError || "Recipe improvement failed after retry.", lastDebugPayload);
  }

  if (cacheContext && inputHash) {
    await writeAiCache(
      cacheContext.supabase,
      cacheContext.userId,
      "refine",
      inputHash,
      improved.meta.model ?? improved.meta.provider ?? "unknown",
      improved
    );
  }

  return improved;
}

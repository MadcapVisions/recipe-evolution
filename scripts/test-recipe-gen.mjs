/**
 * Live seed-case recipe generation eval.
 *
 * Runs the real structured pipeline:
 * brief -> plan -> generate -> verify
 *
 * Usage:
 *   node scripts/test-recipe-gen.mjs
 *   node scripts/test-recipe-gen.mjs focaccia-pizza traditional-carbonara
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
try {
  const envLines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of envLines) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) {
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // allow shell env to provide vars
}

async function loadEvalModule(path) {
  const compiledPath = resolve(process.cwd(), ".tmp-eval", path);
  try {
    return await import(compiledPath);
  } catch (error) {
    console.error("Missing eval build artifacts. Run `npm run eval:seed:live` so the compile step runs first.");
    throw error;
  }
}

const { SEED_RECIPE_EVAL_CASES } = await loadEvalModule("lib/ai/evals/seedRecipeEvals.js");
const { compileCookingBrief } = await loadEvalModule("lib/ai/briefCompiler.js");
const { buildRecipePlanFromBrief } = await loadEvalModule("lib/ai/recipePlanner.js");
const { verifyRecipeAgainstBrief } = await loadEvalModule("lib/ai/recipeVerifier.js");
const { shouldAutoRetryRecipeBuild, buildRetryRecipePlan, buildRetryInstructions } = await loadEvalModule("lib/ai/homeRecipeRetry.js");

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_DEFAULT_MODEL?.trim() || "openai/gpt-4o-mini";

if (!API_KEY) {
  console.error("Missing OPENROUTER_API_KEY.");
  process.exit(1);
}

function toConversationHistory(conversation) {
  return conversation
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^chef:/i.test(line)) {
        return { role: "assistant", content: line.replace(/^chef:\s*/i, "").trim() };
      }
      return { role: "user", content: line.replace(/^user:\s*/i, "").trim() };
    });
}

function parseJsonResponse(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    return null;
  }

  const direct = text.trim();
  try {
    return JSON.parse(direct);
  } catch {}

  const withoutFences = direct.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(withoutFences);
  } catch {}

  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(withoutFences.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}

function normalizeRecipe(value, fallbackTitle) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value;
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients
        .map((item) => {
          if (item && typeof item === "object" && typeof item.name === "string") {
            return { name: item.name.trim() };
          }
          if (typeof item === "string") {
            return { name: item.trim() };
          }
          return null;
        })
        .filter((item) => item && item.name.length > 0)
    : [];
  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((item) => {
          if (item && typeof item === "object" && typeof item.text === "string") {
            return { text: item.text.trim() };
          }
          if (typeof item === "string") {
            return { text: item.trim() };
          }
          return null;
        })
        .filter((item) => item && item.text.length > 0)
    : [];

  if (ingredients.length === 0 || steps.length === 0) {
    return null;
  }

  return {
    title: typeof raw.title === "string" && raw.title.trim().length > 0 ? raw.title.trim() : fallbackTitle,
    description: typeof raw.description === "string" ? raw.description.trim() || null : null,
    servings: typeof raw.servings === "number" ? raw.servings : null,
    prep_time_min: typeof raw.prep_time_min === "number" ? raw.prep_time_min : null,
    cook_time_min: typeof raw.cook_time_min === "number" ? raw.cook_time_min : null,
    difficulty: typeof raw.difficulty === "string" ? raw.difficulty.trim() || null : null,
    ingredients,
    steps,
    chefTips: Array.isArray(raw.chefTips) ? raw.chefTips.filter((item) => typeof item === "string") : [],
  };
}

async function generateRecipeFromSeed({ ideaTitle, prompt, conversationHistory, brief, recipePlan, retryContext, onStatus }) {
  onStatus(retryContext ? "Tightening the recipe constraints..." : "Writing the recipe...");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1600,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are a professional recipe developer.
Priority order:
1. Chef conversation and the user's most recent confirmed direction
2. User taste summary
User taste summary: No user taste summary available.
Structured cooking brief: ${JSON.stringify(brief)}
Structured recipe plan: ${JSON.stringify(recipePlan)}
Return ONLY valid JSON:
{
  "title": string,
  "description": string|null,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string, "quantity": number, "unit": string|null, "prep": string|null }],
  "steps": [{ "text": string }],
  "chefTips": string[]
}
Rules:
- The recipe must follow the chef conversation closely.
- If the user narrowed to one exact dish, make that dish. Do not drift to adjacent ideas.
- Preserve the locked dish format, centerpiece, and required constraints.
- The title must be a clean, dish-specific recipe name a home cook would understand.
- Every ingredient must include an explicit quantity.
- Keep steps practical and home-cook friendly.
- Produce a complete recipe, not notes.`,
        },
        {
          role: "user",
          content: `Generate a full recipe for this selected idea:
Idea: ${ideaTitle}
Prompt context: ${prompt}
Structured cooking brief:
${JSON.stringify(brief, null, 2)}
Structured recipe plan:
${JSON.stringify(recipePlan, null, 2)}
Retry instructions:
${
  retryContext
    ? buildRetryInstructions({
        retryStrategy: retryContext.retryStrategy,
        reasons: retryContext.reasons,
        attemptNumber: retryContext.attemptNumber,
      }).join("\n")
    : "No retry instructions."
}
Conversation context:
${conversationHistory.map((message) => `${message.role === "user" ? "User" : "Chef"}: ${message.content}`).join("\n")}`,
        },
      ],
    }),
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonResponse(text);
  const recipe = normalizeRecipe(parsed, ideaTitle);

  if (!recipe) {
    const error = new Error(`AI returned invalid recipe payload for ${ideaTitle}.`);
    error.rawText = text;
    throw error;
  }

  onStatus("Checking that it matches...");
  return {
    recipe,
    usage: {
      input_tokens: typeof data.usage?.prompt_tokens === "number" ? data.usage.prompt_tokens : null,
      output_tokens: typeof data.usage?.completion_tokens === "number" ? data.usage.completion_tokens : null,
      cost: data.usage?.cost ?? null,
    },
  };
}

async function repairMalformedRecipeFromSeed({ rawText, ideaTitle, prompt, conversationHistory, brief, recipePlan, onStatus }) {
  onStatus("Repairing malformed recipe output...");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1600,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You repair malformed AI recipe drafts.
Return ONLY valid JSON:
{
  "title": string,
  "description": string|null,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string, "quantity": number, "unit": string|null, "prep": string|null }],
  "steps": [{ "text": string }],
  "chefTips": string[]
}
Rules:
- Preserve the named dish exactly.
- Preserve the requested format and core ingredients.
- Every ingredient must include a quantity.
- Do not explain what you changed.
- Do not use markdown fences.`,
        },
        {
          role: "user",
          content: `Repair this malformed recipe draft into valid JSON.
Idea: ${ideaTitle}
Prompt context: ${prompt}
Structured cooking brief:
${JSON.stringify(brief, null, 2)}
Structured recipe plan:
${JSON.stringify(recipePlan, null, 2)}
Conversation context:
${conversationHistory.map((message) => `${message.role === "user" ? "User" : "Chef"}: ${message.content}`).join("\n")}
Malformed recipe draft:
${rawText}`,
        },
      ],
    }),
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonResponse(text);
  const recipe = normalizeRecipe(parsed, ideaTitle);

  if (!recipe) {
    throw new Error(`AI returned invalid recipe payload for ${ideaTitle}.`);
  }

  return {
    recipe,
    usage: {
      input_tokens: typeof data.usage?.prompt_tokens === "number" ? data.usage.prompt_tokens : null,
      output_tokens: typeof data.usage?.completion_tokens === "number" ? data.usage.completion_tokens : null,
      cost: data.usage?.cost ?? null,
    },
  };
}

async function runCaseWithRetry(testCase) {
  const conversationHistory = toConversationHistory(testCase.conversation);
  const brief = compileCookingBrief({
    userMessage: testCase.prompt,
    conversationHistory,
  });
  let recipePlan = buildRecipePlanFromBrief(brief);
  const statuses = [];
  const usageTotals = { input_tokens: 0, output_tokens: 0, cost: 0 };
  let hasUsage = false;
  let retryContext = null;
  let lastError = null;

  for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
    try {
      const result = await generateRecipeFromSeed({
        ideaTitle: brief.dish.normalized_name ?? testCase.label,
        prompt: testCase.prompt,
        conversationHistory,
        brief,
        recipePlan,
        retryContext,
        onStatus: (message) => statuses.push(message),
      });

      if (result.usage.input_tokens != null) {
        usageTotals.input_tokens += result.usage.input_tokens;
        hasUsage = true;
      }
      if (result.usage.output_tokens != null) {
        usageTotals.output_tokens += result.usage.output_tokens;
        hasUsage = true;
      }
      if (typeof result.usage.cost === "number") {
        usageTotals.cost += result.usage.cost;
        hasUsage = true;
      }

      const verification = verifyRecipeAgainstBrief({
        brief,
        recipe: result.recipe,
        fallbackContext: `${testCase.prompt} ${testCase.conversation}`,
      });

      if (!verification.passes && shouldAutoRetryRecipeBuild(verification.retry_strategy, attemptNumber)) {
        retryContext = {
          retryStrategy: verification.retry_strategy,
          reasons: verification.reasons,
          attemptNumber: attemptNumber + 1,
        };
        recipePlan = buildRetryRecipePlan(recipePlan, retryContext);
        continue;
      }

      return {
        brief,
        recipePlan,
        recipe: result.recipe,
        verification,
        statuses,
        usage: hasUsage ? usageTotals : { input_tokens: null, output_tokens: null, cost: null },
      };
    } catch (error) {
      if (error?.rawText) {
        try {
          const repaired = await repairMalformedRecipeFromSeed({
            rawText: error.rawText,
            ideaTitle: brief.dish.normalized_name ?? testCase.label,
            prompt: testCase.prompt,
            conversationHistory,
            brief,
            recipePlan,
            onStatus: (message) => statuses.push(message),
          });

          if (repaired.usage.input_tokens != null) {
            usageTotals.input_tokens += repaired.usage.input_tokens;
            hasUsage = true;
          }
          if (repaired.usage.output_tokens != null) {
            usageTotals.output_tokens += repaired.usage.output_tokens;
            hasUsage = true;
          }
          if (typeof repaired.usage.cost === "number") {
            usageTotals.cost += repaired.usage.cost;
            hasUsage = true;
          }

          const verification = verifyRecipeAgainstBrief({
            brief,
            recipe: repaired.recipe,
            fallbackContext: `${testCase.prompt} ${testCase.conversation}`,
          });

          if (!verification.passes && shouldAutoRetryRecipeBuild(verification.retry_strategy, attemptNumber)) {
            retryContext = {
              retryStrategy: verification.retry_strategy,
              reasons: verification.reasons,
              attemptNumber: attemptNumber + 1,
            };
            recipePlan = buildRetryRecipePlan(recipePlan, retryContext);
            continue;
          }

          return {
            brief,
            recipePlan,
            recipe: repaired.recipe,
            verification,
            statuses,
            usage: hasUsage ? usageTotals : { input_tokens: null, output_tokens: null, cost: null },
          };
        } catch (repairError) {
          lastError = repairError;
        }
      } else {
        lastError = error;
      }
      if (shouldAutoRetryRecipeBuild("regenerate_same_model", attemptNumber)) {
        retryContext = {
          retryStrategy: "regenerate_same_model",
          reasons: [error instanceof Error ? error.message : "Unknown generation failure."],
          attemptNumber: attemptNumber + 1,
        };
        recipePlan = buildRetryRecipePlan(recipePlan, retryContext);
        continue;
      }
      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown eval failure.");
}

const requestedIds = process.argv.slice(2);
const cases =
  requestedIds.length > 0
    ? SEED_RECIPE_EVAL_CASES.filter((testCase) => requestedIds.includes(testCase.id))
    : SEED_RECIPE_EVAL_CASES;

if (cases.length === 0) {
  console.error("No matching seed eval cases.");
  process.exit(1);
}

const failures = [];

for (const testCase of cases) {
  try {
    const result = await runCaseWithRetry(testCase);

    console.log(`\n${"=".repeat(72)}`);
    console.log(`${testCase.id} :: ${testCase.label}`);
    console.log(`Dish family: ${result.brief.dish.dish_family ?? "-"}`);
    console.log(`Plan family: ${result.recipePlan.dish_family}`);
    console.log(`Title: ${result.recipe.title}`);
    console.log(`Verification: ${result.verification.passes ? "PASS" : "FAIL"} (${result.verification.score.toFixed(2)})`);
    console.log(`Retry strategy: ${result.verification.retry_strategy}`);
    console.log(`Statuses: ${result.statuses.join(" -> ")}`);
    console.log(`Usage: in=${result.usage.input_tokens ?? "-"} out=${result.usage.output_tokens ?? "-"} cost=${result.usage.cost ?? "-"}`);
    if (!result.verification.passes) {
      console.log(`Reasons: ${result.verification.reasons.join(" | ")}`);
      failures.push({ id: testCase.id, reasons: result.verification.reasons });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.log(`\n${"=".repeat(72)}`);
    console.log(`${testCase.id} :: ${testCase.label}`);
    console.log(`FAILED TO GENERATE: ${message}`);
    failures.push({ id: testCase.id, reasons: [message] });
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} seed eval case(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${cases.length} seed eval cases passed.`);

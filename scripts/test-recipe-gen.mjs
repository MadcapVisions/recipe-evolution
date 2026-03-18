/**
 * Live recipe generation test — calls OpenRouter directly using the same
 * message format as generateHomeRecipe() to surface prompt/output issues.
 *
 * Usage: node scripts/test-recipe-gen.mjs
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
const envPath = resolve(process.cwd(), ".env.local");
const envLines = readFileSync(envPath, "utf-8").split("\n");
for (const line of envLines) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
}

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `You are a professional recipe developer.
Priority order:
1. Chef conversation and the user's most recent confirmed direction
2. User taste summary
User taste summary: No user taste summary available.
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
- If the chef conversation indicates a dish format like pasta, skillet, salad, soup, tacos, dip, or bowl, preserve that format exactly unless the user explicitly changed it later.
- When the conversation mentions a specific anchor ingredient or protein, keep it in the final recipe instead of swapping to a different main ingredient.
- If the user mentions a ready-made or filled ingredient (fresh pasta, stuffed pasta, dumplings, tortillas, pre-made dough, etc.), treat that item as the centerpiece. Do not discard it or replace it with its filling ingredient (e.g. chicken-filled ravioli stays as ravioli, not a chicken dish).
- The title must be a clean, dish-specific recipe name a home cook would understand.
- Every ingredient must include an explicit quantity. Good: 2 onions, 1.5 lb chicken, 2 tbsp olive oil. Bad: onion, chicken, olive oil.
- If an ingredient would normally appear without a unit, still include a count, like 1 onion or 2 eggs.
- Keep steps practical and home-cook friendly.
- Produce a complete recipe, not notes.
- chefTips: include 2–3 specific, practical tips that a home cook would find genuinely useful — technique nuances, common mistakes to avoid, or flavor-boosting tricks. Do not repeat information already in the steps.`;

async function callAI(userContent) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  try {
    const fence = text.match(/```json\s*([\s\S]*?)```/);
    return JSON.parse(fence ? fence[1] : text);
  } catch {
    return { _raw: text };
  }
}

function buildUserContent({ ideaTitle, prompt, conversation, ingredients = [] }) {
  return `Generate a full recipe for this selected idea:
Idea: ${ideaTitle}
Prompt context: ${prompt ?? ""}
Conversation context:
${conversation || "No chef conversation available."}
Ingredients context: ${JSON.stringify(ingredients)}`;
}

const VAGUE_STEP_PATTERNS = [
  /^cook until done/i,
  /^add ingredients/i,
  /^continue cooking/i,
  /^prepare the/i,
  /^mix (well|together|everything)\.?$/i,
];
const STEP_QUALITY_PATTERNS = [/\d+\s*(minute|min|hour|second|°|degree|temp)/i, /\b(until|golden|tender|done|browned|crispy|soft|set|bubbl|simmer|boil)/i];

function check(label, recipe) {
  const issues = [];
  if (!recipe.title) issues.push("MISSING title");
  if (!recipe.description) issues.push("MISSING description");
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) issues.push("MISSING ingredients");
  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) issues.push("MISSING steps");
  if (!recipe.chefTips || recipe.chefTips.length === 0) issues.push("NO chef tips");

  const missingQty = (recipe.ingredients ?? []).filter((i) => !i.quantity || i.quantity === 0);
  if (missingQty.length) issues.push(`${missingQty.length} ingredient(s) missing quantity: ${missingQty.map((i) => i.name).join(", ")}`);

  const vagueSteps = (recipe.steps ?? []).filter((s) => VAGUE_STEP_PATTERNS.some((p) => p.test(s.text)) || s.text.trim().split(/\s+/).length < 8);
  if (vagueSteps.length) issues.push(`${vagueSteps.length} vague/short step(s)`);

  const weakSteps = (recipe.steps ?? []).filter((s) => !STEP_QUALITY_PATTERNS.some((p) => p.test(s.text)));
  if (weakSteps.length > 2) issues.push(`${weakSteps.length} steps lack timing/doneness cues`);

  console.log(`\n${"═".repeat(70)}`);
  console.log(`TEST: ${label}`);
  console.log(`${"─".repeat(70)}`);
  console.log(`Title:       ${recipe.title ?? "(none)"}`);
  console.log(`Description: ${recipe.description ?? "(none)"}`);
  console.log(`Servings: ${recipe.servings ?? "?"} | Prep: ${recipe.prep_time_min ?? "?"}m | Cook: ${recipe.cook_time_min ?? "?"}m | Difficulty: ${recipe.difficulty ?? "?"}`);

  console.log(`\nINGREDIENTS (${recipe.ingredients?.length ?? 0}):`);
  for (const ing of recipe.ingredients ?? []) {
    const qty = ing.quantity ? `${ing.quantity}${ing.unit ? " " + ing.unit : ""}` : "(no qty)";
    const flag = (!ing.quantity || ing.quantity === 0) ? " ⚠️" : "";
    console.log(`  ${qty} ${ing.name}${ing.prep ? ", " + ing.prep : ""}${flag}`);
  }

  console.log(`\nSTEPS (${recipe.steps?.length ?? 0}):`);
  for (let i = 0; i < (recipe.steps ?? []).length; i++) {
    const step = recipe.steps[i];
    const hasQuality = STEP_QUALITY_PATTERNS.some((p) => p.test(step.text));
    const isVague = VAGUE_STEP_PATTERNS.some((p) => p.test(step.text)) || step.text.trim().split(/\s+/).length < 8;
    const flag = isVague ? " ⚠️ VAGUE" : (!hasQuality ? " ⚠️ no timing/doneness" : "");
    console.log(`  ${i + 1}. ${step.text}${flag}`);
  }

  if (recipe.chefTips?.length) {
    console.log(`\nCHEF TIPS:`);
    for (const tip of recipe.chefTips) {
      console.log(`  • ${tip}`);
    }
  } else {
    console.log(`\nCHEF TIPS: none`);
  }

  console.log(issues.length ? `\n⚠️  ISSUES: ${issues.join(" | ")}` : `\n✅  Passed`);
  return issues;
}

const TESTS = [
  {
    label: "Regular — quick weeknight chicken skillet",
    ideaTitle: "Lemon Herb Chicken Skillet",
    prompt: "quick weeknight dinner, chicken, something bright",
    conversation: `User: I want a quick weeknight chicken dinner, something bright and herby
Chef: A lemon herb chicken skillet is a great call — seared chicken thighs with garlic, fresh thyme, and a bright lemon pan sauce. Ready in 30 minutes.
Locked direction: Lemon Herb Chicken Skillet. Seared chicken thighs with garlic, fresh herbs, and a lemon pan sauce.`,
  },
  {
    label: "Ravioli — chicken-filled fresh ravioli with sauce direction",
    ideaTitle: "Brown Butter Sage Ravioli",
    prompt: "I have fresh ravioli filled with chicken, give me 3 recipes to go with it",
    conversation: `User: I have fresh ravioli filled with chicken, give me 3 recipes to go with it
Chef: Three strong directions for your chicken ravioli:
1. Brown butter and sage — classic, nutty, quick
2. Tomato cream — rich, comforting
3. Lemon caper — bright and light
Locked direction: Brown Butter Sage Ravioli. Chicken-filled fresh ravioli tossed in brown butter with crispy sage and parmesan.`,
    ingredients: ["fresh chicken ravioli"],
  },
  {
    label: "Obscure — mochi waffle with matcha cream",
    ideaTitle: "Matcha Cream Mochi Waffles",
    prompt: "I have mochiko rice flour and want something different for brunch",
    conversation: `User: I have mochiko rice flour and want something different for brunch
Chef: Mochi waffles are fantastic with that — chewy inside, crisp outside. Go with a matcha whipped cream to make it a full dish.
Locked direction: Matcha Cream Mochi Waffles. Chewy mochi waffles made with mochiko, served with sweetened matcha whipped cream.`,
    ingredients: ["mochiko rice flour"],
  },
  {
    label: "Obscure — dried Persian limes in a lamb stew",
    ideaTitle: "Persian Lamb and Dried Lime Stew (Ghormeh Sabzi style)",
    prompt: "I have dried Persian limes and ground lamb, want something aromatic",
    conversation: `User: I have dried Persian limes and ground lamb, want something aromatic and a bit exotic
Chef: Dried Persian limes are perfect for a Persian-inspired braised lamb — the limes give that unique sour, floral bitterness. Think ghormeh sabzi direction with turmeric, fenugreek, and dried herb base.
Locked direction: Persian Lamb and Dried Lime Stew. Braised lamb with dried Persian limes, turmeric, fenugreek, and dried herbs.`,
    ingredients: ["dried Persian limes", "ground lamb"],
  },
  {
    label: "Regular — simple pasta carbonara",
    ideaTitle: "Classic Spaghetti Carbonara",
    prompt: "pasta carbonara, traditional, no cream",
    conversation: `User: I want a classic spaghetti carbonara, no cream, traditional style
Chef: Traditional carbonara uses just eggs, pecorino romano, guanciale, and black pepper — no cream needed. The emulsified egg and cheese sauce is the magic.
Locked direction: Classic Spaghetti Carbonara. Traditional carbonara with guanciale, eggs, pecorino, and black pepper — no cream.`,
  },
  {
    label: "Obscure — fermented black bean tofu stir-fry",
    ideaTitle: "Mapo Tofu with Fermented Black Beans",
    prompt: "I have fermented black beans and silken tofu, something spicy",
    conversation: `User: I have fermented black beans and silken tofu, I want something spicy
Chef: Fermented black beans with silken tofu is the base of a great mapo tofu variant — add doubanjiang for heat, Sichuan peppercorn for numbing, and ground pork for body.
Locked direction: Mapo Tofu with Fermented Black Beans. Silken tofu in a spicy fermented black bean and doubanjiang sauce with ground pork and Sichuan peppercorn.`,
    ingredients: ["fermented black beans", "silken tofu"],
  },
  {
    label: "Edge case — vague direction, minimal context",
    ideaTitle: "Something with vegetables",
    prompt: "veggies",
    conversation: `User: veggies
Chef: How about a roasted vegetable sheet pan dinner?
Locked direction: Something with vegetables. Roasted vegetable medley.`,
  },
];

async function run() {
  console.log(`Testing recipe generation with model: ${MODEL}`);
  const allIssues = [];

  for (const test of TESTS) {
    const userContent = buildUserContent(test);
    const recipe = await callAI(userContent);
    if (recipe._raw) {
      console.log(`\n${"─".repeat(60)}`);
      console.log(`TEST: ${test.label}`);
      console.log(`❌  Failed to parse JSON. Raw: ${recipe._raw.slice(0, 200)}`);
      allIssues.push({ label: test.label, issues: ["JSON parse failure"] });
      continue;
    }
    const issues = check(test.label, recipe);
    if (issues.length) allIssues.push({ label: test.label, issues });
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\n${"═".repeat(60)}`);
  if (allIssues.length === 0) {
    console.log("✅  All tests passed — no issues found.");
  } else {
    console.log(`⚠️  ${allIssues.length} test(s) had issues:`);
    for (const { label, issues } of allIssues) {
      console.log(`  • ${label}: ${issues.join(", ")}`);
    }
  }
}

run().catch(console.error);

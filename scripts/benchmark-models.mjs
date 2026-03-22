/**
 * Model benchmark — tests each AI task with multiple models and scores
 * quality, JSON reliability, and estimates cost per call.
 *
 * Usage: node scripts/benchmark-models.mjs
 * Optional: node scripts/benchmark-models.mjs --task chef_chat
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const envLines = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n");
for (const line of envLines) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
}

const API_KEY = process.env.OPENROUTER_API_KEY;

// ─── Models to test ────────────────────────────────────────────────────────
// cost = [input $/1M tokens, output $/1M tokens] — approximate OpenRouter prices
const MODELS = [
  { id: "openai/gpt-4o-mini",          label: "GPT-4o mini",        cost: [0.15,  0.60]  },
  { id: "google/gemini-2.5-flash",     label: "Gemini 2.5 Flash",   cost: [0.15,  0.60]  },
  { id: "deepseek/deepseek-chat",      label: "DeepSeek V3",        cost: [0.27,  1.10]  },
];

const filterTask = process.argv.includes("--task") ? process.argv[process.argv.indexOf("--task") + 1] : null;

// ─── Helpers ───────────────────────────────────────────────────────────────
async function callModel(model, messages, maxTokens, temperature) {
  const start = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature, messages }),
  });
  const data = await res.json();
  const ms = Date.now() - start;
  const text = data.choices?.[0]?.message?.content ?? "";
  const usage = data.usage ?? {};
  const inputTokens = usage.prompt_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? 0;
  return { text, ms, inputTokens, outputTokens, error: data.error?.message ?? null };
}

function parseJson(text) {
  try {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    return JSON.parse(fence ? fence[1] : text);
  } catch {
    return null;
  }
}

function estimateCost(model, inputTokens, outputTokens) {
  const [inRate, outRate] = model.cost;
  return ((inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate);
}

function banner(title) {
  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(72)}`);
}

function _row(label, value, flag = "") {
  console.log(`  ${label.padEnd(20)} ${value}${flag ? "  " + flag : ""}`);
}

// ─── Task definitions ──────────────────────────────────────────────────────
const TASKS = [

  // 1. CHEF CHAT — conversational, must return mode/reply/options JSON
  {
    key: "chef_chat",
    label: "Chef Chat",
    current: { primary: "GPT-4o mini", fallback: "Claude 3.5 Sonnet" },
    maxTokens: 600,
    temperature: 0.35,
    messages: [
      { role: "system", content: `You are Chef, a cooking assistant. Return ONLY valid JSON:
{"mode":"options"|"refine","reply":string,"options":[{"id":string,"title":string,"summary":string,"tags":string[]}],"recommended_option_id":string|null}
Rules:
- mode "options" when user asks for multiple ideas/options/directions.
- In options mode return exactly 2 or 3 options with distinct flavor angles.
- In refine mode return no options and recommended_option_id must be null.
- reply MUST always be a complete non-empty chef response.
- Keep reply concise and cooking-specific.
- No markdown or text outside the JSON.` },
      { role: "user", content: "I have salmon fillets and some fresh dill. Give me 3 different directions I could take for dinner tonight." },
    ],
    score(parsed, _text) {
      const issues = [];
      if (!parsed) { issues.push("JSON parse fail"); return { score: 0, issues }; }
      if (!parsed.reply?.trim()) issues.push("empty reply");
      if (parsed.mode !== "options") issues.push(`mode="${parsed.mode}" expected "options"`);
      if (!Array.isArray(parsed.options) || parsed.options.length < 2) issues.push(`only ${parsed.options?.length ?? 0} options`);
      if (parsed.options?.length >= 2) {
        const titles = parsed.options.map(o => o.title?.toLowerCase() ?? "");
        const allDistinct = titles.every((t, i) => titles.every((u, j) => i === j || !t.split(" ").filter(w => w.length > 3).some(w => u.includes(w))));
        if (!allDistinct) issues.push("options too similar");
      }
      const missingFields = (parsed.options ?? []).filter(o => !o.title || !o.summary);
      if (missingFields.length) issues.push(`${missingFields.length} options missing title/summary`);
      return { score: Math.max(0, 10 - issues.length * 3), issues };
    },
    display(parsed) {
      if (!parsed) return;
      console.log(`  reply: "${parsed.reply?.slice(0, 100)}"`);
      (parsed.options ?? []).forEach((o, i) => console.log(`  option ${i+1}: ${o.title} — ${o.summary?.slice(0, 70)}`));
    },
  },

  // 2. HOME IDEAS — generate 2 distinct meal ideas from a mood/craving
  {
    key: "home_ideas",
    label: "Home Ideas",
    current: { primary: "GPT-4o mini", fallback: "Claude 3.5 Sonnet" },
    maxTokens: 900,
    temperature: 0.7,
    messages: [
      { role: "system", content: `You are a recipe idea generator. Return ONLY valid JSON:
{"ideas":[{"title":string,"description":string,"cook_time_min":number}]}
Rules:
- Generate exactly 2 ideas.
- Titles must name actual dishes a user would recognize on a menu.
- Each description must explain flavor profile, texture, and what makes the dish distinct.
- Never use generic words like "Build", "Chef Special", or "Idea".` },
      { role: "user", content: `User craving prompt: something cozy and warming for a cold night, maybe Asian-inspired
Generate exactly 2 recipe ideas.` },
    ],
    score(parsed) {
      const issues = [];
      if (!parsed) { issues.push("JSON parse fail"); return { score: 0, issues }; }
      const ideas = parsed.ideas ?? [];
      if (ideas.length < 2) issues.push(`only ${ideas.length} ideas`);
      ideas.forEach((idea, i) => {
        if (!idea.title?.trim()) issues.push(`idea ${i+1} missing title`);
        if (!idea.description?.trim() || idea.description.length < 30) issues.push(`idea ${i+1} weak description`);
        if (!idea.cook_time_min) issues.push(`idea ${i+1} missing cook_time_min`);
        if (/build|chef special|idea|version/i.test(idea.title ?? "")) issues.push(`idea ${i+1} generic title`);
      });
      return { score: Math.max(0, 10 - issues.length * 2), issues };
    },
    display(parsed) {
      if (!parsed) return;
      (parsed.ideas ?? []).forEach((idea, i) =>
        console.log(`  idea ${i+1}: ${idea.title} (${idea.cook_time_min}min) — ${idea.description?.slice(0, 80)}`));
    },
  },

  // 3. HOME RECIPE — full recipe generation with chefTips
  {
    key: "home_recipe",
    label: "Recipe Generation",
    current: { primary: "Claude 3.5 Sonnet", fallback: "GPT-4o mini" },
    maxTokens: 1600,
    temperature: 0.55,
    messages: [
      { role: "system", content: `You are a professional recipe developer.
Return ONLY valid JSON:
{"title":string,"description":string|null,"servings":number|null,"prep_time_min":number|null,"cook_time_min":number|null,"difficulty":string|null,"ingredients":[{"name":string,"quantity":number,"unit":string|null,"prep":string|null}],"steps":[{"text":string}],"chefTips":string[]}
Rules:
- Every ingredient must include an explicit quantity.
- Each step must have an actionable verb and timing/doneness cues where relevant.
- chefTips: include 2–3 specific, practical tips a home cook would find useful.
- Produce a complete recipe, not notes.
- No text outside the JSON.` },
      { role: "user", content: `Generate a full recipe for this selected idea:
Idea: Miso Glazed Salmon with Sesame Bok Choy
Prompt context: quick weeknight, want something with umami depth
Conversation context:
User: I want something with salmon that has real umami depth, not just lemon butter
Chef: Miso glazed salmon is perfect — white miso, mirin, and a touch of sesame creates a deep savory glaze. Pair with sesame bok choy for contrast.
Locked direction: Miso Glazed Salmon with Sesame Bok Choy. White miso and mirin glaze on salmon, served with sesame-tossed bok choy.
Ingredients context: ["salmon fillets"]` },
    ],
    score(parsed) {
      const issues = [];
      if (!parsed) { issues.push("JSON parse fail"); return { score: 0, issues }; }
      if (!parsed.title) issues.push("missing title");
      if (!parsed.description) issues.push("missing description");
      const noQty = (parsed.ingredients ?? []).filter(i => !i.quantity || i.quantity === 0);
      if (noQty.length) issues.push(`${noQty.length} ingredients without quantity`);
      if (!parsed.steps?.length) issues.push("no steps");
      if (!parsed.chefTips?.length) issues.push("no chef tips");
      // Check salmon is actually in the recipe
      const ingText = (parsed.ingredients ?? []).map(i => i.name.toLowerCase()).join(" ");
      if (!ingText.includes("salmon")) issues.push("salmon missing from ingredients!");
      const hasMiso = ingText.includes("miso");
      if (!hasMiso) issues.push("miso missing — recipe drifted from direction");
      return { score: Math.max(0, 10 - issues.length * 2), issues };
    },
    display(parsed) {
      if (!parsed) return;
      console.log(`  title: ${parsed.title}`);
      console.log(`  desc: ${parsed.description?.slice(0, 90)}`);
      console.log(`  ingredients (${parsed.ingredients?.length}): ${(parsed.ingredients ?? []).map(i => `${i.quantity}${i.unit ? " "+i.unit : ""} ${i.name}`).join(", ").slice(0, 120)}`);
      console.log(`  steps (${parsed.steps?.length}): "${parsed.steps?.[0]?.text?.slice(0, 80)}"`);
      (parsed.chefTips ?? []).forEach(t => console.log(`  tip: ${t.slice(0, 90)}`));
    },
  },

  // 4. RECIPE IMPROVEMENT — modify existing recipe per instruction
  {
    key: "recipe_improvement",
    label: "Recipe Improvement",
    current: { primary: "Claude 3.5 Sonnet", fallback: "GPT-4o mini" },
    maxTokens: 700,
    temperature: 0.5,
    messages: [
      { role: "system", content: `You are a professional chef. When asked to improve a recipe, return ONLY valid JSON:
{"title":string,"explanation":string,"servings":number|null,"prep_time_min":number|null,"cook_time_min":number|null,"difficulty":string|null,"ingredients":[{"name":string,"quantity":number,"unit":string|null,"prep":string|null}],"steps":[{"text":string}]}
Rules:
- Always make changes that directly and visibly address the instruction.
- For "spicier": increase/add chili, cayenne, jalapeño — at least 2 ingredient-level changes.
- For "faster": lower cook_time_min meaningfully, prefer high-heat techniques.
- Every ingredient must include an explicit quantity.
- Keep steps practical with timing and doneness cues.
- No text outside the JSON.` },
      { role: "user", content: `Instruction: Make it spicier and add a bit more heat

Current recipe:
${JSON.stringify({
  title: "Classic Spaghetti Carbonara",
  servings: 4,
  prep_time_min: 10,
  cook_time_min: 20,
  difficulty: "Medium",
  ingredients: [
    { name: "12 oz spaghetti" },
    { name: "4 oz guanciale, diced" },
    { name: "3 large eggs, beaten" },
    { name: "1 cup Pecorino Romano cheese, grated" },
    { name: "1 tsp black pepper, freshly ground" },
    { name: "1 tbsp salt, for pasta water" },
  ],
  steps: [
    { text: "Bring a large pot of salted water to a boil." },
    { text: "Cook spaghetti until al dente, about 9 minutes." },
    { text: "Cook guanciale in a skillet over medium heat until crispy, 5–7 minutes." },
    { text: "Whisk eggs, cheese, and black pepper together." },
    { text: "Drain pasta, reserve 1 cup pasta water." },
    { text: "Toss hot pasta with guanciale, remove from heat, add egg mixture, toss vigorously." },
  ],
}, null, 2)}` },
    ],
    score(parsed) {
      const issues = [];
      if (!parsed) { issues.push("JSON parse fail"); return { score: 0, issues }; }
      if (!parsed.explanation?.trim()) issues.push("missing explanation");
      const ingText = (parsed.ingredients ?? []).map(i => (typeof i.name === "string" ? i.name : JSON.stringify(i)).toLowerCase()).join(" ");
      const hasHeat = /chili|cayenne|jalapeño|jalapen|pepper flake|hot sauce|calabrian|nduja|arrabbiata|red pepper/i.test(ingText);
      if (!hasHeat) issues.push("no spice ingredient added");
      const noQty = (parsed.ingredients ?? []).filter(i => {
        if (typeof i !== "object" || !i) return false;
        const raw = i;
        // check if quantity is embedded in name (string format) or as field
        if (typeof raw.name === "string") {
          return !/^\d/.test(raw.name) && !raw.quantity;
        }
        return !raw.quantity;
      });
      if (noQty.length > 2) issues.push(`${noQty.length} ingredients potentially without quantity`);
      if (!parsed.steps?.length) issues.push("no steps");
      return { score: Math.max(0, 10 - issues.length * 2), issues };
    },
    display(parsed) {
      if (!parsed) return;
      console.log(`  title: ${parsed.title}`);
      console.log(`  explanation: ${parsed.explanation?.slice(0, 100)}`);
      const ingText = (parsed.ingredients ?? []).map(i => typeof i.name === "string" ? i.name : JSON.stringify(i)).join(", ");
      console.log(`  ingredients: ${ingText.slice(0, 140)}`);
    },
  },

  // 5. RECIPE STRUCTURE — parse raw text into structured recipe JSON
  {
    key: "recipe_structure",
    label: "Recipe Structuring",
    current: { primary: "GPT-4o mini", fallback: "Claude 3.5 Sonnet" },
    maxTokens: 1200,
    temperature: 0.2,
    messages: [
      { role: "system", content: `Convert the raw recipe text into structured JSON. Return ONLY:
{"title":string,"description":string|null,"servings":number|null,"prep_time_min":number|null,"cook_time_min":number|null,"difficulty":string|null,"ingredients":[{"name":string,"quantity":number,"unit":string|null,"prep":string|null}],"steps":[{"text":string}]}
Rules:
- Extract all ingredients with explicit quantity and unit where present.
- Split steps at natural sentence/action boundaries.
- No text outside the JSON.` },
      { role: "user", content: `Convert this recipe:

Grandma's Beef Stew

Serves 6. Takes about 30 min to prep and 2.5 hours to cook.

You'll need: 2 lbs beef chuck, cut into 1-inch cubes. 3 large carrots, sliced. 4 medium potatoes, diced. 1 big onion, chopped. 3 cloves garlic. 2 tbsp tomato paste. 1 cup red wine. 3 cups beef broth. 2 tbsp flour. 2 tbsp olive oil. Salt and pepper to taste. Fresh thyme.

Brown the beef in hot oil in batches — don't overcrowd or it'll steam instead of brown. Remove and set aside. Cook onion and garlic in same pot until soft. Add tomato paste, stir 1 min. Sprinkle flour over veg and stir. Pour in wine, scrape up any bits from the bottom. Add broth, beef back in, add carrots and potatoes. Bring to boil then simmer covered for 2 hours until beef is tender. Season with salt, pepper, and thyme before serving.` },
    ],
    score(parsed) {
      const issues = [];
      if (!parsed) { issues.push("JSON parse fail"); return { score: 0, issues }; }
      if (!parsed.title) issues.push("missing title");
      if (parsed.servings !== 6) issues.push(`servings=${parsed.servings} expected 6`);
      if (parsed.prep_time_min !== 30) issues.push(`prep_time=${parsed.prep_time_min} expected 30`);
      if (parsed.cook_time_min !== 150) issues.push(`cook_time=${parsed.cook_time_min} expected 150`);
      const ingCount = parsed.ingredients?.length ?? 0;
      if (ingCount < 10) issues.push(`only ${ingCount} ingredients parsed (expected ~12)`);
      const beefIng = (parsed.ingredients ?? []).find(i => /beef/i.test(typeof i.name === "string" ? i.name : ""));
      if (!beefIng) issues.push("beef not in ingredients");
      const wineIng = (parsed.ingredients ?? []).find(i => /wine/i.test(typeof i.name === "string" ? i.name : ""));
      if (!wineIng) issues.push("red wine not extracted");
      if (!parsed.steps?.length) issues.push("no steps");
      const hasQuantities = (parsed.ingredients ?? []).filter(i => i.quantity > 0).length;
      if (hasQuantities < 6) issues.push(`only ${hasQuantities} ingredients have quantity`);
      return { score: Math.max(0, 10 - issues.length * 1.5), issues };
    },
    display(parsed) {
      if (!parsed) return;
      console.log(`  title: ${parsed.title} | servings:${parsed.servings} prep:${parsed.prep_time_min}m cook:${parsed.cook_time_min}m`);
      console.log(`  ingredients (${parsed.ingredients?.length}): ${(parsed.ingredients ?? []).map(i => `${i.quantity ?? "?"}${i.unit ? " "+i.unit : ""} ${i.name}`).join(", ").slice(0, 150)}`);
      console.log(`  steps (${parsed.steps?.length})`);
    },
  },
];

// ─── Run benchmark ─────────────────────────────────────────────────────────
async function run() {
  const tasks = filterTask ? TASKS.filter(t => t.key === filterTask) : TASKS;

  for (const task of tasks) {
    banner(`${task.label}  [current: primary=${task.current.primary}, fallback=${task.current.fallback}]`);

    const results = [];

    for (const model of MODELS) {
      process.stdout.write(`  Testing ${model.label.padEnd(22)}... `);
      const { text, ms, inputTokens, outputTokens, error } = await callModel(
        model.id, task.messages, task.maxTokens, task.temperature
      );

      if (error) {
        console.log(`ERROR: ${error}`);
        results.push({ model, score: 0, issues: [error], ms, cost: 0, parsed: null, text });
        continue;
      }

      const parsed = parseJson(text);
      const { score, issues } = task.score(parsed, text);
      const cost = estimateCost(model, inputTokens, outputTokens);
      results.push({ model, score, issues, ms, cost, parsed, text, inputTokens, outputTokens });
      console.log(`score=${score}/10  ${ms}ms  $${cost.toFixed(5)}  ${issues.length ? "⚠️  " + issues.join(", ") : "✅"}`);

      await new Promise(r => setTimeout(r, 600));
    }

    // Show output from the best-scoring model
    const best = results.sort((a, b) => b.score - a.score)[0];
    console.log(`\n  ── Best output (${best.model.label}) ──`);
    task.display(best.parsed);

    // Recommendation
    console.log(`\n  ── Cost comparison (per 1000 calls) ──`);
    for (const r of results.sort((a, b) => a.cost - b.cost)) {
      const perK = (r.cost * 1000).toFixed(3);
      const qualityFlag = r.score >= 9 ? "✅" : r.score >= 7 ? "⚠️ " : "❌";
      console.log(`  ${qualityFlag} ${r.model.label.padEnd(22)} $${perK}/1k calls  score=${r.score}/10  ${r.ms}ms`);
    }
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log("  Done. Review scores + cost table above to decide optimal model per task.");
  console.log(`${"═".repeat(72)}\n`);
}

run().catch(console.error);

/**
 * AI-powered dish family classifier.
 *
 * Resolves a dish name + optional user phrase into a canonical DishFamily key.
 * Used as a correction layer before recipe plan building so that downstream
 * culinary validation runs against the *correct* family rather than a
 * keyword-matched or AI-hallucinated one.
 *
 * Returns null when the dish genuinely doesn't fit any known family — null is
 * a valid answer that skips culinary family validation entirely.
 */

import { callAIForJson } from "./jsonResponse";
import { DISH_FAMILIES, type DishFamily } from "./homeRecipeAlignment";
import type { AiTaskSettingRecord } from "./taskSettings";

export type DishFamilyClassification = {
  family: DishFamily | null;
  confidence: number;
  /** true when the returned family differs from currentFamily */
  corrected: boolean;
};

// Inline descriptions for the families most commonly misclassified.
// Ordered from most-specific to most-generic to guide the model.
const FAMILY_GUIDANCE = `
"candy_confection"  — chocolate bark, caramel pretzel bites/clusters, rocky road, fudge, truffles, toffee, candy-coated or dipped treats, no-bake confections
"brownies_bars"     — brownies, blondies, millionaire shortbread, lemon bars, rice krispie treats, traybakes — baked or set in a pan then cut into squares/bars
"cookies"           — individually portioned baked rounds: cookies, biscotti, shortbread, macarons, snickerdoodles
"cake"              — layer cake, cupcakes, cheesecake, bundt cake, coffee cake, pound cake
"bread_pudding"     — ONLY literal bread pudding: stale bread soaked in egg+milk/cream custard, then baked. NEVER for sourdough loaves, garlic bread, cheese bread, or any baked bread that is not a custard dessert.
"custard_pudding"   — crème brûlée, panna cotta, flan, mousse, pudding cups (no bread)
"muffins_scones"    — muffins, scones, quick bread loaves (baking-powder leavened)
"dessert_bread"     — cinnamon rolls, babka, stollen, panettone (enriched sweet yeast breads)
"bread"             — sourdough loaves, baguette, focaccia, garlic bread, cheddar bread, cheese bread, herb bread, artisan bread (yeast-leavened savory or plain loaves)
"frozen_dessert"    — ice cream, gelato, sorbet, semifreddo
"pastry"            — croissants, danish, puff pastry, pain au chocolat, phyllo-based pastries
"pie"               — sweet or savoury pies with a pastry shell
"tart"              — open-face tart, quiche
"pasta"             — spaghetti, penne, fettuccine, carbonara, mac & cheese
"soup"              — broth-based soups, chowder, bisque
"curry"             — curry, tikka masala, korma, thai curry
"stir_fry"          — wok-based high-heat cooking
"fried_rice"        — fried rice, egg fried rice
"risotto"           — creamy arborio rice dishes
"pizza"             — pizza, flatbread with toppings
"tacos"             — tacos, burritos, quesadillas, enchiladas
"salad"             — green salad, grain bowl salad, coleslaw
"egg_dish"          — omelette, frittata, shakshuka, scrambled eggs, devilled eggs
"casserole"         — oven-baked layered/mixed dishes
"braised"           — slow-cooked braised meats or vegetables
"grilled_bbq"       — grilled, BBQ, smoked, kebab dishes
"roasted"           — oven-roasted vegetables or proteins
"sandwich"          — sandwiches, wraps, paninis, subs
"appetizer_snack"   — party snacks, loaded fries, bruschetta, finger food not in another category
`.trim();

const ALL_VALID_KEYS = DISH_FAMILIES.join(", ");

/**
 * Classify `dishName` into one of the canonical DishFamily keys (or null).
 *
 * - Fast: uses temperature=0 and a 100-token cap.
 * - Safe: returns the original currentFamily on any error so the pipeline
 *   continues unchanged rather than crashing.
 */
export async function classifyDishFamily(params: {
  dishName: string;
  userPhrase?: string;
  currentFamily?: string | null;
  taskSetting?: AiTaskSettingRecord;
}): Promise<DishFamilyClassification> {
  const dishContext = [params.dishName, params.userPhrase]
    .filter(Boolean)
    .join(" — ");

  const messages = [
    {
      role: "system" as const,
      content: `You are a culinary taxonomy classifier. Given a dish name, return the single best-matching family key from the canonical list, or null when none fits.

Family guidance (most-specific first):
${FAMILY_GUIDANCE}

All valid keys: ${ALL_VALID_KEYS}

Return ONLY valid JSON: { "family": "<key>" | null, "confidence": 0.0-1.0 }

Classification rules:
- Use null when the dish genuinely doesn't fit — null is correct, not a fallback.
- "bread_pudding" ONLY for literal bread pudding (stale bread soaked in egg+dairy custard and baked). Never use it for pretzel dishes, candy, or chocolate treats.
- Pretzel bites/bark/clusters dipped in chocolate or caramel → "candy_confection"
- Salted pretzels with dips → "appetizer_snack"
- The currentFamily hint may be incorrect — re-classify from scratch.
- Do not include markdown fences or any text outside the JSON object.`,
    },
    {
      role: "user" as const,
      content: `Classify: "${dishContext}"${params.currentFamily ? `\nCurrently classified as: "${params.currentFamily}" (may be wrong)` : ""}`,
    },
  ];

  try {
    const aiResult = await callAIForJson(messages, {
      max_tokens: 100,
      temperature: 0,
      model: params.taskSetting?.primaryModel,
    });

    if (aiResult.parsed && typeof aiResult.parsed === "object") {
      const parsed = aiResult.parsed as Record<string, unknown>;
      const rawFamily = parsed.family;
      const family =
        typeof rawFamily === "string" && (DISH_FAMILIES as readonly string[]).includes(rawFamily)
          ? (rawFamily as DishFamily)
          : null;
      const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.7;
      const currentResolved = (params.currentFamily as DishFamily | null) ?? null;
      return { family, confidence, corrected: family !== currentResolved };
    }
  } catch {
    // Fall through — return safe default so the pipeline continues.
  }

  return {
    family: (params.currentFamily as DishFamily | null) ?? null,
    confidence: 0,
    corrected: false,
  };
}

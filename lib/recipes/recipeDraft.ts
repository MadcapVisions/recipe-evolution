import { z } from "zod";
import { deriveIngredientDetails } from "./canonicalEnrichment";

const nullableTrimmedString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const optionalUnknown = z.union([z.unknown(), z.undefined()]).transform((value) => value ?? null);

function formatIngredientQuantity(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}

export function ingredientLineHasAmount(value: string) {
  return deriveIngredientDetails(value).quantity != null;
}

export function formatIngredientLine(input: {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  prep?: string | null;
  optional?: boolean;
}) {
  const amount = typeof input.quantity === "number" && Number.isFinite(input.quantity) ? formatIngredientQuantity(input.quantity) : null;
  const unit = input.unit?.trim() ? input.unit.trim() : null;
  const name = input.name.trim();
  const prep = input.prep?.trim() ? input.prep.trim() : null;
  const optional = input.optional === true ? "optional" : null;

  return [amount, unit, name, prep, optional].filter((part) => Boolean(part)).join(" ").replace(/\s+/g, " ").trim();
}

const measuredIngredientNameSchema = z
  .string()
  .trim()
  .min(1, "Ingredient name is required")
  .refine(
    (value) => ingredientLineHasAmount(value),
    "Each ingredient needs a quantity, like '2 tbsp olive oil' or '1 onion'."
  );

export const recipeDraftIngredientSchema = z.object({
  name: measuredIngredientNameSchema,
});

export const recipeDraftStepSchema = z.object({
  text: z.string().trim().min(1, "Step text is required"),
});

export const recipeDraftSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: nullableTrimmedString,
  tags: z
    .array(z.string().trim().min(1))
    .nullable()
    .optional()
    .transform((value) => {
      if (!value || value.length === 0) {
        return null;
      }
      return Array.from(new Set(value.map((item) => item.trim()).filter((item) => item.length > 0)));
    }),
  servings: z.number().int().positive().nullable(),
  prep_time_min: z.number().int().nonnegative().nullable(),
  cook_time_min: z.number().int().nonnegative().nullable(),
  difficulty: nullableTrimmedString,
  ingredients: z.array(recipeDraftIngredientSchema).min(1, "At least one ingredient is required"),
  steps: z.array(recipeDraftStepSchema).min(1, "At least one step is required"),
  notes: nullableTrimmedString.optional().transform((value) => value ?? null),
  change_log: nullableTrimmedString.optional().transform((value) => value ?? null),
  ai_metadata_json: optionalUnknown.optional().transform((value) => value ?? null),
});

export const createRecipePayloadSchema = z.object({
  draft: recipeDraftSchema,
});

export const recipeVersionPayloadSchema = z.object({
  version_label: nullableTrimmedString.optional().transform((value) => value ?? null),
  change_summary: nullableTrimmedString.optional().transform((value) => value ?? null),
  servings: z.number().int().positive().nullable().optional().transform((value) => value ?? null),
  prep_time_min: z.number().int().nonnegative().nullable().optional().transform((value) => value ?? null),
  cook_time_min: z.number().int().nonnegative().nullable().optional().transform((value) => value ?? null),
  difficulty: nullableTrimmedString.optional().transform((value) => value ?? null),
  ingredients: z.array(recipeDraftIngredientSchema).min(1, "At least one ingredient is required"),
  steps: z.array(recipeDraftStepSchema).min(1, "At least one step is required"),
  notes: nullableTrimmedString.optional().transform((value) => value ?? null),
  change_log: nullableTrimmedString.optional().transform((value) => value ?? null),
  ai_metadata_json: optionalUnknown.optional().transform((value) => value ?? null),
});

export type RecipeDraftIngredient = z.infer<typeof recipeDraftIngredientSchema>;
export type RecipeDraftStep = z.infer<typeof recipeDraftStepSchema>;

export type RecipeDraft = {
  title: string;
  description: string | null;
  tags?: string[] | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  ingredients: RecipeDraftIngredient[];
  steps: RecipeDraftStep[];
  notes?: string | null;
  change_log?: string | null;
  ai_metadata_json?: unknown;
};

export type RecipeVersionPayload = {
  version_label?: string | null;
  change_summary?: string | null;
  servings?: number | null;
  prep_time_min?: number | null;
  cook_time_min?: number | null;
  difficulty?: string | null;
  ingredients: RecipeDraftIngredient[];
  steps: RecipeDraftStep[];
  notes?: string | null;
  change_log?: string | null;
  ai_metadata_json?: unknown;
};

export function normalizeRecipeDraft(input: unknown): RecipeDraft {
  return recipeDraftSchema.parse(input) as RecipeDraft;
}

export function normalizeRecipeVersionPayload(input: unknown): RecipeVersionPayload {
  return recipeVersionPayloadSchema.parse(input) as RecipeVersionPayload;
}

export function parseIngredientLines(lines: string): RecipeDraftIngredient[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((name) => ({ name }));
}

export function parseStepLines(lines: string): RecipeDraftStep[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((text) => ({ text }));
}

function withOriginalPrep(name: string, prep?: string | null) {
  return prep ? `${name} ${prep}` : name;
}

export function coerceIngredientLineWithAmount(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return trimmed;
  }

  if (ingredientLineHasAmount(trimmed)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();

  if (lower.includes("salt and black pepper")) {
    return "1 tsp salt and 1/2 tsp black pepper";
  }

  if (lower === "salt" || lower.includes("salt to taste")) {
    return "1 tsp salt";
  }

  if (lower === "black pepper" || lower.includes("black pepper to taste") || lower === "pepper" || lower.includes("pepper to taste")) {
    return "1/2 tsp black pepper";
  }

  if (lower.includes("olive oil")) {
    return lower.includes("for serving") ? "2 tbsp olive oil, for serving" : "2 tbsp olive oil";
  }

  if (lower.includes("sesame oil")) {
    return "1 tsp sesame oil";
  }

  if (lower.includes("neutral oil")) {
    return "2 tbsp neutral oil";
  }

  if (lower.includes("butter")) {
    return "2 tbsp butter";
  }

  if (lower.includes("soy sauce")) {
    return "2 tbsp soy sauce";
  }

  if (lower.includes("broth")) {
    return "1 cup broth";
  }

  if (lower === "cream" || lower.includes("heavy cream")) {
    return "1/2 cup cream";
  }

  if (lower.includes("yogurt")) {
    return "1/2 cup yogurt";
  }

  if (lower.includes("parmesan")) {
    return "1/2 cup parmesan";
  }

  if (lower.includes("garlic")) {
    return lower.includes("clove") ? `2 ${trimmed}` : "2 cloves garlic, minced";
  }

  if (lower.includes("shallot")) {
    return "1 shallot, minced";
  }

  if (lower.includes("onion")) {
    return "1 onion, diced";
  }

  if (lower.includes("ginger")) {
    return "1 tbsp ginger, grated";
  }

  if (lower.includes("scallion")) {
    return "2 scallions, sliced";
  }

  if (lower.includes("lemon juice")) {
    return "1 tbsp lemon juice";
  }

  if (lower.includes("lime juice")) {
    return "1 tbsp lime juice";
  }

  if (lower === "lemon" || lower.includes("lemon,")) {
    return "1 lemon";
  }

  if (lower === "lime" || lower.includes("lime,")) {
    return "1 lime";
  }

  if (lower.includes("vinegar")) {
    return `1 tbsp ${trimmed}`;
  }

  if (lower.includes("basil") || lower.includes("cilantro") || lower.includes("parsley") || lower.includes("dill") || lower.includes("chives")) {
    return `2 tbsp fresh ${trimmed.replace(/^fresh\s+/i, "")}, chopped`;
  }

  if (lower.includes("oregano")) {
    return "1 tsp oregano";
  }

  if (lower.includes("red pepper flakes")) {
    return "1/2 tsp red pepper flakes";
  }

  if (lower.includes("chili powder")) {
    return "1 tsp chili powder";
  }

  if (lower.includes("paprika")) {
    return "1 tsp paprika";
  }

  if (lower.includes("cumin")) {
    return "1 tsp cumin";
  }

  if (lower.includes("chipotle")) {
    return "1 tsp chipotle";
  }

  if (lower.includes("tomato")) {
    return "1 cup tomatoes, chopped";
  }

  if (lower.includes("zucchini")) {
    return "2 medium zucchini, sliced";
  }

  if (lower.includes("spinach")) {
    return "4 cups spinach";
  }

  if (lower.includes("mushroom")) {
    return "8 oz mushrooms, sliced";
  }

  if (lower.includes("bell pepper") || lower === "peppers" || lower === "pepper strips") {
    return "1 bell pepper, sliced";
  }

  if (lower.includes("broccoli")) {
    return "1 head broccoli, cut into florets";
  }

  if (lower.includes("asparagus")) {
    return "1 bunch asparagus";
  }

  if (lower.includes("green beans")) {
    return "12 oz green beans";
  }

  if (lower.includes("cauliflower")) {
    return "1 small head cauliflower";
  }

  if (lower.includes("peas")) {
    return "1 cup peas";
  }

  if (lower.includes("corn")) {
    return "1 cup corn";
  }

  if (lower.includes("cabbage")) {
    return "2 cups cabbage, shredded";
  }

  if (lower.includes("cucumber")) {
    return "1 cucumber, sliced";
  }

  if (lower.includes("carrot")) {
    return "2 carrots, sliced";
  }

  if (lower.includes("eggplant") || lower.includes("aubergine")) {
    return "1 medium eggplant";
  }

  if (lower.includes("potato")) {
    return `1 lb ${trimmed}`;
  }

  if (lower.includes("rice")) {
    return withOriginalPrep("1 cup rice", deriveIngredientDetails(trimmed).prep);
  }

  if (lower.includes("quinoa")) {
    return "1 cup quinoa";
  }

  if (lower.includes("pasta") || lower.includes("spaghetti") || lower.includes("noodle")) {
    return `8 oz ${trimmed}`;
  }

  if (lower.includes("tortilla")) {
    return "8 tortillas";
  }

  if (lower.includes("beans")) {
    return "1 can beans, drained";
  }

  if (lower.includes("chickpeas")) {
    return "1 can chickpeas, drained";
  }

  if (lower.includes("tofu")) {
    return "14 oz tofu";
  }

  if (lower.includes("egg")) {
    return lower.includes("for serving") ? "2 eggs, for serving" : "4 eggs";
  }

  if (
    lower.includes("chicken") ||
    lower.includes("turkey") ||
    lower.includes("beef") ||
    lower.includes("pork") ||
    lower.includes("salmon") ||
    lower.includes("shrimp") ||
    lower.includes("fish")
  ) {
    return `1 lb ${trimmed}`;
  }

  if (lower.includes("fresh herbs")) {
    return "2 tbsp fresh herbs, chopped";
  }

  if (lower.includes("bread") && lower.includes("for serving")) {
    return "4 slices bread, for serving";
  }

  if (lower.includes("tomatoes") && lower.includes("for serving")) {
    return "2 tomatoes, for serving";
  }

  return `1 ${trimmed}`;
}

export function repairRecipeDraftIngredientLines(input: Array<{ name: string }>): RecipeDraftIngredient[] {
  return input
    .map((ingredient) => ({
      name: coerceIngredientLineWithAmount(ingredient.name),
    }))
    .filter((ingredient) => ingredient.name.length > 0);
}

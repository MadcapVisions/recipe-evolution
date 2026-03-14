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

import { z } from "zod";

const toOptionalInt = (value: unknown) => {
  if (value === "" || value == null) {
    return undefined;
  }
  if (typeof value === "number") {
    return Number.isNaN(value) ? undefined : value;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

export const recipeSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  tagsInput: z.string().optional(),
});

export const recipeVersionSchema = z.object({
  servings: z.preprocess(toOptionalInt, z.number().int().positive().optional()),
  prepTimeMin: z.preprocess(toOptionalInt, z.number().int().nonnegative().optional()),
  cookTimeMin: z.preprocess(toOptionalInt, z.number().int().nonnegative().optional()),
  difficulty: z.string().trim().optional(),
  ingredientsInput: z
    .string()
    .trim()
    .min(1, "At least one ingredient is required"),
  stepsInput: z.string().trim().min(1, "At least one step is required"),
  notes: z.string().trim().optional(),
});

export type RecipeFormValues = z.infer<typeof recipeSchema>;
export type RecipeVersionFormValues = z.infer<typeof recipeVersionSchema>;
export type RecipeVersionFormInput = z.input<typeof recipeVersionSchema>;

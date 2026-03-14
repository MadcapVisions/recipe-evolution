import { z } from "zod";
import { ingredientLineHasAmount } from "@/lib/recipes/recipeDraft";

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
    .min(1, "At least one ingredient is required")
    .refine(
      (value) =>
        value
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .every((line) => ingredientLineHasAmount(line)),
      "Every ingredient needs a quantity, like '2 tbsp olive oil' or '1 onion'."
    ),
  stepsInput: z.string().trim().min(1, "At least one step is required"),
  notes: z.string().trim().optional(),
});

export const createRecipeWithVersionSchema = recipeSchema.extend({
  servings: recipeVersionSchema.shape.servings,
  prepTimeMin: recipeVersionSchema.shape.prepTimeMin,
  cookTimeMin: recipeVersionSchema.shape.cookTimeMin,
  difficulty: recipeVersionSchema.shape.difficulty,
  ingredientsInput: recipeVersionSchema.shape.ingredientsInput,
  stepsInput: recipeVersionSchema.shape.stepsInput,
  notes: recipeVersionSchema.shape.notes,
});

export type RecipeFormValues = z.infer<typeof recipeSchema>;
export type RecipeVersionFormValues = z.infer<typeof recipeVersionSchema>;
export type RecipeVersionFormInput = z.input<typeof recipeVersionSchema>;
export type CreateRecipeWithVersionValues = z.infer<typeof createRecipeWithVersionSchema>;
export type CreateRecipeWithVersionInput = z.input<typeof createRecipeWithVersionSchema>;

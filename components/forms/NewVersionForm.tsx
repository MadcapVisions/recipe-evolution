"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createRecipeVersionViaApi } from "@/lib/client/recipeMutations";
import { parseIngredientLines, parseStepLines } from "@/lib/recipes/recipeDraft";
import { trackEventInBackground } from "@/lib/trackEventInBackground";
import {
  RecipeVersionFormInput,
  RecipeVersionFormValues,
  recipeVersionSchema,
} from "@/lib/validation/recipes";
import { Button } from "@/components/Button";

type NewVersionFormProps = {
  recipeId: string;
};

export function NewVersionForm({ recipeId }: NewVersionFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecipeVersionFormInput, unknown, RecipeVersionFormValues>({
    resolver: zodResolver(recipeVersionSchema),
    defaultValues: {
      servings: undefined,
      prepTimeMin: undefined,
      cookTimeMin: undefined,
      difficulty: "",
      ingredientsInput: "",
      stepsInput: "",
      notes: "",
    },
  });

  const onSubmit = async (values: RecipeVersionFormValues) => {
    setSubmitError(null);

    const canonicalIngredients = parseIngredientLines(values.ingredientsInput);
    const canonicalSteps = parseStepLines(values.stepsInput);

    try {
      const createdVersion = await createRecipeVersionViaApi(recipeId, {
        servings: values.servings ?? null,
        prep_time_min: values.prepTimeMin ?? null,
        cook_time_min: values.cookTimeMin ?? null,
        difficulty: values.difficulty,
        ingredients: canonicalIngredients,
        steps: canonicalSteps,
        notes: values.notes,
        change_log: "Manual update",
      });

      trackEventInBackground("version_created", {
        recipeId,
        versionNumber: createdVersion.version_number,
      });
      router.push(`/recipes/${recipeId}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create version.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="saas-card space-y-4 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="servings" className="text-sm font-medium">
            Servings
          </label>
          <input
            id="servings"
            type="number"
            min={1}
            className="min-h-12 w-full"
            {...register("servings")}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="difficulty" className="text-sm font-medium">
            Difficulty
          </label>
          <input
            id="difficulty"
            type="text"
            className="min-h-12 w-full"
            {...register("difficulty")}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="prepTimeMin" className="text-sm font-medium">
            Prep time (min)
          </label>
          <input
            id="prepTimeMin"
            type="number"
            min={0}
            className="min-h-12 w-full"
            {...register("prepTimeMin")}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="cookTimeMin" className="text-sm font-medium">
            Cook time (min)
          </label>
          <input
            id="cookTimeMin"
            type="number"
            min={0}
            className="min-h-12 w-full"
            {...register("cookTimeMin")}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="ingredientsInput" className="text-sm font-medium">
          Ingredients (one per line)
        </label>
        <textarea
          id="ingredientsInput"
          className="min-h-32 w-full"
          {...register("ingredientsInput")}
        />
        {errors.ingredientsInput ? (
          <p className="text-sm text-red-700">{errors.ingredientsInput.message}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="stepsInput" className="text-sm font-medium">
          Steps (one per line)
        </label>
        <textarea
          id="stepsInput"
          className="min-h-32 w-full"
          {...register("stepsInput")}
        />
        {errors.stepsInput ? <p className="text-sm text-red-700">{errors.stepsInput.message}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes
        </label>
        <textarea id="notes" className="min-h-24 w-full" {...register("notes")} />
      </div>

      {submitError ? <p className="text-sm text-red-700">{submitError}</p> : null}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="min-h-12 w-full"
      >
        {isSubmitting ? "Creating version..." : "Create Version"}
      </Button>
    </form>
  );
}

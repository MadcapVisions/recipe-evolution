"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createRecipeFromDraft, LimitExceededError } from "@/lib/client/recipeMutations";
import { parseIngredientLines, parseStepLines } from "@/lib/recipes/recipeDraft";
import { trackEventInBackground } from "@/lib/trackEventInBackground";
import {
  CreateRecipeWithVersionInput,
  CreateRecipeWithVersionValues,
  createRecipeWithVersionSchema,
} from "@/lib/validation/recipes";
import { Button } from "@/components/Button";

export function NewRecipeForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateRecipeWithVersionInput, unknown, CreateRecipeWithVersionValues>({
    resolver: zodResolver(createRecipeWithVersionSchema),
    defaultValues: {
      title: "",
      description: "",
      tagsInput: "",
      servings: undefined,
      prepTimeMin: undefined,
      cookTimeMin: undefined,
      difficulty: "",
      ingredientsInput: "",
      stepsInput: "",
      notes: "",
    },
  });

  const onSubmit = async (values: CreateRecipeWithVersionValues) => {
    setSubmitError(null);

    const tags = (values.tagsInput ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const ingredients = parseIngredientLines(values.ingredientsInput);
    const steps = parseStepLines(values.stepsInput);

    try {
      const created = await createRecipeFromDraft({
        draft: {
          title: values.title,
          description: values.description?.trim() || null,
          tags,
          servings: values.servings ?? null,
          prep_time_min: values.prepTimeMin ?? null,
          cook_time_min: values.cookTimeMin ?? null,
          difficulty: values.difficulty?.trim() || null,
          ingredients,
          steps,
          notes: values.notes?.trim() || null,
          change_log: "Initial version",
        },
      });

      trackEventInBackground("recipe_created", { recipeId: created.recipeId, source: "manual" });
      trackEventInBackground("version_created", {
        recipeId: created.recipeId,
        versionId: created.versionId,
        versionNumber: created.versionNumber,
        source: "manual",
      });
      router.push(`/recipes/${created.recipeId}/versions/${created.versionId}`);
    } catch (error) {
      if (error instanceof LimitExceededError) {
        trackEventInBackground("limit_hit", { limit: "recipes_per_user", max: 50 });
        setSubmitError(error.message);
      } else {
        setSubmitError(error instanceof Error ? error.message : "Failed to create recipe.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="saas-card space-y-4 p-5">
      <div className="space-y-1">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          type="text"
          className="min-h-12 w-full"
          {...register("title")}
        />
        {errors.title ? <p className="text-sm text-red-700">{errors.title.message}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          className="min-h-24 w-full"
          {...register("description")}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="tagsInput" className="text-sm font-medium">
          Tags (comma separated)
        </label>
        <input
          id="tagsInput"
          type="text"
          className="min-h-12 w-full"
          {...register("tagsInput")}
        />
      </div>

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
        {isSubmitting ? "Creating..." : "Create Recipe"}
      </Button>
    </form>
  );
}

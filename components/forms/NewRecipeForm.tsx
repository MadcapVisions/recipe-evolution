"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createRecipe, LimitExceededError } from "@/lib/client/recipeMutations";
import { trackEventInBackground } from "@/lib/trackEventInBackground";
import { RecipeFormValues, recipeSchema } from "@/lib/validation/recipes";
import { Button } from "@/components/Button";

type NewRecipeFormProps = {
  ownerId: string;
};

export function NewRecipeForm({ ownerId }: NewRecipeFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      title: "",
      description: "",
      tagsInput: "",
    },
  });

  const onSubmit = async (values: RecipeFormValues) => {
    setSubmitError(null);

    const tags = (values.tagsInput ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    try {
      const recipeId = await createRecipe({
        ownerId,
        title: values.title,
        description: values.description,
        tags,
      });

      trackEventInBackground("recipe_created", { recipeId });
      router.push(`/recipes/${recipeId}/versions/new`);
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

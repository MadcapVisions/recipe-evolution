"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { structureRecipeFromText } from "@/lib/client/aiStructureRecipe";
import { createRecipeWithVersion } from "@/lib/client/recipeMutations";
import { Button } from "@/components/Button";

type ImportRecipeFormProps = {
  ownerId: string;
};

export function ImportRecipeForm({ ownerId }: ImportRecipeFormProps) {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredientsInput, setIngredientsInput] = useState("");
  const [stepsInput, setStepsInput] = useState("");
  const [readyToSave, setReadyToSave] = useState(false);

  const handleStructure = async () => {
    if (!rawText.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const normalized = await structureRecipeFromText({ rawText });
      setTitle(manualTitle.trim() || normalized.title || "");
      setDescription(normalized.description ?? "");
      setIngredientsInput(
        normalized.ingredients
          .map((ingredient) => ingredient.name?.trim() ?? "")
          .filter((line) => line.length > 0)
          .join("\n")
      );
      setStepsInput(
        normalized.steps
          .map((step) => step.text?.trim() ?? "")
          .filter((line) => line.length > 0)
          .join("\n")
      );
      setReadyToSave(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Recipe parsing failed. Please edit manually.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    const ingredients_json = ingredientsInput
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((name) => ({ name }));

    const steps_json = stepsInput
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((text) => ({ text }));

    if (ingredients_json.length === 0 || steps_json.length === 0) {
      setError("Please include at least one ingredient and one step.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await createRecipeWithVersion({
        ownerId,
        title,
        description,
        version: {
          versionNumber: 1,
          ingredients_json,
          steps_json,
          change_log: "Imported from raw text",
        },
      });

      setSaving(false);
      router.push(`/recipes/${created.recipeId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save recipe.");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl page-shell">
      <div className="space-y-3">
        <p className="app-kicker">Import</p>
        <h1 className="page-title">Import a recipe</h1>
        <p className="text-[16px] leading-7 text-[color:var(--muted)]">Paste recipe text, let AI structure it, then review before saving.</p>
      </div>

      <section className="saas-card space-y-3 p-5">
        <div className="space-y-1">
          <label htmlFor="manualTitle" className="text-sm font-medium">
            Recipe name (optional)
          </label>
          <input
            id="manualTitle"
            value={manualTitle}
            onChange={(event) => setManualTitle(event.target.value)}
            placeholder="Ex: Grandma's Sunday Lasagna"
            className="min-h-12 w-full"
          />
        </div>
        <label htmlFor="rawText" className="text-sm font-medium">
          Paste recipe text
        </label>
        <textarea
          id="rawText"
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          className="min-h-40 w-full"
        />
        <Button
          onClick={handleStructure}
          disabled={loading}
          className="min-h-12"
        >
          {loading ? "Structuring..." : "Structure with AI"}
        </Button>
      </section>

      {readyToSave ? (
        <section className="saas-card space-y-3 p-5">
          <div className="space-y-1">
            <label htmlFor="title" className="text-sm font-medium">
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="min-h-12 w-full"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 w-full"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="ingredients" className="text-sm font-medium">
              Ingredients list
            </label>
            <textarea
              id="ingredients"
              value={ingredientsInput}
              onChange={(event) => setIngredientsInput(event.target.value)}
              className="min-h-32 w-full"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="steps" className="text-sm font-medium">
              Steps list
            </label>
            <textarea
              id="steps"
              value={stepsInput}
              onChange={(event) => setStepsInput(event.target.value)}
              className="min-h-32 w-full"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="min-h-12"
          >
            {saving ? "Saving..." : "Save Recipe"}
          </Button>
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

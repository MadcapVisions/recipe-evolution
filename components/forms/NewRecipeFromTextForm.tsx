"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { structureRecipeFromText } from "@/lib/client/aiStructureRecipe";
import { createRecipeWithVersion, LimitExceededError } from "@/lib/client/recipeMutations";
import { trackEventInBackground } from "@/lib/trackEventInBackground";
import { Button } from "@/components/Button";
import { publishAiStatus } from "@/lib/ui/aiStatusBus";

type PreferredUnits = "metric" | "imperial";

type StructuredIngredient = {
  name: string;
  quantity: number | null;
  unit: string | null;
  prep: string | null;
  optional: boolean;
  group: string | null;
};

type StructuredStep = {
  text: string;
  timer_seconds: number | null;
  temperature_c: number | null;
  temperature_f: number | null;
  equipment: string[] | null;
};

type StructuredRecipe = {
  title: string;
  description: string | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  tags: string[];
  ingredients_json: StructuredIngredient[];
  steps_json: StructuredStep[];
};

type AiMeta = {
  purpose: "structure";
  model: string;
  cached: boolean;
  input_hash: string;
  created_at: string;
};

type NewRecipeFromTextFormProps = {
  ownerId: string;
};

const ingredientToLine = (ingredient: StructuredIngredient) => {
  const parts = [
    ingredient.quantity != null ? String(ingredient.quantity) : null,
    ingredient.unit,
    ingredient.name,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  return parts.join(" ");
};

const parseIngredientLine = (line: string): StructuredIngredient => {
  const trimmed = line.trim();
  const withQuantity = trimmed.match(/^(\d+(?:\.\d+)?)\s+([^\d\s]+)\s+(.+)$/);

  if (withQuantity) {
    return {
      name: withQuantity[3].trim(),
      quantity: Number(withQuantity[1]),
      unit: withQuantity[2].trim(),
      prep: null,
      optional: false,
      group: null,
    };
  }

  return {
    name: trimmed,
    quantity: null,
    unit: null,
    prep: null,
    optional: false,
    group: null,
  };
};

export function NewRecipeFromTextForm({ ownerId }: NewRecipeFromTextFormProps) {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [preferredUnits, setPreferredUnits] = useState<PreferredUnits>("metric");
  const [structuring, setStructuring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<AiMeta | null>(null);
  const [structured, setStructured] = useState<StructuredRecipe | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [servingsInput, setServingsInput] = useState("");
  const [prepTimeInput, setPrepTimeInput] = useState("");
  const [cookTimeInput, setCookTimeInput] = useState("");
  const [difficultyInput, setDifficultyInput] = useState("");
  const [ingredientsInput, setIngredientsInput] = useState("");
  const [stepsInput, setStepsInput] = useState("");

  useEffect(() => {
    let message: string | null = null;
    let tone: "default" | "loading" | "success" | "fallback" = "default";
    const lowerError = error?.toLowerCase() ?? "";

    if (structuring) {
      message = "Chef is structuring your recipe...";
      tone = "loading";
    } else if (saving) {
      message = "Generating recipe...";
      tone = "loading";
    } else if (structured && !error) {
      message = "Suggestions ready";
      tone = "success";
    } else if (error) {
      if (
        lowerError.includes("unavailable") ||
        lowerError.includes("rate-limited") ||
        lowerError.includes("failed") ||
        lowerError.includes("parsing")
      ) {
        message = "AI temporarily unavailable";
        tone = "fallback";
      }
    }

    publishAiStatus({ message, tone });

    return () => {
      publishAiStatus({ message: null });
    };
  }, [structuring, saving, structured, error]);

  const canStructure = rawText.trim().length > 0 && !structuring;

  const parseNullableNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleStructure = async () => {
    if (!canStructure) {
      return;
    }

    setStructuring(true);
    setError(null);

    try {
      const result = await structureRecipeFromText({
        rawText,
        preferredUnits,
      });
      const meta = result.meta as AiMeta;

      if (!meta) {
        setError("Failed to structure recipe.");
        setStructuring(false);
        return;
      }

      trackEventInBackground("recipe_structured_ai", {
        cached: meta.cached,
        model: meta.model,
        input_hash: meta.input_hash,
      });

      setStructured({
        title: result.title,
        description: result.description,
        servings: null,
        prep_time_min: null,
        cook_time_min: null,
        difficulty: null,
        tags: [],
        ingredients_json: result.ingredients.map((item) => ({
          name: item.name,
          quantity: null,
          unit: null,
          prep: null,
          optional: false,
          group: null,
        })),
        steps_json: result.steps.map((item) => ({
          text: item.text,
          timer_seconds: null,
          temperature_c: null,
          temperature_f: null,
          equipment: null,
        })),
      });
      setAiMeta(meta);

      setTitle(result.title ?? "");
      setDescription(result.description ?? "");
      setTagsInput("");
      setServingsInput("");
      setPrepTimeInput("");
      setCookTimeInput("");
      setDifficultyInput("");
      setIngredientsInput(result.ingredients.map((ingredient) => ingredient.name).join("\n"));
      setStepsInput(result.steps.map((step) => step.text).join("\n"));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to structure recipe.");
      setStructuring(false);
      return;
    }

    setStructuring(false);
  };

  const parsedIngredients = useMemo(
    () =>
      ingredientsInput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map(parseIngredientLine),
    [ingredientsInput]
  );

  const parsedSteps = useMemo(
    () =>
      stepsInput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((text) => ({
          text,
          timer_seconds: null,
          temperature_c: null,
          temperature_f: null,
          equipment: null,
        })),
    [stepsInput]
  );

  const handleSave = async () => {
    if (!structured || !aiMeta) {
      return;
    }

    if (!title.trim() || parsedIngredients.length === 0 || parsedSteps.length === 0) {
      setError("Title, ingredients, and steps are required.");
      return;
    }

    setSaving(true);
    setError(null);

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const ai_metadata_json = {
      purpose: "structure",
      model: aiMeta.model,
      cached: aiMeta.cached,
      input_hash: aiMeta.input_hash,
      created_at: aiMeta.created_at,
    };

    try {
      const created = await createRecipeWithVersion({
        ownerId,
        title,
        description,
        tags,
        version: {
          versionNumber: 1,
          prep_time_min: parseNullableNumber(prepTimeInput),
          cook_time_min: parseNullableNumber(cookTimeInput),
          servings: parseNullableNumber(servingsInput),
          difficulty: difficultyInput,
          ingredients_json: parsedIngredients,
          steps_json: parsedSteps,
          change_log: "Structured from pasted recipe text",
          ai_metadata_json,
        },
      });

      trackEventInBackground("recipe_created", { recipeId: created.recipeId, source: "from_text" });
      trackEventInBackground("version_created", { recipeId: created.recipeId, versionNumber: 1, source: "from_text" });

      router.push(`/recipes/${created.recipeId}`);
      setSaving(false);
    } catch (error) {
      if (error instanceof LimitExceededError) {
        trackEventInBackground("limit_hit", { limit: "recipes_per_user", max: 50 });
        setError(error.message);
      } else {
        setError(error instanceof Error ? error.message : "Failed to create recipe.");
      }
      setSaving(false);
    }
  };

  return (
    <div className="page-shell">
      <section className="saas-card space-y-3 p-5">
        <h2 className="text-lg font-semibold">Paste recipe text</h2>
        <textarea
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          className="min-h-40 w-full"
          placeholder="Paste a recipe from notes, website, or cookbook..."
        />
        <div className="flex gap-2">
          <Button
            onClick={() => setPreferredUnits("metric")}
            variant={preferredUnits === "metric" ? "primary" : "secondary"}
            className={`min-h-11 ${
              preferredUnits === "metric" ? "bg-slate-900 text-white" : "border"
            }`}
          >
            Metric
          </Button>
          <Button
            onClick={() => setPreferredUnits("imperial")}
            variant={preferredUnits === "imperial" ? "primary" : "secondary"}
            className={`min-h-11 ${
              preferredUnits === "imperial" ? "bg-slate-900 text-white" : "border"
            }`}
          >
            Imperial
          </Button>
        </div>
        <Button
          disabled={!canStructure}
          onClick={handleStructure}
          className="min-h-12 w-full"
        >
          {structuring ? "Structuring..." : "Structure with AI"}
        </Button>
      </section>

      {structured ? (
        <section className="saas-card space-y-3 p-5">
          <h2 className="text-lg font-semibold">Review structured recipe</h2>
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
            <label htmlFor="tags" className="text-sm font-medium">
              Tags
            </label>
            <input
              id="tags"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              className="min-h-12 w-full"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="servings" className="text-sm font-medium">
                Servings
              </label>
              <input
                id="servings"
                type="number"
                value={servingsInput}
                onChange={(event) => setServingsInput(event.target.value)}
                className="min-h-12 w-full"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="difficulty" className="text-sm font-medium">
                Difficulty
              </label>
              <input
                id="difficulty"
                value={difficultyInput}
                onChange={(event) => setDifficultyInput(event.target.value)}
                className="min-h-12 w-full"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="prep" className="text-sm font-medium">
                Prep time (min)
              </label>
              <input
                id="prep"
                type="number"
                value={prepTimeInput}
                onChange={(event) => setPrepTimeInput(event.target.value)}
                className="min-h-12 w-full"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cook" className="text-sm font-medium">
                Cook time (min)
              </label>
              <input
                id="cook"
                type="number"
                value={cookTimeInput}
                onChange={(event) => setCookTimeInput(event.target.value)}
                className="min-h-12 w-full"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="ingredients" className="text-sm font-medium">
              Ingredients (one per line)
            </label>
            <textarea
              id="ingredients"
              value={ingredientsInput}
              onChange={(event) => setIngredientsInput(event.target.value)}
              className="min-h-36 w-full"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="steps" className="text-sm font-medium">
              Steps (one per line)
            </label>
            <textarea
              id="steps"
              value={stepsInput}
              onChange={(event) => setStepsInput(event.target.value)}
              className="min-h-36 w-full"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="min-h-12 w-full"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { structureRecipeFromText } from "@/lib/client/aiStructureRecipe";
import { createRecipeFromDraft, getCreatedRecipeHref, LimitExceededError } from "@/lib/client/recipeMutations";
import { parseIngredientLines, parseStepLines } from "@/lib/recipes/recipeDraft";
import { buildCanonicalEnrichment } from "@/lib/recipes/canonicalEnrichment";
import { trackEventInBackground } from "@/lib/trackEventInBackground";
import { Button } from "@/components/Button";
import { publishAiStatus } from "@/lib/ui/aiStatusBus";

type PreferredUnits = "metric" | "imperial";

type AiMeta = {
  purpose: "structure";
  model: string;
  cached: boolean;
  input_hash: string;
  created_at: string;
};

export function NewRecipeFromTextForm() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [preferredUnits, setPreferredUnits] = useState<PreferredUnits>("metric");
  const [structuring, setStructuring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<AiMeta | null>(null);
  const [structured, setStructured] = useState(false);

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
      message = "Saving to cookbook...";
      tone = "loading";
    } else if (structured && !error) {
      message = "Draft ready";
      tone = "success";
    } else if (error) {
      if (
        lowerError.includes("unavailable") ||
        lowerError.includes("rate-limited") ||
        lowerError.includes("failed") ||
        lowerError.includes("parsing")
      ) {
        message = "Chef temporarily unavailable";
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
  const currentStep = structured ? 2 : 1;

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

      setStructured(true);
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

  const handleSave = async () => {
    if (!structured || !aiMeta) {
      return;
    }

    const parsedIngredients = parseIngredientLines(ingredientsInput);
    const parsedSteps = parseStepLines(stepsInput);

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
      canonical_enrichment: buildCanonicalEnrichment({
        ingredientNames: parsedIngredients.map((item) => item.name),
        stepTexts: parsedSteps.map((item) => item.text),
        preferredUnits,
      }),
    };

    try {
      const created = await createRecipeFromDraft({
        draft: {
          title: title.trim(),
          description: description.trim() || null,
          tags,
          prep_time_min: parseNullableNumber(prepTimeInput),
          cook_time_min: parseNullableNumber(cookTimeInput),
          servings: parseNullableNumber(servingsInput),
          difficulty: difficultyInput.trim() || null,
          ingredients: parsedIngredients,
          steps: parsedSteps,
          change_log: "Structured from pasted recipe text",
          ai_metadata_json,
        },
      });

      trackEventInBackground("recipe_created", { recipeId: created.recipeId, source: "from_text" });
      trackEventInBackground("version_created", { recipeId: created.recipeId, versionNumber: 1, source: "from_text" });

      router.push(getCreatedRecipeHref({ recipeId: created.recipeId, versionId: created.versionId }));
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
      <section className="app-panel p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { step: 1, title: "Paste recipe" },
            { step: 2, title: "Review and save" },
          ].map((item) => {
            const active = item.step === currentStep;
            const complete = item.step < currentStep;
            return (
              <div
                key={item.step}
                className={`rounded-[22px] px-4 py-3 ${
                  active
                    ? "bg-[rgba(82,124,116,0.1)] ring-1 ring-[rgba(82,124,116,0.22)]"
                    : complete
                      ? "bg-[rgba(141,169,187,0.1)]"
                      : "bg-[rgba(255,252,246,0.72)] ring-1 ring-[rgba(79,54,33,0.08)]"
                }`}
              >
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  {complete ? "Done" : `Step ${item.step}`}
                </p>
                <p className="mt-2 text-[16px] font-semibold text-[color:var(--text)]">{item.title}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="saas-card space-y-4 p-5">
        <div className="space-y-2">
          <p className="app-kicker">Step 1</p>
          <h2 className="font-display text-[28px] font-semibold text-[color:var(--text)]">Paste the source material</h2>
          <p className="text-[15px] leading-6 text-[color:var(--muted)]">
            Paste from notes, a website, or a document. Chef will structure it into a clean starting version you can actually work with.
          </p>
        </div>
        <textarea
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          className="min-h-40 w-full"
          placeholder="Paste a recipe from notes, a website, or an old cookbook entry..."
        />
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[15px] font-medium text-[color:var(--text)]">Preferred units</p>
          <Button
            onClick={() => setPreferredUnits("metric")}
            variant={preferredUnits === "metric" ? "primary" : "secondary"}
            className="min-h-11 min-w-[112px]"
          >
            Metric
          </Button>
          <Button
            onClick={() => setPreferredUnits("imperial")}
            variant={preferredUnits === "imperial" ? "primary" : "secondary"}
            className="min-h-11 min-w-[112px]"
          >
            Imperial
          </Button>
        </div>
        <Button
          disabled={!canStructure}
          onClick={handleStructure}
          className="min-h-12 w-full"
        >
          {structuring ? "Structuring..." : "Structure with Chef"}
        </Button>
      </section>

      {structured ? (
        <section className="saas-card space-y-4 p-5">
          <div className="space-y-2">
            <p className="app-kicker">Step 2</p>
            <h2 className="font-display text-[28px] font-semibold text-[color:var(--text)]">Review the first clean version</h2>
            <p className="text-[15px] leading-6 text-[color:var(--muted)]">
              Make any edits you want, then save this as the base version in your cookbook.
            </p>
          </div>
          <div className="rounded-[24px] bg-[rgba(79,125,115,0.08)] p-4">
            <p className="app-kicker">Imported foundation</p>
            <p className="mt-2 text-[15px] leading-7 text-[color:var(--muted)]">
              Imported recipes are most useful when the first version is clean. You can rename, refine, and evolve it after saving.
            </p>
          </div>
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
            {saving ? "Saving..." : "Save to Cookbook"}
          </Button>
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

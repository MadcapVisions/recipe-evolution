"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/Button";

type PreferencesFormProps = {
  ownerId: string;
  initialPreferredUnits: "metric" | "imperial";
  initialSkill: string;
  initialDietTags: string[];
  initialDislikedIngredients: string[];
  initialFavoriteCuisines: string[];
  initialFavoriteProteins: string[];
  initialPreferredFlavors: string[];
  initialPantryStaples: string[];
  initialPantryConfidentStaples: string[];
  initialSpiceTolerance: string;
  initialHealthGoals: string[];
  initialTasteNotes: string;
};

export function PreferencesForm({
  ownerId,
  initialPreferredUnits,
  initialSkill,
  initialDietTags,
  initialDislikedIngredients,
  initialFavoriteCuisines,
  initialFavoriteProteins,
  initialPreferredFlavors,
  initialPantryStaples,
  initialPantryConfidentStaples,
  initialSpiceTolerance,
  initialHealthGoals,
  initialTasteNotes,
}: PreferencesFormProps) {
  const [preferredUnits, setPreferredUnits] = useState<"metric" | "imperial">(initialPreferredUnits);
  const [cookingSkillLevel, setCookingSkillLevel] = useState(initialSkill);
  const [dietTagsInput, setDietTagsInput] = useState(initialDietTags.join(", "));
  const [dislikedIngredientsInput, setDislikedIngredientsInput] = useState(initialDislikedIngredients.join(", "));
  const [favoriteCuisinesInput, setFavoriteCuisinesInput] = useState(initialFavoriteCuisines.join(", "));
  const [favoriteProteinsInput, setFavoriteProteinsInput] = useState(initialFavoriteProteins.join(", "));
  const [preferredFlavorsInput, setPreferredFlavorsInput] = useState(initialPreferredFlavors.join(", "));
  const [pantryStaplesInput, setPantryStaplesInput] = useState(initialPantryStaples.join(", "));
  const [pantryConfidentInput, setPantryConfidentInput] = useState(initialPantryConfidentStaples.join(", "));
  const [spiceTolerance, setSpiceTolerance] = useState(initialSpiceTolerance);
  const [healthGoalsInput, setHealthGoalsInput] = useState(initialHealthGoals.join(", "));
  const [tasteNotes, setTasteNotes] = useState(initialTasteNotes);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    const commonDietTags = parseList(dietTagsInput);
    const dislikedIngredients = parseList(dislikedIngredientsInput);
    const favoriteCuisines = parseList(favoriteCuisinesInput);
    const favoriteProteins = parseList(favoriteProteinsInput);
    const preferredFlavors = parseList(preferredFlavorsInput);
    const pantryStaples = parseList(pantryStaplesInput);
    const pantryConfidentStaples = parseList(pantryConfidentInput);
    const healthGoals = parseList(healthGoalsInput);

    const { error: upsertError } = await supabase.from("user_preferences").upsert(
      {
        owner_id: ownerId,
        preferred_units: preferredUnits,
        cooking_skill_level: cookingSkillLevel.trim() || null,
        common_diet_tags: commonDietTags.length > 0 ? commonDietTags : null,
        disliked_ingredients: dislikedIngredients.length > 0 ? dislikedIngredients : null,
        favorite_cuisines: favoriteCuisines.length > 0 ? favoriteCuisines : null,
        favorite_proteins: favoriteProteins.length > 0 ? favoriteProteins : null,
        preferred_flavors: preferredFlavors.length > 0 ? preferredFlavors : null,
        pantry_staples: pantryStaples.length > 0 ? pantryStaples : null,
        pantry_confident_staples: pantryConfidentStaples.length > 0 ? pantryConfidentStaples : null,
        spice_tolerance: spiceTolerance.trim() || null,
        health_goals: healthGoals.length > 0 ? healthGoals : null,
        taste_notes: tasteNotes.trim() || null,
      },
      { onConflict: "owner_id" }
    );

    if (upsertError) {
      setError(upsertError.message);
      setSaving(false);
      return;
    }

    setMessage("Preferences saved.");
    setSaving(false);
  };

  return (
    <div className="saas-card space-y-6 p-5">
      <div className="rounded-[24px] border border-[rgba(74,106,96,0.08)] bg-[rgba(74,106,96,0.05)] px-4 py-3">
        <p className="text-[15px] leading-6 text-[color:var(--muted)]">
          These are the defaults Chef uses before adapting to your cookbook, saved versions, and behavior.
        </p>
      </div>

      <section className="settings-section space-y-4 p-4">
        <div className="space-y-1">
          <p className="app-kicker">Cooking defaults</p>
          <h3 className="text-[22px] font-semibold tracking-tight text-[color:var(--text)]">How your kitchen usually works</h3>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[16px] font-medium text-[color:var(--text)]">Units</p>
            <div className="flex flex-wrap gap-2">
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
          </div>

          <div className="space-y-1">
            <label htmlFor="skill" className="text-[15px] font-medium text-[color:var(--text)]">
              Cooking Skill
            </label>
            <select
              id="skill"
              value={cookingSkillLevel}
              onChange={(event) => setCookingSkillLevel(event.target.value)}
              className="min-h-12 w-full"
            >
              <option value="">Select skill level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>
      </section>

      <section className="settings-section space-y-4 p-4">
        <div className="space-y-1">
          <p className="app-kicker">Taste profile</p>
          <h3 className="text-[22px] font-semibold tracking-tight text-[color:var(--text)]">What you naturally reach for</h3>
          <p className="text-[15px] leading-6 text-[color:var(--muted)]">
            Give Chef the flavor instincts and ingredient patterns that already feel like you.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="favoriteCuisines" className="text-[15px] font-medium text-[color:var(--text)]">
              Favorite Cuisines
            </label>
            <input
              id="favoriteCuisines"
              value={favoriteCuisinesInput}
              onChange={(event) => setFavoriteCuisinesInput(event.target.value)}
              className="settings-field min-h-12 w-full"
              placeholder="italian, mexican, asian"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="favoriteProteins" className="text-[15px] font-medium text-[color:var(--text)]">
              Favorite Proteins
            </label>
            <input
              id="favoriteProteins"
              value={favoriteProteinsInput}
              onChange={(event) => setFavoriteProteinsInput(event.target.value)}
              className="settings-field min-h-12 w-full"
              placeholder="chicken, salmon, tofu"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="preferredFlavors" className="text-[15px] font-medium text-[color:var(--text)]">
              Preferred Flavors
            </label>
            <input
              id="preferredFlavors"
              value={preferredFlavorsInput}
              onChange={(event) => setPreferredFlavorsInput(event.target.value)}
              className="settings-field min-h-12 w-full"
              placeholder="bright, spicy, herby"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="spiceTolerance" className="text-[15px] font-medium text-[color:var(--text)]">
              Spice Tolerance
            </label>
            <select
              id="spiceTolerance"
              value={spiceTolerance}
              onChange={(event) => setSpiceTolerance(event.target.value)}
              className="settings-field min-h-12 w-full"
            >
              <option value="">Select spice tolerance</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      </section>

      <section className="settings-section space-y-4 p-4">
        <div className="space-y-1">
          <p className="app-kicker">Constraints</p>
          <h3 className="text-[22px] font-semibold tracking-tight text-[color:var(--text)]">Diet, health, and avoid lists</h3>
          <p className="text-[15px] leading-6 text-[color:var(--muted)]">
            Set the edges of the system so suggestions stay practical, comfortable, and aligned with your goals.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="dietTags" className="text-[15px] font-medium text-[color:var(--text)]">
              Diet Tags
            </label>
            <input
              id="dietTags"
              value={dietTagsInput}
              onChange={(event) => setDietTagsInput(event.target.value)}
              className="settings-field min-h-12 w-full"
              placeholder="vegetarian, low-carb, dairy-free"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="healthGoals" className="text-[15px] font-medium text-[color:var(--text)]">
              Health Goals
            </label>
            <input
              id="healthGoals"
              value={healthGoalsInput}
              onChange={(event) => setHealthGoalsInput(event.target.value)}
              className="settings-field min-h-12 w-full"
              placeholder="high protein, lighter dinners, more vegetables"
            />
          </div>

          <div className="space-y-1 lg:col-span-2">
            <label htmlFor="dislikedIngredients" className="text-[15px] font-medium text-[color:var(--text)]">
              Avoid / Disliked Ingredients
            </label>
            <input
              id="dislikedIngredients"
              value={dislikedIngredientsInput}
              onChange={(event) => setDislikedIngredientsInput(event.target.value)}
              className="settings-field min-h-12 w-full"
              placeholder="mushrooms, olives, anchovies"
            />
          </div>
        </div>
      </section>

      <section className="settings-section space-y-4 p-4">
        <div className="space-y-1">
          <p className="app-kicker">Kitchen context</p>
          <h3 className="text-[22px] font-semibold tracking-tight text-[color:var(--text)]">What is usually in your kitchen</h3>
          <p className="text-[15px] leading-6 text-[color:var(--muted)]">
            Pantry context helps Chef make suggestions that fit the way you actually stock and cook.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="pantryStaples" className="text-[15px] font-medium text-[color:var(--text)]">
              Pantry Staples
            </label>
            <input
              id="pantryStaples"
              value={pantryStaplesInput}
              onChange={(event) => setPantryStaplesInput(event.target.value)}
              className="settings-field min-h-12 w-full"
              placeholder="garlic, lemon, rice, olive oil"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="pantryConfidentStaples" className="text-[15px] font-medium text-[color:var(--text)]">
              Always stocked
            </label>
            <input
              id="pantryConfidentStaples"
              value={pantryConfidentInput}
              onChange={(event) => setPantryConfidentInput(event.target.value)}
              className="settings-field min-h-12 w-full"
              placeholder="olive oil, kosher salt, black pepper"
            />
          </div>

          <div className="space-y-1 lg:col-span-2">
            <label htmlFor="tasteNotes" className="text-[15px] font-medium text-[color:var(--text)]">
              Notes for Chef
            </label>
            <textarea
              id="tasteNotes"
              value={tasteNotes}
              onChange={(event) => setTasteNotes(event.target.value)}
              className="settings-field min-h-28 w-full"
              placeholder="I like bright, fresh dinners with lots of herbs. Keep weeknight recipes practical."
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {message ? <p className="text-sm text-green-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
        <Button onClick={handleSave} disabled={saving} className="min-h-12 w-full sm:w-auto">
          {saving ? "Saving..." : "Save Kitchen Profile"}
        </Button>
      </div>
    </div>
  );
}

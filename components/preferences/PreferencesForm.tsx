"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/Button";

type PreferencesFormProps = {
  ownerId: string;
  initialPreferredUnits: "metric" | "imperial";
  initialSkill: string;
  initialDietTags: string[];
};

export function PreferencesForm({
  ownerId,
  initialPreferredUnits,
  initialSkill,
  initialDietTags,
}: PreferencesFormProps) {
  const [preferredUnits, setPreferredUnits] = useState<"metric" | "imperial">(initialPreferredUnits);
  const [cookingSkillLevel, setCookingSkillLevel] = useState(initialSkill);
  const [dietTagsInput, setDietTagsInput] = useState(initialDietTags.join(", "));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    const commonDietTags = dietTagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const { error: upsertError } = await supabase.from("user_preferences").upsert(
      {
        owner_id: ownerId,
        preferred_units: preferredUnits,
        cooking_skill_level: cookingSkillLevel.trim() || null,
        common_diet_tags: commonDietTags.length > 0 ? commonDietTags : null,
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
    <div className="saas-card space-y-4 p-5">
      <div className="space-y-1">
        <p className="text-[16px] font-medium text-[color:var(--text)]">Units</p>
        <div className="flex gap-2">
          <Button
            onClick={() => setPreferredUnits("metric")}
            variant={preferredUnits === "metric" ? "primary" : "secondary"}
            className="min-h-11"
          >
            Metric
          </Button>
          <Button
            onClick={() => setPreferredUnits("imperial")}
            variant={preferredUnits === "imperial" ? "primary" : "secondary"}
            className="min-h-11"
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

      <div className="space-y-1">
        <label htmlFor="dietTags" className="text-[15px] font-medium text-[color:var(--text)]">
          Diet Tags (comma separated)
        </label>
        <input
          id="dietTags"
          value={dietTagsInput}
          onChange={(event) => setDietTagsInput(event.target.value)}
          className="min-h-12 w-full"
          placeholder="vegetarian, low-carb, dairy-free"
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="min-h-12 w-full"
      >
        {saving ? "Saving..." : "Save Preferences"}
      </Button>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

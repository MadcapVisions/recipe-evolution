"use client";

import {
  readCanonicalIngredients,
  readCanonicalSteps,
  type CanonicalIngredient as IngredientItem,
  type CanonicalStep as StepItem,
} from "@/lib/recipes/canonicalRecipe";

export type { IngredientItem, StepItem };

export type RecipeRow = {
  id: string;
  title: string;
  best_version_id?: string | null;
};

export type RecipeListItem = {
  id: string;
  title: string;
  is_favorite?: boolean | null;
  tags?: string[] | null;
};

export type TimelineVersion = {
  id: string;
  version_number: number;
  version_label: string | null;
  change_summary?: string | null;
  created_at: string;
};

export type VersionRow = {
  id: string;
  recipe_id: string;
  version_number: number;
  version_label: string | null;
  change_summary: string | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  canonical_ingredients: unknown;
  canonical_steps: unknown;
  created_at: string;
};

export type RecipeVisibilityStateRow = {
  recipe_id: string;
  state: "hidden" | "archived";
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

export type SuggestedChange = {
  instruction: string;
  explanation: string | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
};

export const normalizeSteps = readCanonicalSteps;
export const normalizeIngredients = readCanonicalIngredients;

export const versionLabel = (version: { version_label: string | null; version_number: number }) =>
  version.version_label?.trim().length ? version.version_label : "Original Recipe";

const toTitleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

export const buildVersionLabelFromInstruction = (instruction: string) => {
  const normalized = instruction.trim().toLowerCase();
  if (!normalized) return "AI Update";
  if (normalized.includes("remix")) return "Remix Version";
  if (normalized.includes("vegetarian")) return "Vegetarian Version";
  if (normalized.includes("gluten")) return "Gluten-Free Version";
  if (normalized.includes("protein")) return "High Protein Version";
  if (normalized.includes("spicy")) return "Spicy Version";
  if (normalized.includes("faster") || normalized.includes("quick")) return "Faster Version";
  if (normalized.includes("calorie")) return "Lower Calorie Version";
  if (normalized.includes("flavor")) return "Flavor Boost Version";

  const cleaned = normalized
    .replace(/^make\s+(this|the)\s+recipe\s+/, "")
    .replace(/^how\s+could\s+we\s+/, "")
    .replace(/^can\s+you\s+/, "")
    .replace(/^please\s+/, "")
    .replace(/[?.!]/g, " ")
    .trim();
  const firstWords = cleaned.split(/\s+/).filter(Boolean).slice(0, 4).join(" ");
  return `${toTitleCase(firstWords || "AI Update")} Version`;
};

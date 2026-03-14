import { deriveStepDetails } from "./canonicalEnrichment";

export type CanonicalIngredient = {
  name: string;
};

export type CanonicalStep = {
  text: string;
  timer_seconds?: number;
};

export function readCanonicalIngredients(value: unknown): CanonicalIngredient[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const maybeName = (item as Record<string, unknown>).name;
      if (typeof maybeName !== "string" || maybeName.trim().length === 0) {
        return null;
      }
      return { name: maybeName.trim() };
    })
    .filter((item): item is CanonicalIngredient => item !== null);
}

export function readCanonicalSteps(value: unknown): CanonicalStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const maybeText = (item as Record<string, unknown>).text;
      const maybeTimer = (item as Record<string, unknown>).timer_seconds;
      if (typeof maybeText !== "string" || maybeText.trim().length === 0) {
        return null;
      }

      const step: CanonicalStep = { text: maybeText.trim() };
      const derived = deriveStepDetails(maybeText);
      const timer = typeof maybeTimer === "number" ? maybeTimer : derived.timer_seconds;

      if (typeof timer === "number") {
        step.timer_seconds = timer;
      }

      return step;
    })
    .filter((item): item is CanonicalStep => item !== null);
}

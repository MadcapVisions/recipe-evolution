/**
 * Normalizes a raw AI step array into the canonical AIPipelineStep shape.
 * Fills in missing methodTags via inferMethodTag.
 */

import { inferMethodTag } from "./inferMethodTag";

export type NormalizedStep = {
  text: string;
  methodTag: string | null;
  estimatedMinutes: number | null;
  temperatureC: number | null;
};

export function normalizeAISteps(
  steps: Array<{
    text: string;
    methodTag?: string | null;
    estimatedMinutes?: number | null;
    temperatureC?: number | null;
  }>
): NormalizedStep[] {
  return steps.map((step) => ({
    text: step.text,
    methodTag: step.methodTag ?? inferMethodTag(step.text) ?? null,
    estimatedMinutes: step.estimatedMinutes ?? null,
    temperatureC: step.temperatureC ?? null,
  }));
}

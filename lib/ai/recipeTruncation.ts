import type { RecipeNormalizationResult } from "./recipeNormalization";

function countDelimiters(text: string, openChar: string, closeChar: string) {
  let balance = 0;
  for (const char of text) {
    if (char === openChar) {
      balance += 1;
    } else if (char === closeChar) {
      balance -= 1;
    }
  }
  return balance;
}

function extractWrappedTextCandidate(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const raw = parsed as Record<string, unknown>;
  for (const key of ["text", "content", "output_text", "response", "result"] as const) {
    const candidate = raw[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return null;
}

export function isLikelyTruncatedRecipePayload(input: {
  resultText: string;
  finishReason?: string | null;
  parsed: unknown;
  normalized: RecipeNormalizationResult;
}) {
  if (input.normalized.recipe) {
    return false;
  }

  if ((input.finishReason ?? "").toLowerCase() === "length") {
    return true;
  }

  const candidate = extractWrappedTextCandidate(input.parsed) ?? input.resultText;
  const trimmed = candidate.trim();
  if (!trimmed) {
    return false;
  }

  const mentionsRecipeShape =
    trimmed.includes("\"ingredients\"") ||
    trimmed.includes("\"steps\"") ||
    trimmed.includes("\"title\"");
  if (!mentionsRecipeShape) {
    return false;
  }

  const braceBalance = countDelimiters(trimmed, "{", "}");
  const bracketBalance = countDelimiters(trimmed, "[", "]");
  if (braceBalance > 0 || bracketBalance > 0) {
    return true;
  }

  return !trimmed.endsWith("}");
}

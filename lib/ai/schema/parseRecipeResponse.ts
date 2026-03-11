export function parseRecipeResponse(text: string): unknown {
  if (typeof text !== "string" || text.trim().length === 0) {
    return null;
  }

  const direct = text.trim();

  try {
    return JSON.parse(direct);
  } catch {
    // Fall through to fence/substring extraction.
  }

  const withoutFences = direct.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    // Fall through to brace slice extraction.
  }

  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = withoutFences.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(sliced);
    } catch {
      return null;
    }
  }

  return null;
}

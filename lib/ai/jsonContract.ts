export function parseJsonResponse(text: string): unknown {
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

  const lastBrace = withoutFences.lastIndexOf("}");
  if (lastBrace >= 0) {
    let searchPos = 0;
    while (true) {
      const bracePos = withoutFences.indexOf("{", searchPos);
      if (bracePos < 0 || bracePos >= lastBrace) break;
      try {
        return JSON.parse(withoutFences.slice(bracePos, lastBrace + 1));
      } catch {
        searchPos = bracePos + 1;
      }
    }
  }

  return null;
}

export function validateJsonContract<T>(
  parsed: unknown,
  validator: (parsed: unknown) => { value: T | null; error: string | null }
) {
  const validated = validator(parsed);

  if (validated.value == null) {
    throw new Error(validated.error?.trim() || "AI returned JSON that failed contract validation.");
  }

  return validated.value;
}

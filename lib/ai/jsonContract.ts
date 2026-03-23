const JSON_STRING_WRAPPER_KEYS = ["text", "content", "output_text", "response", "result"] as const;
const JSON_TEXT_PART_KEYS = ["text", "output_text", "content"] as const;

function tryParseJsonCandidate(text: string): unknown {
  const direct = text.trim();
  if (!direct) {
    return null;
  }

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

function unwrapJsonStringWrapper(value: unknown, depth = 0): unknown {
  if (depth >= 3 || !value || typeof value !== "object" || Array.isArray(value)) {
    if (depth < 3 && Array.isArray(value)) {
      for (const item of value) {
        const unwrapped = unwrapJsonStringWrapper(item, depth + 1);
        if (unwrapped !== item) {
          return unwrapped;
        }
      }
    }
    return value;
  }

  const raw = value as Record<string, unknown>;
  for (const key of JSON_STRING_WRAPPER_KEYS) {
    const candidate = raw[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      const parsedCandidate = tryParseJsonCandidate(candidate);
      if (parsedCandidate != null) {
        return unwrapJsonStringWrapper(parsedCandidate, depth + 1);
      }
    }

    if (candidate && typeof candidate === "object") {
      const unwrappedCandidate = unwrapJsonStringWrapper(candidate, depth + 1);
      if (unwrappedCandidate !== candidate) {
        return unwrappedCandidate;
      }
    }
  }

  for (const key of JSON_TEXT_PART_KEYS) {
    const candidate = raw[key];
    if (!Array.isArray(candidate)) {
      continue;
    }

    for (const item of candidate) {
      const unwrappedItem = unwrapJsonStringWrapper(item, depth + 1);
      if (unwrappedItem !== item) {
        return unwrappedItem;
      }
    }
  }

  return value;
}

export function parseJsonResponse(text: string): unknown {
  if (typeof text !== "string" || text.trim().length === 0) {
    return null;
  }

  const parsed = tryParseJsonCandidate(text);
  return parsed == null ? null : unwrapJsonStringWrapper(parsed);
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

type StructuredRecipeResponse = {
  title: string;
  description?: string | null;
  ingredients: Array<{ name?: string }>;
  steps: Array<{ text?: string }>;
};

type StructuredRecipeLegacyResponse = {
  data?: {
    title?: string;
    description?: string | null;
    ingredients_json?: Array<{ name?: string }>;
    steps_json?: Array<{ text?: string }>;
  };
  meta?: unknown;
};

export type StructuredRecipeResult = {
  title: string;
  description: string;
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
  meta?: unknown;
};

async function extractRouteErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown; error?: unknown };
    if (typeof payload.message === "string" && payload.message.length > 0) {
      return payload.message;
    }
    if (typeof payload.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  } catch {
    // fall through
  }

  return "Recipe parsing failed. Please edit manually.";
}

function normalizeStructuredResult(data: StructuredRecipeResponse | StructuredRecipeLegacyResponse | undefined): StructuredRecipeResult | null {
  if (!data) {
    return null;
  }

  if ("title" in data && typeof data.title === "string" && Array.isArray(data.ingredients) && Array.isArray(data.steps)) {
    return {
      title: data.title,
      description: data.description ?? "",
      ingredients: data.ingredients.map((item) => ({ name: item.name ?? "" })),
      steps: data.steps.map((item) => ({ text: item.text ?? "" })),
    };
  }

  const legacy = data as StructuredRecipeLegacyResponse;

  if (
    legacy.data?.title &&
    Array.isArray(legacy.data.ingredients_json) &&
    Array.isArray(legacy.data.steps_json)
  ) {
    return {
      title: legacy.data.title,
      description: legacy.data.description ?? "",
      ingredients: legacy.data.ingredients_json.map((item: { name?: string }) => ({ name: item.name ?? "" })),
      steps: legacy.data.steps_json.map((item: { text?: string }) => ({ text: item.text ?? "" })),
      meta: legacy.meta,
    };
  }

  return null;
}

export async function structureRecipeFromText(input: { rawText: string; preferredUnits?: string }) {
  const response = await fetch("/api/ai/structure-recipe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rawText: input.rawText,
      preferredUnits: input.preferredUnits,
    }),
  });

  if (!response.ok) {
    throw new Error(await extractRouteErrorMessage(response));
  }

  const data = await response.json();

  if (data?.error) {
    const message =
      typeof data?.message === "string"
        ? data.message
        : typeof data?.error === "string"
          ? data.error
          : "Recipe parsing failed. Please edit manually.";
    throw new Error(message);
  }

  const normalized = normalizeStructuredResult(data);
  if (!normalized) {
    throw new Error("Recipe parsing failed. Please edit manually.");
  }

  return normalized;
}

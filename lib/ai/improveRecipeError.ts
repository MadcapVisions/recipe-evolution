export function classifyImproveRecipeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (
    message.includes("All AI model attempts failed") ||
    message.includes("OpenRouter") ||
    message.includes("AI returned invalid JSON")
  ) {
    return {
      status: 503,
      message: "Recipe update AI was temporarily unavailable. Please try again.",
    };
  }

  if (message.includes("Failed to load AI task settings")) {
    return {
      status: 503,
      message: "Recipe update settings could not be loaded. Please try again.",
    };
  }

  if (message.includes("Recipe improvement AI task is disabled")) {
    return {
      status: 503,
      message: "Recipe updates are temporarily unavailable.",
    };
  }

  return {
    status: 500,
    message: "AI improvement failed. Please try again.",
  };
}

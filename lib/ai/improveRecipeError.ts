export function classifyImproveRecipeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (
    message.includes("All AI model attempts failed") ||
    message.includes("OpenRouter") ||
    message.includes("AI returned invalid JSON") ||
    message.includes("AI returned an invalid structured recipe format") ||
    message.includes("At least one ingredient is required") ||
    message.includes("At least one step is required")
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

  if (
    message.includes('Required ingredient "') ||
    message.includes("Recipe is missing required ingredient") ||
    message.includes("Instruction not reflected in result")
  ) {
    return {
      status: 422,
      message: "Recipe update could not satisfy the ingredient change you requested.",
    };
  }

  return {
    status: 500,
    message: "AI improvement failed. Please try again.",
  };
}

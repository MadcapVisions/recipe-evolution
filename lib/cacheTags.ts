export function getRecipeLibraryTag(userId: string) {
  return `recipe-library:${userId}`;
}

export function getRecipeSidebarTag(userId: string) {
  return `recipe-sidebar:${userId}`;
}

export function getRecipeDetailTag(userId: string, recipeId: string, versionId: string) {
  return `recipe-detail:${userId}:${recipeId}:${versionId}`;
}

export function getRecipeTimelineTag(recipeId: string) {
  return `recipe-timeline:${recipeId}`;
}

export function getRecipePhotosTag(versionId: string) {
  return `recipe-photos:${versionId}`;
}

export function getRecipeSummaryTag(recipeId: string) {
  return `recipe-summary:${recipeId}`;
}

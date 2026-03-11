import { expect, test } from "@playwright/test";
import { cleanupRecipesByTitlePrefix, hasTestCredentials } from "./helpers/testAccount";
import { signInAsTestUser } from "./helpers/auth";

test.describe("authenticated recipe flow", () => {
  const titlePrefix = "E2E Recipe";
  test.skip(!hasTestCredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env.local to enable authenticated e2e.");

  test.beforeEach(async () => {
    await cleanupRecipesByTitlePrefix(titlePrefix);
  });

  test.afterEach(async () => {
    await cleanupRecipesByTitlePrefix(titlePrefix);
  });

  test("user can create a recipe, add the first version, and view recipe detail", async ({ page }) => {
    const uniqueSuffix = Date.now().toString();
    const title = `${titlePrefix} ${uniqueSuffix}`;
    const ingredientOne = `1 lb chicken thighs ${uniqueSuffix}`;
    const ingredientTwo = `2 cloves garlic ${uniqueSuffix}`;
    const stepOne = `Season the chicken ${uniqueSuffix}`;
    const stepTwo = `Roast until cooked through ${uniqueSuffix}`;

    await signInAsTestUser(page);
    await expect(page.getByRole("heading", { name: "What do you want to cook today?" })).toBeVisible();

    await page.goto("/recipes/new");
    await expect(page.getByRole("heading", { name: "New Recipe" })).toBeVisible();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description").fill("Playwright recipe coverage");
    await page.getByLabel("Tags (comma separated)").fill("e2e,playwright");
    await page.getByRole("button", { name: "Create Recipe" }).click();

    await expect(page).toHaveURL(/\/recipes\/.+\/versions\/new$/);
    await expect(page.getByRole("heading", { name: `New Version: ${title}` })).toBeVisible();

    await page.getByLabel("Servings").fill("4");
    await page.getByLabel("Difficulty").fill("Easy");
    await page.getByLabel("Prep time (min)").fill("15");
    await page.getByLabel("Cook time (min)").fill("30");
    await page.getByLabel("Ingredients (one per line)").fill(`${ingredientOne}\n${ingredientTwo}`);
    await page.getByLabel("Steps (one per line)").fill(`${stepOne}\n${stepTwo}`);
    await page.getByLabel("Notes").fill("Created by Playwright");
    await page.getByRole("button", { name: "Create Version" }).click();

    await expect(page).toHaveURL(/\/recipes\/.+\/versions\/.+$/);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByText(ingredientOne)).toBeVisible();
    await expect(page.getByText(ingredientTwo)).toBeVisible();
    await expect(page.getByText(stepOne)).toBeVisible();
    await expect(page.getByText(stepTwo)).toBeVisible();
  });
});

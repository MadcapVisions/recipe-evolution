import { expect, test } from "@playwright/test";
import { cleanupRecipesByTitlePrefix, createRecipeWithVersion } from "./helpers/testAccount";
import { signInAsTestUser } from "./helpers/auth";

test.describe("recipes browser", () => {
  const titlePrefix = "E2E Browser";

  test.beforeEach(async () => {
    await cleanupRecipesByTitlePrefix(titlePrefix);
  });

  test.afterEach(async () => {
    await cleanupRecipesByTitlePrefix(titlePrefix);
  });

  test("hidden and archived recipe states persist across refresh", async ({ page }) => {
    const hiddenTitle = `${titlePrefix} Hidden ${Date.now()}`;
    const archivedTitle = `${titlePrefix} Archived ${Date.now()}`;

    await createRecipeWithVersion({
      title: hiddenTitle,
      ingredients: ["hidden ingredient"],
      steps: ["hidden step"],
    });
    await createRecipeWithVersion({
      title: archivedTitle,
      ingredients: ["archived ingredient"],
      steps: ["archived step"],
    });

    await signInAsTestUser(page);

    await page.goto("/recipes");
    await expect(page.getByRole("heading", { name: "Recipe library" })).toBeVisible();

    await page.locator("article").filter({ hasText: hiddenTitle }).first().getByRole("button", { name: "Hide" }).click();
    await expect(page.locator("article").filter({ hasText: hiddenTitle })).toHaveCount(0);

    await page
      .locator("article")
      .filter({ hasText: archivedTitle })
      .first()
      .getByRole("button", { name: "Archive" })
      .click();
    await expect(page.locator("article").filter({ hasText: archivedTitle })).toHaveCount(0);

    await page.getByRole("button", { name: "hidden" }).click();
    await expect(page.locator("article").filter({ hasText: hiddenTitle }).first()).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "hidden" }).click();
    await expect(page.locator("article").filter({ hasText: hiddenTitle }).first()).toBeVisible();
    await page.locator("article").filter({ hasText: hiddenTitle }).first().getByRole("button", { name: "Unhide" }).click();

    await page.getByRole("button", { name: "archived" }).click();
    await expect(page.locator("article").filter({ hasText: archivedTitle }).first()).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "archived" }).click();
    await expect(page.locator("article").filter({ hasText: archivedTitle }).first()).toBeVisible();
    await page
      .locator("article")
      .filter({ hasText: archivedTitle })
      .first()
      .getByRole("button", { name: "Unarchive" })
      .click();

    await page.getByRole("button", { name: "active" }).click();
    await expect(page.locator("article").filter({ hasText: hiddenTitle }).first()).toBeVisible();
    await expect(page.locator("article").filter({ hasText: archivedTitle }).first()).toBeVisible();
  });
});

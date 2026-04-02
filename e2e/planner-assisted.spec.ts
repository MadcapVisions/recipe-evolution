import { expect, test } from "@playwright/test";
import {
  cleanupPlannerEntriesForE2E,
  cleanupRecipesByTitlePrefix,
  createRecipeWithVersion,
  hasServiceRole,
  hasTestCredentials,
  setPantryStaplesForE2E,
  setFeatureFlagForE2E,
} from "./helpers/testAccount";
import { signInAsTestUser } from "./helpers/auth";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("planner assisted canary", () => {
  const titlePrefix = "E2E Planner";
  const assistedFlag = "planner_assisted_v1";

  test.skip(!hasTestCredentials() || !hasServiceRole(), "Set authenticated e2e credentials and service role env to enable planner assisted coverage.");

  test.beforeEach(async () => {
    await cleanupRecipesByTitlePrefix(titlePrefix);
    await cleanupPlannerEntriesForE2E();
    await setPantryStaplesForE2E({ pantryStaples: [] });
  });

  test.afterEach(async () => {
    await setFeatureFlagForE2E(assistedFlag, false);
    await cleanupPlannerEntriesForE2E();
    await setPantryStaplesForE2E({ pantryStaples: [] });
    await cleanupRecipesByTitlePrefix(titlePrefix);
  });

  test("flag on: planner loop supports regeneration, accepted apply, derived grocery, and manual fallback", async ({ page }) => {
    const suffix = Date.now().toString();
    const titles = [
      `${titlePrefix} Lemon Chicken ${suffix}`,
      `${titlePrefix} Weeknight Pasta ${suffix}`,
      `${titlePrefix} Bean Tacos ${suffix}`,
      `${titlePrefix} Simple Soup ${suffix}`,
      `${titlePrefix} Manual Add ${suffix}`,
    ];

    await setPantryStaplesForE2E({ pantryStaples: ["olive oil"] });

    await createRecipeWithVersion({
      title: titles[0],
      ingredients: ["1 tbsp olive oil", "1 onion", "1 lb chicken thighs"],
      steps: ["Cook the chicken and onions."],
      chefScore: 92,
    });
    await createRecipeWithVersion({
      title: titles[1],
      ingredients: ["1 tbsp olive oil", "1 onion", "8 oz pasta"],
      steps: ["Boil pasta and saute onion."],
      chefScore: 90,
    });
    await createRecipeWithVersion({
      title: titles[2],
      ingredients: ["1 tbsp olive oil", "1 onion", "1 can beans"],
      steps: ["Warm beans with onion."],
      chefScore: 88,
    });
    await createRecipeWithVersion({
      title: titles[3],
      ingredients: ["1 tbsp olive oil", "1 onion", "2 carrots"],
      steps: ["Simmer soup."],
      chefScore: 86,
    });
    await createRecipeWithVersion({
      title: titles[4],
      ingredients: ["1 tbsp olive oil", "1 onion", "1 lemon"],
      steps: ["Cook and finish with lemon."],
      chefScore: 84,
    });

    await setFeatureFlagForE2E(assistedFlag, true);
    await signInAsTestUser(page);
    await page.goto("/planner");

    await expect(page.getByRole("heading", { name: "Plan 3 dinners for me" })).toBeVisible();
    await page.getByRole("button", { name: "Groceries" }).click();
    await expect(page.getByText("Accept a weekly plan to generate a grocery list from it.")).toBeVisible();

    await page.getByRole("button", { name: "Week", exact: true }).click();
    const assistedCards = page.locator('div.rounded-\\[18px\\]').filter({ has: page.getByRole("button", { name: "Regenerate this night" }) });
    await expect(assistedCards.first()).toBeVisible();
    const firstCard = assistedCards.first();
    const initialCardTitle = (await firstCard.locator("p.text-\\[17px\\]").first().textContent())?.trim() ?? "";

    await firstCard.getByRole("button", { name: "Regenerate this night" }).click();
    await expect
      .poll(async () => {
        const nextTitle = ((await firstCard.locator("p.text-\\[17px\\]").first().textContent()) ?? "").trim();
        const feedback = await firstCard.textContent();
        if (nextTitle && nextTitle !== initialCardTitle) {
          return "replaced";
        }
        if ((feedback ?? "").includes("No better option found for this night.")) {
          return "kept";
        }
        return "pending";
      })
      .not.toBe("pending");

    await page.getByRole("button", { name: "Apply suggestion" }).click();
    await expect(page.getByText("Accepted week saved. Grocery is now derived from this plan.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Groceries" })).toBeVisible();

    await expect(page.getByText("Generated from your accepted weekly plan")).toBeVisible();
    await expect(page.getByText("Overlapping ingredients merged")).toBeVisible();
    await expect(page.getByText("Pantry staples omitted")).toBeVisible();
    await expect(page.getByText("Already stocked")).toBeVisible();
    await expect(page.getByText(/items to shop/)).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Groceries" }).click();
    await expect(page.getByText("Generated from your accepted weekly plan")).toBeVisible();

    await page.getByRole("button", { name: "Week", exact: true }).click();
    await page.getByRole("button", { name: titles[4] }).click();
    await page.getByRole("button", { name: "Assign selected recipe" }).first().click();
    await expect(page.getByRole("button", { name: new RegExp(`In plan.*${escapeRegExp(titles[4])}`) })).toBeVisible();
  });

  test("flag off: planner falls back to manual-only flow", async ({ page }) => {
    const suffix = Date.now().toString();
    await createRecipeWithVersion({
      title: `${titlePrefix} Manual ${suffix}`,
      ingredients: ["1 onion"],
      steps: ["Cook dinner"],
    });

    await setFeatureFlagForE2E(assistedFlag, false);
    await signInAsTestUser(page);
    await page.goto("/planner");

    await expect(page.getByRole("heading", { name: "Plan 3 dinners for me" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "One workspace, one planning mode at a time." })).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";
import { signInAsTestUser } from "./helpers/auth";
import {
  cleanupRecipesByTitlePrefix,
  createRecipeWithVersion,
  hasTestCredentials,
} from "./helpers/testAccount";

test.describe("AI-assisted recipe flows", () => {
  const titlePrefix = "E2E AI Flow";

  test.skip(!hasTestCredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env.local to enable authenticated e2e.");

  test.beforeEach(async () => {
    await cleanupRecipesByTitlePrefix(titlePrefix);
  });

  test.afterEach(async () => {
    await cleanupRecipesByTitlePrefix(titlePrefix);
  });

  test("user can import a pasted recipe with structured AI output", async ({ page }) => {
    await signInAsTestUser(page);

    await page.route("**/api/ai/structure-recipe", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            recipe: {
              title: `${titlePrefix} Imported Pasta`,
              description: "Structured from pasted recipe text.",
              tags: null,
              servings: null,
              prep_time_min: null,
              cook_time_min: null,
              difficulty: null,
              ingredients: [{ name: "12 oz pasta" }, { name: "2 cloves garlic" }],
              steps: [{ text: "Boil the pasta." }, { text: "Saute the garlic and toss everything together." }],
              notes: null,
              change_log: null,
              ai_metadata_json: null,
            },
            explanation: null,
            meta: {
              purpose: "structure",
              source: "ai",
              provider: "mock-provider",
              model: "mock-model",
              cached: false,
              input_hash: "mock-hash",
              created_at: new Date().toISOString(),
            },
          },
        }),
      });
    });

    await page.goto("/import");
    await expect(page.getByRole("heading", { name: "Import a recipe" })).toBeVisible();
    await page.getByLabel("Paste recipe text").fill("Pasta, garlic, boil, toss.");
    await page.getByRole("button", { name: "Structure with AI" }).click();

    await expect(page.getByLabel("Title")).toHaveValue(`${titlePrefix} Imported Pasta`);
    await page.getByRole("button", { name: "Save Recipe" }).click();

    await expect(page).toHaveURL(/\/recipes\/.+$/);
    await expect(page.getByRole("heading", { name: `${titlePrefix} Imported Pasta`, exact: true })).toBeVisible();
    await expect(page.getByText("12 oz pasta")).toBeVisible();
    await expect(page.getByText("Boil the pasta.")).toBeVisible();
  });

  test("user can chat in HomeHub and create a recipe from the reply", async ({ page }) => {
    await signInAsTestUser(page);

    await page.route("**/api/ai/home", async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as { mode?: string };

      if (body.mode === "chef_chat") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "Make a bright lemon chicken rice bowl with herbs and cucumber for freshness.",
          }),
        });
        return;
      }

      if (body.mode === "idea_recipe") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            result: {
              recipe: {
                title: `${titlePrefix} Lemon Chicken Bowl`,
                description: "A bright chicken and rice bowl with lemon and herbs.",
                tags: null,
                servings: 4,
                prep_time_min: 15,
                cook_time_min: 20,
                difficulty: "Easy",
                ingredients: [
                  { name: "1 lb chicken thighs" },
                  { name: "2 cups cooked rice" },
                  { name: "1 lemon" },
                ],
                steps: [
                  { text: "Cook the chicken with lemon and seasoning." },
                  { text: "Serve over rice and finish with herbs." },
                ],
                notes: null,
                change_log: null,
                ai_metadata_json: null,
              },
              explanation: null,
              meta: {
                purpose: "home_recipe",
                source: "ai",
                provider: "mock-provider",
                model: "mock-model",
                cached: false,
                input_hash: "mock-hash",
                created_at: new Date().toISOString(),
              },
            },
          }),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "What do you want to cook today?" })).toBeVisible();
    await page.getByPlaceholder("Describe the dish, ingredients, or constraint...").fill("I want a fast lemon chicken dinner");
    await page.getByRole("button", { name: "Ask Chef" }).click();

    await expect(page.getByText("Make a bright lemon chicken rice bowl with herbs and cucumber for freshness.")).toBeVisible();
    await page.getByRole("button", { name: "Create recipe from this reply" }).click();

    await expect(page).toHaveURL(/\/recipes\/.+\/versions\/.+$/);
    await expect(page.getByRole("heading", { name: `${titlePrefix} Lemon Chicken Bowl`, exact: true })).toBeVisible();
    await expect(page.getByText("1 lb chicken thighs")).toBeVisible();
    await expect(page.getByText("Serve over rice and finish with herbs.")).toBeVisible();
  });

  test("user can ask chef on a recipe detail page and apply the suggested change as a new version", async ({ page }) => {
    const created = await createRecipeWithVersion({
      title: `${titlePrefix} Base Chili`,
      ingredients: ["1 lb ground turkey", "1 can beans"],
      steps: ["Brown the turkey.", "Simmer with beans."],
    });

    await signInAsTestUser(page);

    await page.route("**/api/ai/chef-chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Add chipotle, toasted cumin, and a little lime to make the chili spicier and brighter.",
          suggestion: {
            recipe: {
              title: `${titlePrefix} Base Chili`,
              description: null,
              tags: null,
              notes: null,
              change_log: null,
              ai_metadata_json: null,
              servings: 4,
              prep_time_min: 15,
              cook_time_min: 35,
              difficulty: "Easy",
              ingredients: [
                { name: "1 lb ground turkey" },
                { name: "1 can beans" },
                { name: "1 chipotle pepper in adobo" },
              ],
              steps: [
                { text: "Brown the turkey with toasted cumin." },
                { text: "Simmer with beans and chipotle, then finish with lime." },
              ],
            },
            explanation: "Boosted heat and brightness with chipotle, cumin, and lime.",
            meta: {
              purpose: "refine",
              source: "ai",
              provider: "mock-provider",
              model: "mock-model",
              cached: false,
              input_hash: "mock-hash",
              created_at: new Date().toISOString(),
            },
          },
        }),
      });
    });

    await page.goto(`/recipes/${created.recipeId}/versions/${created.versionId}`);
    await expect(page.getByRole("heading", { name: `${titlePrefix} Base Chili`, exact: true })).toBeVisible();
    await page.getByPlaceholder("Ask the chef anything about this recipe...").fill("Make it spicier");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText("Add chipotle, toasted cumin, and a little lime to make the chili spicier and brighter.")).toBeVisible();
    await page.getByRole("button", { name: "Apply Change and Create Version" }).click();

    await expect(page).toHaveURL(/\/recipes\/.+\/versions\/.+$/);
    await expect(page.getByText("Boosted heat and brightness with chipotle, cumin, and lime.")).toBeVisible();
    await expect(page.getByText("1 chipotle pepper in adobo")).toBeVisible();
    await expect(page.getByText("Brown the turkey with toasted cumin.")).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";
import { signInAsTestUser } from "./helpers/auth";

test("user can sign out and protected routes redirect back to sign-in", async ({ page }) => {
  await signInAsTestUser(page);
  await page.getByRole("link", { name: "Open settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("button", { name: "Sign Out" }).click();

  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
});

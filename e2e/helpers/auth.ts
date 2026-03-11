import { expect, type Page } from "@playwright/test";
import { getTestCredentials } from "./testAccount";

export async function signInAsTestUser(page: Page) {
  await page.goto("/dashboard");

  if (page.url().match(/\/dashboard$/)) {
    return;
  }

  const { email, password } = getTestCredentials();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

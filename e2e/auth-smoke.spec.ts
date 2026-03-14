import { expect, test } from "@playwright/test";

test("unauthenticated root renders the public landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "AI Sous Chef for Home Cooking" })).toBeVisible();
});

test("dashboard redirects signed-out users to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
});

test("sign-in screen renders core controls", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("sign-up screen renders core controls", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByLabel("First name")).toBeVisible();
  await expect(page.getByLabel("Last name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});

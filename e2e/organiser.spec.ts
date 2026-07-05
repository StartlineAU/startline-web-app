import { test, expect } from "@playwright/test";
import { organiserLogin } from "./helpers";

test.describe("organiser login", () => {
  test("signs in via modal and redirects to dashboard", async ({ page }) => {
    await organiserLogin(page);

    await expect(page.locator("h1")).toContainText("Hi there");
  });

  test("landing page renders without sign-in form", async ({ page }) => {
    await page.goto("/organiser");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /organiser/i })).toBeVisible();
    await expect(page.getByText(/sign in to your user account/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /go to startline/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /go to dashboard/i })).toBeVisible();
  });
});

test.describe("organiser dashboard", () => {
  test("dashboard shows stats and events after login", async ({ page }) => {
    await organiserLogin(page);

    await expect(page.locator("h1")).toContainText("Hi there");
    await expect(page.getByText("Live now")).toBeVisible();
    await expect(page.getByText("Registrations")).toBeVisible();
    await expect(page.getByText("Total events")).toBeVisible();
    await expect(page.getByText("Your upcoming events")).toBeVisible();
  });

  test("dashboard has view my events button", async ({ page }) => {
    await organiserLogin(page);

    await expect(page.getByRole("link", { name: /view my events/i })).toBeVisible();
  });
});

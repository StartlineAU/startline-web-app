import { test, expect } from "@playwright/test";
import { organiserLogin } from "./helpers";

test.describe("organiser login", () => {
  test("dev bypass login redirects to dashboard", async ({ page }) => {
    await page.goto("/organiser");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("Let");
    await expect(page.getByText("Organiser Portal", { exact: true })).toBeVisible();

    await page.getByPlaceholder(/events@/i).fill("test.organiser@startlineau.com");
    await page.locator('input[type="password"]').first().fill("Password123!");
    await page.getByRole("button", { name: /sign in to portal/i }).click();

    await page.waitForURL("**/organiser/dashboard**", { timeout: 30000 });
    await expect(page.locator("h1")).toContainText("Hi there");
  });

  test("login page renders all form elements", async ({ page }) => {
    await page.goto("/organiser");
    await page.waitForLoadState("networkidle");

    await expect(page.getByPlaceholder(/events@/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in to portal/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /apply/i })).toBeVisible();
  });
});

test.describe("organiser new listing", () => {
  test("date and location step shows location preview placeholder", async ({ page }) => {
    await organiserLogin(page);

    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/Functional Fitness Championship/i).fill("Map Preview Test Event");
    await page.getByRole("button", { name: /^continue$/i }).click();

    await expect(page.getByText(/when and where/i)).toBeVisible();
    await expect(page.getByTestId("location-preview-empty")).toBeVisible();
    await expect(page.getByText(/select an address above to preview the location/i)).toBeVisible();
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

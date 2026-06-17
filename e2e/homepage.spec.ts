import { test, expect } from "@playwright/test";
import { goToHomepage } from "./helpers";

test.describe("homepage", () => {
  test("renders with expected title", async ({ page }) => {
    await goToHomepage(page);
    await expect(page).toHaveTitle(/StartLine/i);
  });

  test("shows main headings and navigation", async ({ page }) => {
    await goToHomepage(page);
    await expect(page.getByRole("link", { name: "EVENTS", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /organiser login/i })).toBeVisible();
  });

  test("event cards or empty state renders", async ({ page }) => {
    await goToHomepage(page);
    const hasCards = await page.locator('[class*="event"]').first().isVisible().catch(() => false);
    const hasContent = await page.locator("text").first().isVisible();
    expect(hasCards || hasContent).toBeTruthy();
  });

  test("navigates to about page", async ({ page }) => {
    await goToHomepage(page);
    await page.getByRole("link", { name: "ABOUT", exact: true }).click();
    await expect(page).toHaveURL(/\/about/);
  });
});

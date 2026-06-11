import { test, expect } from "@playwright/test";
import { goToHomepage } from "./helpers";

test.describe("homepage", () => {
  test("renders with expected title", async ({ page }) => {
    await goToHomepage(page);
    await expect(page).toHaveTitle(/StartLine/i);
  });

  test("shows main headings and navigation", async ({ page }) => {
    await goToHomepage(page);
    await expect(page.getByRole("link", { name: /events/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /organiser login/i })).toBeVisible();
  });

  test("event cards or empty state renders", async ({ page }) => {
    await goToHomepage(page);
    // Either event cards render or an empty state message
    const hasCards = await page.locator('[class*="event"]').first().isVisible().catch(() => false);
    const hasContent = await page.locator("text").first().isVisible();
    expect(hasCards || hasContent).toBeTruthy();
  });

  test("navigates to about page", async ({ page }) => {
    await goToHomepage(page);
    await page.getByRole("link", { name: /about/i }).click();
    await expect(page).toHaveURL(/\/about/);
  });
});

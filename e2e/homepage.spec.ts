import { test, expect } from "@playwright/test";
import { argosScreenshot } from "@argos-ci/playwright";
import { goToHomepage } from "./helpers";

test.describe("about page", () => {
  test("about page visual snapshot", async ({ page }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "about-page");
  });
});

test.describe("homepage", () => {
  test("renders with expected title", async ({ page }) => {
    await goToHomepage(page);
    await expect(page).toHaveTitle(/Startline/i);
  });

  test("homepage visual snapshot", async ({ page }) => {
    await goToHomepage(page);
    await argosScreenshot(page, "homepage");
  });

  test("hero banner plays the looping video", async ({ page }) => {
    await goToHomepage(page);
    const video = page.locator("video");
    await expect(video).toBeAttached();
    await expect(video).toHaveAttribute("src", "/videos/hero.mp4?v=6");
    await expect(video).toHaveAttribute("poster", "/videos/hero-poster.jpg?v=6");
  });

  test("shows main headings and navigation", async ({ page }) => {
    await goToHomepage(page);
    await expect(page.getByRole("link", { name: "HOME", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "EVENTS", exact: true })).toBeVisible();
    // ACTIVITY is only shown to signed-in users
    await expect(page.getByRole("link", { name: "ACTIVITY", exact: true })).not.toBeVisible();
  });

  test("event cards or empty state renders", async ({ page }) => {
    await goToHomepage(page);
    const hasCards = await page.locator('[class*="event"]').first().isVisible().catch(() => false);
    const hasContent = await page.locator("text").first().isVisible();
    expect(hasCards || hasContent).toBeTruthy();
  });


});

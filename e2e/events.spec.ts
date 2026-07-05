import { test, expect } from "@playwright/test";
import { goToHomepage } from "./helpers";

test.describe("events page", () => {
  test("renders events page with content", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    // The events page should have some visible content
    await expect(page.locator("main")).not.toBeEmpty();
  });

  test("search input is present", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    const searchInput = page.getByPlaceholder(/search|location|city/i);
    await expect(searchInput.first()).toBeVisible();
  });

  test("search toolbar is present", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Event", { exact: true })).toBeVisible();
    await expect(page.getByText("Where", { exact: true })).toBeVisible();
  });
});

test.describe("static pages", () => {
  test("contact page renders", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

import { test, expect } from "@playwright/test";
import { goToHomepage } from "./helpers";

test.describe("events page", () => {
  test("renders events page with content", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    // The events page should have some visible content
    const content = page.locator("main, body");
    await expect(content).not.toBeEmpty();
  });

  test("search input is present", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    const searchInput = page.getByPlaceholder(/search|location|city/i);
    await expect(searchInput.first()).toBeVisible();
  });

  test("sidebar filters are present", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/filter|type|state/i).first()).toBeVisible();
  });

  test("list/map view toggle is present", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("view-mode-list")).toBeVisible();
    await expect(page.getByTestId("view-mode-map")).toBeVisible();
  });

  test("switching to map mode shows map container", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("view-mode-map").click();
    await expect(page.getByTestId("events-map")).toBeVisible();
  });

  test("map mode keeps event selection when events load", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("view-mode-map").click();
    const mapContainer = page.getByTestId("events-map");
    await expect(mapContainer).toBeVisible();
    const marker = page.locator(".mapboxgl-marker button").first();
    if (await marker.isVisible()) {
      await marker.click();
      await expect(page.getByText(/more info/i).first()).toBeVisible();
    }
  });
});

test.describe("static pages", () => {
  test("contact page renders", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

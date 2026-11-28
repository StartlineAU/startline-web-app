import { test, expect } from "@playwright/test";

// Refunds have their own page (it was Support). Only a signed-in athlete can
// pick an event, because the list is their own entries.

test("the old Support address lands on Refunds and keeps the event", async ({ page }) => {
  await page.goto("/support?event=seed-event-017");
  await expect(page).toHaveURL(/\/refunds\?event=seed-event-017$/);
  await expect(page.getByRole("heading", { name: "Request a refund" })).toBeVisible();
});

test("a signed-out visitor is asked to sign in before choosing an event", async ({ page }) => {
  await page.goto("/refunds");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Event" })).toHaveCount(0);
});

test("the footer links to Refunds", async ({ page }) => {
  await page.goto("/faq");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Refunds" })).toHaveAttribute("href", "/refunds");
});

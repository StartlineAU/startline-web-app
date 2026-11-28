import { test, expect } from "@playwright/test";

// Refunds have their own page (it was Support). Only a signed-in athlete can
// pick an entry, because the list is the places they raced or paid for.

test("the old Support address lands on Refunds and keeps the event", async ({ page }) => {
  await page.goto("/support?event=seed-event-017");
  await expect(page).toHaveURL(/\/refunds\?event=seed-event-017$/);
  await expect(page.getByRole("heading", { name: "Request a refund" })).toBeVisible();
});

test("the old Support address keeps the entry an Activity link named", async ({ page }) => {
  await page.goto("/support?registration=e2e-some-entry");
  await expect(page).toHaveURL(/\/refunds\?registration=e2e-some-entry$/);
});

test("a signed-out visitor is asked to sign in before choosing an entry", async ({ page }) => {
  await page.goto("/refunds");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Entry" })).toHaveCount(0);
});

test("the footer links to Refunds", async ({ page }) => {
  await page.goto("/faq");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Refunds" })).toHaveAttribute("href", "/refunds");
});

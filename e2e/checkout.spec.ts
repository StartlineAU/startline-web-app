import { test, expect } from "@playwright/test";

async function continueAsGuest(page: import("@playwright/test").Page) {
  const guestBtn = page.getByRole("button", { name: /continue as guest/i });
  if (await guestBtn.isVisible()) {
    await guestBtn.click();
  }
}

test.describe("checkout flow", () => {
  test("event detail page shows Register button for startline events", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    const eventLink = page.locator("a[href*='/events/']").first();
    if (await eventLink.isVisible()) {
      await eventLink.click();
      await page.waitForLoadState("networkidle");

      const registerBtn = page.getByRole("link", { name: /register/i });
      const hasRegister = await registerBtn.isVisible().catch(() => false);
      const hasExternal = await page.locator("a[target='_blank']").first().isVisible().catch(() => false);
      expect(hasRegister || hasExternal).toBeTruthy();
    }
  });

  test("register page shows sign in or guest options when not authenticated", async ({ page }) => {
    await page.goto("/events/seed-event-001/register");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/how would you like to register/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /continue as guest/i })).toBeVisible();
  });

  test("register page loads with registration mode step after guest continue", async ({ page }) => {
    await page.goto("/events/seed-event-001/register");
    await page.waitForLoadState("networkidle");
    await continueAsGuest(page);

    await expect(page.getByText(/who are you registering/i)).toBeVisible();
  });

  test("register page requires details before payment", async ({ page }) => {
    await page.goto("/events/seed-event-001/register");
    await page.waitForLoadState("networkidle");
    await continueAsGuest(page);

    await page.getByRole("button", { name: /I am registering for myself/i }).click();

    const ticketOption = page.locator("button", { hasText: /\$/ }).first();
    if (await ticketOption.isVisible()) {
      await ticketOption.click();
    }

    const continueBtn = page.getByRole("button", { name: /continue/i });
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
      await expect(page.getByText(/please fix the highlighted fields/i)).toBeVisible();
    }
  });

  test("register page shows who are you registering options after guest continue", async ({ page }) => {
    await page.goto("/events/seed-event-001/register");
    await page.waitForLoadState("networkidle");
    await continueAsGuest(page);

    await expect(page.getByText(/who are you registering/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /I am registering for myself/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /I am registering for someone else/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /I am registering for multiple people/i })).toBeVisible();
    await expect(page.getByText(/ticket selection/i)).not.toBeVisible();
  });

  test("register page shows ticket selection after registration mode chosen", async ({ page }) => {
    await page.goto("/events/seed-event-001/register");
    await page.waitForLoadState("networkidle");
    await continueAsGuest(page);

    await page.getByRole("button", { name: /I am registering for myself/i }).click();
    await expect(page.getByText(/ticket selection/i)).toBeVisible();
    await expect(page.getByText(/your details/i)).toBeVisible();
  });

  test("register page shows back to event link", async ({ page }) => {
    await page.goto("/events/seed-event-001/register");
    await page.waitForLoadState("networkidle");
    await continueAsGuest(page);

    await expect(page.getByRole("link", { name: /back to event/i })).toBeVisible();
  });

  test("register page shows fee breakdown when ticket selected", async ({ page }) => {
    await page.goto("/events/seed-event-001/register");
    await page.waitForLoadState("networkidle");
    await continueAsGuest(page);

    await page.getByRole("button", { name: /I am registering for myself/i }).click();

    const ticketOption = page.locator("button", { hasText: /\$/ }).first();
    if (await ticketOption.isVisible()) {
      await ticketOption.click();
      await expect(page.getByText(/order summary/i)).toBeVisible();
      await expect(page.getByText(/total/i)).toBeVisible();
    }
  });
});

test.describe("confirmation page", () => {
  test("renders standalone with confirmation message and links", async ({ page }) => {
    await page.goto("/events/seed-event-001/register/confirmation");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/registration confirmed/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /view event/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /browse more events/i })).toBeVisible();
  });
});

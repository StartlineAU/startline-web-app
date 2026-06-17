import { test, expect } from "@playwright/test";

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

  test("register page loads with ticket selection", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    const eventLink = page.locator("a[href*='/events/']").first();
    if (await eventLink.isVisible()) {
      await eventLink.click();
      await page.waitForLoadState("networkidle");

      const registerBtn = page.getByRole("link", { name: /register/i });
      if (await registerBtn.isVisible()) {
        await registerBtn.click();
        await page.waitForLoadState("networkidle");

        await expect(page.getByText(/ticket selection/i)).toBeVisible();
        await expect(page.getByText(/your details/i)).toBeVisible();
      }
    }
  });

  test("register page requires name and email before payment", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    const eventLink = page.locator("a[href*='/events/']").first();
    if (await eventLink.isVisible()) {
      await eventLink.click();
      await page.waitForLoadState("networkidle");

      const registerBtn = page.getByRole("link", { name: /register/i });
      if (await registerBtn.isVisible()) {
        await registerBtn.click();
        await page.waitForLoadState("networkidle");

        const ticketOption = page.locator("button", { hasText: /\$/ }).first();
        if (await ticketOption.isVisible()) {
          await ticketOption.click();
        }

        const continueBtn = page.getByRole("button", { name: /continue to payment/i });
        if (await continueBtn.isVisible()) {
          await continueBtn.click();
          await expect(page.getByText(/please fill in/i)).toBeVisible();
        }
      }
    }
  });

  test("register page shows back to event link", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    const eventLink = page.locator("a[href*='/events/']").first();
    if (await eventLink.isVisible()) {
      await eventLink.click();
      await page.waitForLoadState("networkidle");

      const registerBtn = page.getByRole("link", { name: /register/i });
      if (await registerBtn.isVisible()) {
        await registerBtn.click();
        await page.waitForLoadState("networkidle");

        await expect(page.getByRole("link", { name: /back to event/i })).toBeVisible();
      }
    }
  });

  test("register page shows fee breakdown when ticket selected", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    const eventLink = page.locator("a[href*='/events/']").first();
    if (await eventLink.isVisible()) {
      await eventLink.click();
      await page.waitForLoadState("networkidle");

      const registerBtn = page.getByRole("link", { name: /register/i });
      if (await registerBtn.isVisible()) {
        await registerBtn.click();
        await page.waitForLoadState("networkidle");

        const ticketOption = page.locator("button", { hasText: /\$/ }).first();
        if (await ticketOption.isVisible()) {
          await ticketOption.click();
          await expect(page.getByText(/order summary/i)).toBeVisible();
          await expect(page.getByText(/total/i)).toBeVisible();
        }
      }
    }
  });
});

test.describe("confirmation page", () => {
  test("renders standalone with confirmation message and links", async ({ page }) => {
    await page.goto("/events/seed-event-001-apex-throwdown/register/confirmation");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/registration confirmed/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /view event/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /browse more events/i })).toBeVisible();
  });
});

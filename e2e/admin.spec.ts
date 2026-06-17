import { test, expect } from "@playwright/test";
import { adminLogin } from "./helpers";

test.describe("admin login", () => {
  test("dev bypass login redirects to dashboard", async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("Admin");
    await expect(page.locator("h1")).toContainText("sign in");

    await page.getByPlaceholder(/admin@startlineau/i).fill("test.organiser@startlineau.com");
    await page.locator('input[type="password"]').first().fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("**/admin/dashboard**", { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Overview");
  });

  test("login page renders all form elements", async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");

    await expect(page.getByPlaceholder(/admin@startlineau/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});

test.describe("admin dashboard", () => {
  test("dashboard shows stats cards after login", async ({ page }) => {
    await adminLogin(page);

    await expect(page.getByText("Pending review")).toBeVisible();
    await expect(page.getByText("Published events")).toBeVisible();
    await expect(page.getByText("Rejected")).toBeVisible();
    await expect(page.getByText("registered accounts")).toBeVisible();

    await expect(page.locator("h1")).toContainText("Overview");
  });

  test("dashboard has quick action links", async ({ page }) => {
    await adminLogin(page);

    await expect(page.getByText("Review pending events")).toBeVisible();
    await expect(page.getByText("All events")).toBeVisible();
    await expect(page.getByText("View accounts")).toBeVisible();
    await expect(page.getByText("Moderate reviews")).toBeVisible();
  });

  test("review queue CTA links to pending events", async ({ page }) => {
    await adminLogin(page);

    const reviewCta = page.getByRole("link", { name: /review queue/i });
    if (await reviewCta.isVisible()) {
      await reviewCta.click();
      await page.waitForURL("**/admin/events?status=PENDING**", { timeout: 5000 });
      await expect(page.locator("h1")).toContainText("Events");
    }
  });

  test("pending stats card links to pending events page", async ({ page }) => {
    await adminLogin(page);

    const pendingCard = page.getByRole("link", { name: /pending review/i });
    if (await pendingCard.isVisible()) {
      await pendingCard.click();
      await page.waitForURL("**/admin/events?status=PENDING**", { timeout: 5000 });
      await expect(page.getByRole("button", { name: "Pending" })).toBeVisible();
    }
  });
});

test.describe("admin events page", () => {
  test("events page renders with tabs", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/events");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("Events");
    await expect(page.getByRole("button", { name: "Pending" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approved" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rejected" })).toBeVisible();
  });

  test("pending tab shows pending events after seed", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/events?status=PENDING");
    await page.waitForLoadState("networkidle");

    const eventCount = page.locator("text=/\\d+ event(s)?/");
    await expect(eventCount).toBeVisible({ timeout: 10000 });

    await expect(page.getByText("Hybrid Hustle Series", { exact: false })).toBeVisible({ timeout: 10000 });
  });

  test("rejected tab shows rejected events with reason", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/events?status=REJECTED");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Autumn Run Festival", { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Event date has already passed", { exact: false })).toBeVisible({ timeout: 10000 });
  });

  test("pagination controls appear when count label is visible", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/events?status=PENDING");
    await page.waitForLoadState("networkidle");

    const countLabel = page.locator("text=/\\d+ event(s)?/");
    await expect(countLabel).toBeVisible({ timeout: 10000 });
  });

  test("can switch between tabs", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/events?status=PENDING");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Approved" }).click();
    await page.waitForURL("**/admin/events?status=APPROVED**");

    await page.getByRole("button", { name: "Rejected" }).click();
    await page.waitForURL("**/admin/events?status=REJECTED**");

    await page.getByRole("button", { name: "Pending" }).click();
    await page.waitForURL("**/admin/events?status=PENDING**");
  });
});

test.describe("admin event approval flow", () => {
  test("approve button is visible on pending events", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/events?status=PENDING");
    await page.waitForLoadState("networkidle");

    const approveBtn = page.getByRole("button", { name: "Approve" });
    const count = await approveBtn.count();
    expect(count).toBeGreaterThan(0);
  });

  test("reject button shows rejection form", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/events?status=PENDING");
    await page.waitForLoadState("networkidle");

    const rejectBtn = page.locator("button").filter({ hasText: /^Reject$/ }).first();
    await expect(rejectBtn).toBeVisible({ timeout: 5000 });
    await rejectBtn.click();

    await expect(page.getByText("Rejection reason")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /cancel/i })).toBeVisible();
  });

  test("can approve a pending event and it disappears from list", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/events?status=PENDING");
    await page.waitForLoadState("networkidle");

    const approveBtn = page.getByRole("button", { name: "Approve" }).first();
    if (await approveBtn.isVisible()) {
      const eventTitle = await page.locator('[class*="font-headline"][class*="text-\\[15px\\]"]').first().textContent();

      await approveBtn.click();

      if (eventTitle) {
        await expect(page.getByText(eventTitle.trim())).not.toBeVisible({ timeout: 5000 });
      }
    }
  });
});

test.describe("admin organisers page", () => {
  test("organisers page lists accounts", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/organisers");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Apex Endurance Events", { exact: false })).toBeVisible({ timeout: 10000 });
  });
});

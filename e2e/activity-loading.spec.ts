import { test, expect } from "@playwright/test";

// #514: the account fetch (saved, registrations, follows) only starts once
// auth resolves. Until it lands every list is empty, and the page used to show
// "Nothing here yet." before the athlete's real entries appeared.

const BYPASS_COOKIE = { name: "__e2e_bypass", value: "1", domain: "localhost", path: "/", sameSite: "Lax" as const };

test.describe("activity page loading", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([BYPASS_COOKIE]);
  });

  test("shows a skeleton, not the empty state, while entries load", async ({ page }) => {
    // The first visit compiles /activity and the API routes it calls.
    test.slow();
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));

    await page.route("**/api/user/registrations", async (route) => {
      await held;
      await route.continue();
    });

    await page.goto("/activity");

    const skeleton = page.getByTestId("activity-skeleton");
    await expect(skeleton).toBeVisible();
    await expect(page.getByText("Nothing here yet.")).toHaveCount(0);

    // Every tab waits on the same fetch.
    await page.getByRole("button", { name: /^saved/i }).click();
    await expect(skeleton).toBeVisible();
    await page.getByRole("button", { name: /^following/i }).click();
    await expect(skeleton).toBeVisible();

    release();
    await expect(skeleton).toBeHidden({ timeout: 30000 });
  });

  test("signed-out visitors do not wait on an account fetch", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/activity");
    await expect(page.getByTestId("activity-skeleton")).toBeHidden({ timeout: 15000 });
    await context.close();
  });
});

import { test, expect } from "@playwright/test";

// First sign-in through Google or Apple lands on /auth/onboarding, which the
// suite cannot reach (it never completes a provider round trip). These cover the
// page itself: it does not run without a session, and it enforces the same age
// gate as the sign-up modal.

async function signInAsAthlete(page: import("@playwright/test").Page) {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: "athlete", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

test.describe("/auth/onboarding", () => {
  test("asks a signed-out visitor to sign in instead of showing the form", async ({ page }) => {
    await page.goto("/auth/onboarding");

    await expect(page.getByText("Please sign in to finish setting up your account.")).toBeVisible();
    await expect(page.getByLabel("First name")).toHaveCount(0);
  });

  test("refuses an under-18 date of birth and saves nothing", async ({ page }) => {
    await signInAsAthlete(page);
    await page.goto("/auth/onboarding");

    await expect(page.getByLabel("First name")).toBeVisible();
    await page.getByLabel("First name").fill("Harper");
    await page.getByLabel("Last name").fill("Jones");

    const year = String(new Date().getFullYear() - 5);
    await page.getByLabel("Day").fill("01");
    await page.getByLabel("Month").fill("01");
    await page.getByLabel("Year").fill(year);

    await page.locator('input[type="checkbox"]').check({ force: true });
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.locator('p[role="alert"]')).toContainText("18 or older");
    // Still on the page: nothing was written for a rejected age.
    await expect(page).toHaveURL(/\/auth\/onboarding/);
  });
});

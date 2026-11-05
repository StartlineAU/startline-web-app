import { test, expect } from "@playwright/test";

// The recovery page is the only way back in for someone who has lost the
// authenticator app. The route is mocked here: proving the password needs a real
// Cognito user, which is covered by src/__tests__/authenticator-recovery.test.ts.

// The recovery page compiles on first use in dev, like the other auth pages.
test.describe.configure({ timeout: 90_000 });

test.describe("authenticator recovery", () => {
  test("turns the authenticator app off after the password and a code", async ({ page }) => {
    const requests: Array<Record<string, unknown>> = [];
    await page.route("**/api/auth/recovery", async (route) => {
      requests.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ json: { ok: true } });
    });

    await page.goto("/auth/recovery?email=harper.jones%40startline.test");
    await expect(page.getByRole("heading", { name: /Lost your authenticator/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("harper.jones@startline.test");

    await page.getByLabel("Password").fill("Password123!");
    await page.getByLabel("Recovery code").fill("ABCDE-FGHJK");
    await page.getByRole("button", { name: /Turn off authenticator/i }).click();

    await expect(page.getByRole("heading", { name: /Authenticator turned off/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    expect(requests).toEqual([{
      email: "harper.jones@startline.test",
      password: "Password123!",
      code: "ABCDE-FGHJK",
    }]);
  });

  test("a refused code says why and keeps the form open", async ({ page }) => {
    await page.route("**/api/auth/recovery", (route) =>
      route.fulfill({
        status: 401,
        json: { error: "That recovery code did not match. Check it and try again." },
      }));

    await page.goto("/auth/recovery");
    await page.getByLabel("Email").fill("harper.jones@startline.test");
    await page.getByLabel("Password").fill("Password123!");
    await page.getByLabel("Recovery code").fill("ZZZZZ-ZZZZZ");
    await page.getByRole("button", { name: /Turn off authenticator/i }).click();

    await expect(page.getByText(/That recovery code did not match/)).toBeVisible();
    await expect(page.getByLabel("Recovery code")).toBeVisible();
  });
});

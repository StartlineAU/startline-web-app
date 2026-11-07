import { test, expect } from "@playwright/test";

// The web side of the mobile app (StartlineAU/startline-mobile-app). A browser
// never runs the native code paths; these check what a browser can see of them.

test.describe("mobile app support", () => {
  test("the app-link files answer as files, not as a page", async ({ request }) => {
    for (const path of ["/.well-known/apple-app-site-association", "/.well-known/assetlinks.json"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      // 404 until the store identifiers are filled in (lib/mobile-app.ts),
      // JSON after. Never a redirect or an HTML page: either would make iOS
      // and Android give up on opening links in the app.
      expect([200, 404], path).toContain(res.status());
      if (res.status() === 200) {
        expect(res.headers()["content-type"]).toContain("application/json");
        await expect(res.json()).resolves.toBeTruthy();
      } else {
        expect(res.headers()["content-type"] ?? "").not.toContain("text/html");
      }
    }
  });

  test("a forged app sign-in callback is refused in a browser", async ({ page }) => {
    // No sign-in was started here, so there is no stored state to match.
    await page.goto("/auth/callback?native=1&code=forged&state=forged");
    await expect(page.getByText(/couldn't sign you in/i)).toBeVisible();
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name.includes("CognitoIdentityServiceProvider"))).toBe(false);
  });
});

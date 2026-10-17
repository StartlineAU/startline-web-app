import { test, expect, type Page } from "@playwright/test";
import { goToHomepage } from "./helpers";

// Google and Apple sign-in leave the site for Cognito's hosted endpoint, which
// the suite cannot complete. These cover everything on our side of it: the
// buttons, the request that starts the flow, and every way the callback page
// can come back. The dev server runs with a fake Cognito domain (see
// playwright.config.ts and ci.yml); the redirect to it is intercepted here.

const AUTHORIZE = "**/oauth2/authorize**";

// Next renders an empty role="alert" route announcer, so match the message.
const callbackError = (page: Page) => page.locator('p[role="alert"]');

async function openSignInModal(page: Page) {
  await goToHomepage(page);
  await page.getByRole("button", { name: "SIGN IN" }).click();
  await page.waitForSelector('[role="dialog"]');
}

async function captureAuthorize(page: Page) {
  const seen = new Promise<URL>((resolve) => {
    void page.route(AUTHORIZE, async (route) => {
      resolve(new URL(route.request().url()));
      await route.fulfill({ status: 200, contentType: "text/html", body: "<p>stub</p>" });
    });
  });
  return seen;
}

test.describe("social sign-in buttons", () => {
  test("sign-in and create-account both offer Google and Apple, with the terms", async ({ page }) => {
    await openSignInModal(page);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Continue with Apple" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Terms & Conditions" })).toBeVisible();

    await dialog.getByRole("button", { name: "Create Account", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
  });

  test("Google starts a code flow with PKCE that returns to /auth/callback", async ({ page }) => {
    await openSignInModal(page);
    const origin = new URL(page.url()).origin;
    const authorize = captureAuthorize(page);
    await page.getByRole("button", { name: "Continue with Google" }).click();

    const url = await authorize;
    expect(url.hostname).toBe("sl-e2e.auth.ap-southeast-2.amazoncognito.com");
    expect(url.searchParams.get("identity_provider")).toBe("Google");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe(`${origin}/auth/callback`);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("aws.cognito.signin.user.admin");
  });

  test("Apple uses Cognito's SignInWithApple provider name", async ({ page }) => {
    await openSignInModal(page);
    const authorize = captureAuthorize(page);
    await page.getByRole("button", { name: "Continue with Apple" }).click();

    const url = await authorize;
    expect(url.searchParams.get("identity_provider")).toBe("SignInWithApple");
  });
});

test.describe("/auth/callback", () => {
  test("a cancelled sign-in says so and offers a way back", async ({ page }) => {
    await page.goto("/auth/callback?error=access_denied&error_description=User+cancelled");
    await expect(callbackError(page)).toHaveText("Sign-in was cancelled.");
    await expect(page.getByRole("link", { name: "Back to Startline" })).toBeVisible();
  });

  test("an MFA-protected account is told to use its password", async ({ page }) => {
    await page.goto(
      "/auth/callback?error=invalid_request&error_description=" +
        encodeURIComponent("PreSignUp failed with error STARTLINE_MFA_ACCOUNT. "),
    );
    await expect(callbackError(page)).toContainText("authenticator app");
  });

  test("the first sign-in after linking retries once, then stops", async ({ page }) => {
    const linked =
      "/auth/callback?error=invalid_request&error_description=" +
      encodeURIComponent("Already found an entry for username google_1234567890 ");

    await goToHomepage(page);
    await page.evaluate(() => {
      sessionStorage.setItem("startline_social_provider", "google");
      sessionStorage.setItem("startline_social_return_to", "/events");
    });

    const authorize = captureAuthorize(page);
    await page.goto(linked);
    const url = await authorize;
    expect(url.searchParams.get("identity_provider")).toBe("Google");
    // Let the retry's navigation land before going back, or the second goto
    // below is interrupted by it.
    await page.waitForURL(/amazoncognito\.com/);

    // The retry is spent, so the same reply again is shown, not looped.
    await page.goto(linked);
    await expect(callbackError(page)).toHaveText("We couldn't sign you in. Please try again.");
  });
});

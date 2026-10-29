import { test, expect, type Page } from "@playwright/test";

// Settings → Login & security reads and changes the account's linked Google
// and Apple identities through /api/user/sign-in-methods. The bypass identities
// have no real Cognito user, so the route is mocked here; the Cognito mapping
// itself is covered by src/__tests__/sign-in-methods.test.ts.
//
// The OAuth round trip cannot be completed in this suite (it leaves for the
// provider), so these tests stop at the authorize URL and at the callback's
// return notice.

type Method = {
  provider: "google" | "apple";
  label: string;
  linked: boolean;
  enabled: boolean;
  canRemove: boolean;
};

type State = { hasPassword: boolean; providers: Method[] };

const google = (linked: boolean, canRemove = false): Method => ({
  provider: "google", label: "Google", linked, enabled: true, canRemove,
});
const apple = (linked: boolean, canRemove = false): Method => ({
  provider: "apple", label: "Apple", linked, enabled: true, canRemove,
});

async function loginAs(page: Page, identity: string): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: identity, domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

async function openSettings(page: Page, query = "settings=security") {
  await page.goto(`/?${query}`);
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings).toBeVisible();
  return settings;
}

async function mockMethods(page: Page, initial: State) {
  let state = initial;
  const requests: Array<Record<string, unknown>> = [];

  await page.route("**/api/user/sign-in-methods", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ json: state });
      return;
    }

    const body = request.postDataJSON() as Record<string, unknown>;
    requests.push(body);

    if (body.action === "link") {
      await route.fulfill({ json: { url: "/?linked=google" } });
      return;
    }

    state = {
      hasPassword: state.hasPassword,
      providers: state.providers.map((method) =>
        method.provider === body.provider ? { ...method, linked: false, canRemove: false } : method,
      ),
    };
    await route.fulfill({ json: state });
  });

  return requests;
}

test.describe("linked Google and Apple accounts", () => {
  test("lists the providers and disconnects one after confirmation", async ({ page }) => {
    await loginAs(page, "athlete");
    const requests = await mockMethods(page, {
      hasPassword: true,
      providers: [google(false), apple(true, true)],
    });

    const settings = await openSettings(page);
    await expect(settings.getByRole("heading", { name: "Google and Apple" })).toBeVisible();
    await expect(settings.getByText("Not connected.")).toBeVisible();
    await expect(settings.getByText("Connected. You can sign in with this account.")).toBeVisible();

    await settings.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect(settings.getByText(/You will no longer be able to sign in with this account/i)).toBeVisible();
    await settings.getByRole("button", { name: "Yes, disconnect" }).click();

    await expect(settings.getByText("Apple is no longer connected.")).toBeVisible();
    expect(requests).toEqual([{ action: "unlink", provider: "apple" }]);
    await expect(settings.getByRole("button", { name: "Disconnect", exact: true })).toHaveCount(0);
  });

  test("starts a provider authorization for an unlinked account", async ({ page }) => {
    await loginAs(page, "athlete");
    const requests = await mockMethods(page, {
      hasPassword: true,
      providers: [google(false), apple(false)],
    });

    const settings = await openSettings(page);
    await settings.getByRole("button", { name: "Connect", exact: true }).first().click();

    await expect.poll(() => page.url()).toContain("linked=google");
    expect(requests).toEqual([{ action: "link", provider: "google", returnTo: "/" }]);
  });

  test("a provider-only account cannot disconnect its last way in", async ({ page }) => {
    await loginAs(page, "athlete");
    await mockMethods(page, {
      hasPassword: false,
      providers: [google(true, false), apple(false)],
    });

    const settings = await openSettings(page);
    await expect(settings.getByText(/your only way to sign in/i)).toBeVisible();
    await expect(settings.getByRole("button", { name: "Disconnect", exact: true })).toBeDisabled();
    await expect(settings.getByRole("button", { name: "Connect", exact: true })).toBeVisible();
  });

  test("shows the callback's result and refusal notices", async ({ page }) => {
    await loginAs(page, "athlete");
    await mockMethods(page, {
      hasPassword: true,
      providers: [google(true, true), apple(false)],
    });

    const connected = await openSettings(page, "settings=security&linked=google");
    await expect(connected.getByText("Google is now connected to your account.")).toBeVisible();

    const refused = await openSettings(page, "settings=security&linkError=already-linked");
    await expect(refused.getByText(/already connected to a different Startline account/i)).toBeVisible();
  });
});

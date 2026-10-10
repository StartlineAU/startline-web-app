import { test, expect, type Page } from "@playwright/test";
import { organiserLogin, multiOrganiserLogin } from "./helpers";

// One settings menu, opened from the account dropdown directly above Sign Out.
// Everyone gets "My account"; an owner or manager also gets their organisation.

async function loginAs(page: Page, identity: string): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: identity, domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

async function openFromAthleteMenu(page: Page) {
  await page.getByTestId("user-menu").click();
  await page.getByTestId("user-menu-panel").getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings).toBeVisible();
  return settings;
}

// The account menu is one component, so both portals list the same rows in the
// same order: Home, Athlete profile, the organisation, Settings, Sign Out.
const ACCOUNT_MENU_ROWS = ["Home", "Athlete profile", "Apex Endurance Events", "Settings", "Sign Out"];

test.describe("account menu", () => {
  for (const [portal, path] of [["athlete site", "/events"], ["organiser portal", "/organiser/dashboard"]] as const) {
    test(`lists the same rows in the same order on the ${portal}`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width: 1440, height: 900 });
      await organiserLogin(page);
      await page.goto(path);
      await page.getByTestId("user-menu").click();

      const menu = page.getByTestId("user-menu-panel");
      const rows = menu.getByRole("link").or(menu.getByRole("button"));
      // The organisation row arrives with the role fetch, after the menu opens.
      await expect(rows).toHaveText(ACCOUNT_MENU_ROWS, { timeout: 30000 });
      await expect(menu.getByText("My athlete account")).toBeVisible();
      await expect(menu.getByText("My organiser account")).toBeVisible();
    });

    test(`fits a phone on the ${portal}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await organiserLogin(page);
      await page.goto(path);
      await page.getByRole("button", { name: "Toggle menu" }).click();

      // Scoped to the nav: the events page has cards that name the organiser too.
      const nav = page.locator("nav").first();
      await expect(nav.getByRole("link", { name: "Athlete profile" })).toBeVisible();
      await expect(nav.getByRole("button", { name: /apex endurance events/i })).toBeVisible();
      await expect(nav.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
      await expect(nav.getByRole("button", { name: "Sign Out" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
    });
  }

  test("Home leaves the organiser portal for the Startline home page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await organiserLogin(page);
    await page.goto("/organiser/dashboard");
    await page.getByTestId("user-menu").click();
    await page.getByTestId("user-menu-panel").getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  });
});

test.describe("settings menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("an athlete with no organisation sees only their own settings", async ({ page }) => {
    await loginAs(page, "athlete");
    await page.goto("/");

    // Security moved into the menu, so the dropdown no longer links to it.
    await page.getByTestId("user-menu").click();
    const panel = page.getByTestId("user-menu-panel");
    await expect(panel.getByRole("link", { name: "Security" })).toHaveCount(0);
    await panel.getByRole("button", { name: "Settings" }).click();

    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
    await expect(settings.getByRole("button", { name: "Login & security" })).toBeVisible();
    await expect(settings.getByRole("button", { name: "Cookies" })).toBeVisible();
    // The profile fetch has landed, so the membership fetch has had its turn too.
    await expect(settings.getByLabel(/username/i)).toBeVisible();
    await expect(settings.getByRole("button", { name: "Personal details" })).toBeVisible();
    await expect(settings.getByRole("button", { name: "Organisation profile" })).toHaveCount(0);
  });

  test("an owner gets their organisation's settings beside their own", async ({ page }) => {
    // Several sections load in turn here, each compiling on first use in dev.
    test.slow();
    await organiserLogin(page);
    await page.goto("/");
    const settings = await openFromAthleteMenu(page);

    const sections = settings.getByRole("navigation", { name: "Settings sections" });
    await expect(sections.getByText("Apex Endurance Events")).toBeVisible();
    await expect(sections.getByText("Owner", { exact: true })).toBeVisible();

    await sections.getByRole("button", { name: "Organisation profile" }).click();
    await expect(settings.getByText("Cover photo")).toBeVisible();

    await sections.getByRole("button", { name: "Login & security" }).click();
    // Waits on the MFA status, whose route is slow to compile on first use.
    await expect(settings.getByRole("heading", { name: "Authenticator app" })).toBeVisible({ timeout: 40000 });
    await expect(settings.getByRole("button", { name: /change password/i })).toBeVisible();
    // The page promised security keys that were never built.
    await expect(settings.getByText(/security key|passkey/i)).toHaveCount(0);
  });

  test("the organiser portal opens the menu on the organisation", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/dashboard");

    await page.getByTestId("user-menu").click();
    const menu = page.getByTestId("user-menu-panel");
    await menu.getByRole("button", { name: "Settings", exact: true }).click();

    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings.getByRole("heading", { name: "Organisation profile" })).toBeVisible();
    await expect(settings.getByRole("button", { name: "Profile", exact: true })).toBeVisible();
  });

  test("someone in two organisations can switch between them", async ({ page }) => {
    await multiOrganiserLogin(page);
    await page.goto("/");
    const settings = await openFromAthleteMenu(page);

    const switcher = settings.getByRole("combobox", { name: "Switch organisation" });
    await expect(switcher).toBeVisible();
    const original = await switcher.inputValue();
    const other = await switcher.locator("option").evaluateAll(
      (opts, current) => (opts as HTMLOptionElement[]).map(o => o.value).find(v => v !== current)!,
      original,
    );

    try {
      await Promise.all([
        page.waitForResponse(r => r.url().includes("/api/organiser/switch-org") && r.ok()),
        switcher.selectOption(other),
      ]);
      await expect(switcher).toHaveValue(other);
    } finally {
      await page.request.post("/api/organiser/switch-org", { data: { organiserId: original } });
    }
  });

  test("the old security address opens the menu on its security section", async ({ page }) => {
    await loginAs(page, "athlete");
    await page.goto("/settings/security");

    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings.getByRole("heading", { name: "Login & security" })).toBeVisible();
    // The flag is read once and stripped, so a refresh does not reopen the menu.
    await expect(page).toHaveURL(/\/$/);
  });

  test("uploading an organisation photo leaves unsaved text alone", async ({ page }) => {
    const puts: string[] = [];
    page.on("request", r => {
      if (r.url().includes("/api/organiser/profile") && r.method() === "PUT") puts.push(r.url());
    });

    await organiserLogin(page);
    await page.goto("/organiser/profile");
    await page.getByRole("button", { name: "Edit Profile" }).click();
    const settings = page.getByRole("dialog", { name: "Settings" });

    await settings.getByLabel(/^about/i).fill("Half-typed and not ready to save.");
    await settings.getByRole("button", { name: "Reposition" }).first().click();
    await Promise.all([
      page.waitForResponse(r => r.url().includes("/api/organiser/profile") && r.request().method() === "PATCH" && r.ok()),
      settings.getByRole("button", { name: "Done" }).first().click(),
    ]);
    await expect(settings.getByText("Saved")).toBeVisible();

    // Only the image went to the server. The whole form used to go with it.
    expect(puts).toEqual([]);
    const profile = await (await page.request.get("/api/organiser/profile")).json();
    expect(profile.bio).not.toBe("Half-typed and not ready to save.");
  });

  test("on a phone the menu is a list first, then one section at a time", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await organiserLogin(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Toggle menu" }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();

    const settings = page.getByRole("dialog", { name: "Settings" });
    const sections = settings.getByRole("navigation", { name: "Settings sections" });
    await expect(sections.getByRole("button", { name: "Organisation profile" })).toBeVisible();
    await expect(settings.getByRole("heading", { name: "Profile", exact: true })).toBeHidden();

    await sections.getByRole("button", { name: "Login & security" }).click();
    await expect(settings.getByRole("heading", { name: "Login & security" })).toBeVisible();
    await expect(sections).toBeHidden();

    // Nothing is squeezed sideways: the section has the full width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);

    await settings.getByRole("button", { name: "All settings" }).click();
    await expect(sections.getByRole("button", { name: "Cookies" })).toBeVisible();
  });
});

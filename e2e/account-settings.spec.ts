import { test, expect, type Page } from "@playwright/test";
import { organiserLogin, organiserMemberLogin } from "./helpers";

// The parts of the settings menu that change an account: athlete notification
// preferences, changing email, deleting the account, and the organisation's
// members and payments summaries.
//
// The bypass identities have no real Cognito session, so the steps that need
// one (sending an email code, removing the login) answer 401 here. These tests
// cover everything up to that line: what is shown, what is refused and why.

async function loginAs(page: Page, identity: string): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: identity, domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

async function openSettings(page: Page, section: string) {
  await page.goto(`/?settings=${section}`);
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings).toBeVisible();
  return settings;
}

test.describe("athlete notification preferences", () => {
  test("turning off followed-organiser notifications saves on Save", async ({ page }) => {
    await loginAs(page, "athlete");
    const settings = await openSettings(page, "alerts");

    const followed = settings.getByRole("switch", { name: "New events from organisers you follow" });
    await expect(followed).toHaveAttribute("aria-checked", "true");
    // Entry emails are receipts and race-day information: shown, but locked on.
    await expect(settings.getByRole("switch", { name: "Your entries" })).toBeDisabled();

    try {
      await followed.click();
      const unsaved = await (await page.request.get("/api/user/profile")).json();
      expect(unsaved.notifyFollowedOrganiserEvents).toBe(true);

      await Promise.all([
        page.waitForResponse(r => r.url().includes("/api/user/profile") && r.request().method() === "PUT" && r.ok()),
        settings.getByRole("button", { name: /^save$/i }).click(),
      ]);
      const saved = await (await page.request.get("/api/user/profile")).json();
      expect(saved.notifyFollowedOrganiserEvents).toBe(false);
    } finally {
      const restored = await page.request.put("/api/user/profile", { data: { notifyFollowedOrganiserEvents: true } });
      expect(restored.ok()).toBe(true);
    }
  });
});

test.describe("changing email", () => {
  test("refuses a bad, unchanged or taken address before any code is sent", async ({ page }) => {
    await loginAs(page, "athlete");
    await page.goto("/");
    const me = await (await page.request.get("/api/user/profile")).json();

    const bad = await page.request.post("/api/user/email", { data: { action: "request", email: "not-an-email" } });
    expect(bad.status()).toBe(400);

    const same = await page.request.post("/api/user/email", { data: { action: "request", email: me.email } });
    expect(same.status()).toBe(400);
    expect((await same.json()).error).toMatch(/already your email/i);

    const taken = await page.request.post("/api/user/email", { data: { action: "request", email: "sarah.mitchell@startline.test" } });
    expect(taken.status()).toBe(409);
  });

  test("the security section offers to change the address", async ({ page }) => {
    await loginAs(page, "athlete");
    const settings = await openSettings(page, "security");

    await settings.getByRole("button", { name: "Change", exact: true }).click();
    await expect(settings.getByLabel("New email address")).toBeVisible();
    await expect(settings.getByText(/only changes once you enter it/i)).toBeVisible();
    await expect(settings.getByRole("button", { name: /send code/i })).toBeDisabled();
  });
});

test.describe("signing out everywhere", () => {
  test("asks first and says what will happen", async ({ page }) => {
    await loginAs(page, "athlete");
    const settings = await openSettings(page, "security");

    await settings.getByRole("button", { name: "Sign out all" }).click();
    await expect(settings.getByText(/on your other devices within the hour/i)).toBeVisible();
    await expect(settings.getByRole("button", { name: "Yes, sign out everywhere" })).toBeVisible();
    await settings.getByRole("button", { name: "Cancel", exact: true }).first().click();
    await expect(settings.getByRole("button", { name: "Yes, sign out everywhere" })).toHaveCount(0);
  });
});

test.describe("deleting an account", () => {
  test("an athlete is told what goes and must type DELETE", async ({ page }) => {
    await loginAs(page, "athlete");
    const settings = await openSettings(page, "security");

    await settings.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(settings.getByText(/removed for good/i)).toBeVisible();
    await expect(settings.getByText(/entries you have made stay/i)).toBeVisible();

    const confirm = settings.getByRole("button", { name: "Delete my account" });
    await expect(confirm).toBeDisabled();
    await settings.getByLabel("Type DELETE to confirm").fill("delete");
    await expect(confirm).toBeDisabled();
    await settings.getByLabel("Type DELETE to confirm").fill("DELETE");
    await expect(confirm).toBeEnabled();

    // Not clicked: the API is checked directly so nothing here depends on a
    // real login existing to remove.
    const unconfirmed = await page.request.delete("/api/user/account", { data: {} });
    expect(unconfirmed.status()).toBe(400);
  });

  test("the only owner of an organisation is stopped and shown the way through", async ({ page }) => {
    await organiserLogin(page);
    const settings = await openSettings(page, "security");

    await settings.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(settings.getByText(/sort out the organisation you own/i)).toBeVisible();
    await expect(settings.getByText("Apex Endurance Events", { exact: true }).last()).toBeVisible();
    await expect(settings.getByRole("button", { name: "Transfer ownership" })).toBeVisible();
    // Apex has taken entries, so closing it is not on offer.
    await expect(settings.getByRole("button", { name: "Delete organisation" })).toHaveCount(0);
    await expect(settings.getByRole("button", { name: "Delete my account" })).toHaveCount(0);

    const refused = await page.request.delete("/api/user/account", { data: { confirm: "DELETE" } });
    expect(refused.status()).toBe(409);
    const body = await refused.json();
    expect(body.code).toBe("OWNS_ORGANISATION");
    expect(body.blockers[0].name).toBe("Apex Endurance Events");
  });

  test("an organisation that has taken entries cannot be deleted, by anyone", async ({ page, browser }) => {
    test.slow();
    await organiserLogin(page);
    await page.goto("/");
    const { memberships } = await (await page.request.get("/api/organiser/memberships")).json();
    const apex = memberships.find((m: { organiserName: string }) => m.organiserName === "Apex Endurance Events");

    const owner = await page.request.delete(`/api/user/account/organisations/${apex.organiserId}`);
    expect(owner.status()).toBe(409);
    expect((await owner.json()).code).toBe("HAS_ENTRIES");
    // The older route that acts on the active organisation holds the same line.
    expect((await page.request.delete("/api/organiser")).status()).toBe(409);

    const managerContext = await browser.newContext();
    const manager = await managerContext.newPage();
    await organiserMemberLogin(manager);
    const refused = await manager.request.delete(`/api/user/account/organisations/${apex.organiserId}`);
    expect(refused.status()).toBe(403);
    await managerContext.close();

    // Still there.
    const after = await (await page.request.get("/api/organiser/profile")).json();
    expect(after.orgName).toBe("Apex Endurance Events");
  });
});

test.describe("insurance declaration", () => {
  test("is made in the organisation profile, by the owner only", async ({ page, browser }) => {
    test.slow();
    await organiserLogin(page);
    const settings = await openSettings(page, "organisation");

    const declaration = settings.getByRole("checkbox", { name: /I declare that I currently hold public liability insurance/i });
    await expect(declaration).toBeEnabled();
    const before = (await (await page.request.get("/api/organiser/profile")).json()).insuranceDeclared as boolean;
    await expect(declaration).toBeChecked({ checked: before });

    try {
      await declaration.setChecked(!before, { force: true });
      await Promise.all([
        page.waitForResponse(r => r.url().includes("/api/organiser/profile") && r.request().method() === "PUT" && r.ok()),
        settings.getByRole("button", { name: /^save$/i }).click(),
      ]);
      const saved = await (await page.request.get("/api/organiser/profile")).json();
      expect(saved.insuranceDeclared).toBe(!before);

      const managerContext = await browser.newContext();
      const manager = await managerContext.newPage();
      await organiserMemberLogin(manager);
      const managerSettings = await openSettings(manager, "organisation");
      await expect(managerSettings.getByRole("checkbox", { name: /I declare/i })).toBeDisabled();
      await expect(managerSettings.getByText("Only the owner can make this declaration.")).toBeVisible();
      await managerContext.close();
    } finally {
      const profile = await (await page.request.get("/api/organiser/profile")).json();
      const restored = await page.request.put("/api/organiser/profile", {
        data: {
          orgName: profile.orgName, contactName: profile.contactName,
          contactEmail: profile.contactEmail, phone: profile.phone, insuranceDeclared: before,
        },
      });
      expect(restored.ok()).toBe(true);
    }
  });
});

test.describe("organisation summaries", () => {
  test("Members lists who can manage the organisation and links to the page", async ({ page }) => {
    // Ends by loading the members page, which is slow to compile in dev.
    test.slow();
    await organiserLogin(page);
    const settings = await openSettings(page, "members");

    await expect(settings.getByRole("heading", { name: "Members" })).toBeVisible();
    await expect(settings.getByText("(you)")).toBeVisible();
    await expect(settings.getByRole("listitem").filter({ hasText: "Owner" })).toHaveCount(1);
    await settings.getByRole("link", { name: "Manage members" }).click();
    await expect(page).toHaveURL(/\/organiser\/members/, { timeout: 45000 });
    await expect(settings).toHaveCount(0);
  });

  test("Payments says what is in place before linking out", async ({ page }) => {
    await organiserLogin(page);
    const settings = await openSettings(page, "payments");

    await expect(settings.getByText("Stripe payouts")).toBeVisible();
    await expect(settings.getByText("ABN or ACN")).toBeVisible();
    // Insurance is not a payments matter: it is declared in the organisation profile.
    await expect(settings.getByText(/insurance/i)).toHaveCount(0);
    await expect(settings.getByRole("link", { name: "Manage payments" })).toBeVisible();
  });
});

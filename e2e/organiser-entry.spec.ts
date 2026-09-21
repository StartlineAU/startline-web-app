import { test, expect, type Page } from "@playwright/test";

// Getting into the organiser portal (#338). "Organiser Login" and "Become an
// organiser" are two names for one journey, and where either one lands you
// depends only on what you already have:
//
//   an organisation, owned or joined -> your dashboard
//   signed in with none              -> setting one up
//   signed out                       -> the landing page, to sign in or start

async function signInAs(page: Page, who: "organiser" | "member" | "athlete"): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: who, domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

test.describe("organiser portal entry", () => {
  test("an owner going to organiser login lands on their dashboard", async ({ page }) => {
    await signInAs(page, "organiser");
    await page.goto("/organiser");
    await expect(page).toHaveURL(/\/organiser\/dashboard/);
  });

  // Being a MANAGER on someone else's organisation counts as having one.
  test("a member going to organiser login lands on that organisation's dashboard", async ({ page }) => {
    await signInAs(page, "member");
    await page.goto("/organiser");
    await expect(page).toHaveURL(/\/organiser\/dashboard/);
  });

  test("an owner is never offered the setup form", async ({ page }) => {
    await signInAs(page, "organiser");
    await page.goto("/organiser-setup");
    await expect(page).toHaveURL(/\/organiser\/dashboard/);
  });

  test("a member is never offered the setup form", async ({ page }) => {
    await signInAs(page, "member");
    await page.goto("/organiser-setup");
    await expect(page).toHaveURL(/\/organiser\/dashboard/);
  });

  test("a signed-in athlete with no organisation goes straight to setting one up", async ({ page }) => {
    await signInAs(page, "athlete");
    await page.goto("/organiser");
    await expect(page).toHaveURL(/\/organiser-setup/);
    await expect(page.getByRole("heading", { name: /publish your events/i })).toBeVisible();
  });

  test("a signed-out visitor gets the landing page, not the setup form", async ({ page }) => {
    await page.goto("/organiser");
    await expect(page).toHaveURL(/\/organiser$/);
    await expect(page.getByRole("heading", { name: /become an/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("the header dropdown offers the organisation to someone who has one", async ({ page }) => {
    test.slow();
    await signInAs(page, "organiser");
    await page.goto("/events");
    await page.getByTestId("user-menu").click();
    const menu = page.getByTestId("user-menu-panel");

    await expect(menu.getByText(/switch to organiser portal/i)).toBeVisible();
    await expect(menu.getByRole("link", { name: /become an organiser/i })).toHaveCount(0);
    await menu.getByRole("button", { name: /apex endurance/i }).click();
    await expect(page).toHaveURL(/\/organiser\/dashboard/, { timeout: 30000 });
  });

  test("the header dropdown offers to set one up for someone who has none", async ({ page }) => {
    test.slow();
    await signInAs(page, "athlete");
    await page.goto("/events");
    await page.getByTestId("user-menu").click();
    const menu = page.getByTestId("user-menu-panel");

    await expect(menu.getByText(/switch to organiser portal/i)).toHaveCount(0);
    const become = menu.getByRole("link", { name: /become an organiser/i });
    await expect(become).toBeVisible();
    await become.click();
    await expect(page).toHaveURL(/\/organiser-setup/, { timeout: 30000 });
  });
});

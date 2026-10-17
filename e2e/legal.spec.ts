import { test, expect, type Page } from "@playwright/test";
import { goToHomepage, organiserLogin } from "./helpers";

// The legal pages, and every place that asks someone to agree to them. Each
// link opens in a new tab so a half-filled form is not lost, so the checks
// follow the popup rather than the current page.

const PAGES = [
  { path: "/terms",   heading: /terms of\s*service/i },
  { path: "/privacy", heading: /privacy\s*policy/i },
  { path: "/cookies", heading: /cookie\s*policy/i },
];

/** Clicks a link that opens in a new tab and checks the tab lands on `path`. */
async function expectOpensInNewTab(page: Page, link: ReturnType<Page["getByRole"]>, path: string, heading: RegExp) {
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("href", new RegExp(`${path.replace("#", "\\#")}$`));
  const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
  await popup.waitForLoadState("domcontentloaded");
  expect(new URL(popup.url()).pathname).toBe(path.split("#")[0]);
  await expect(popup.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await popup.close();
}

test.describe("legal pages", () => {
  for (const { path, heading } of PAGES) {
    test(`${path} renders with contents and the company details`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Contents" })).toBeVisible();
      await expect(page.getByText("Last updated:")).toBeVisible();
      await expect(page.getByRole("link", { name: "admin@startlineau.com" }).first()).toBeVisible();
      // No placeholder left behind from drafting.
      await expect(page.getByText(/\[COMPANY NAME\]|\[ABN\]/)).toHaveCount(0);
    });
  }

  test("terms and privacy name the operating company and ABN", async ({ page }) => {
    for (const path of ["/terms", "/privacy"]) {
      await page.goto(path);
      await expect(page.getByText(/Startline Pty Ltd \(ABN 85 775 067 904\)/)).toBeVisible();
    }
  });

  test("contents links jump to their section", async ({ page }) => {
    await page.goto("/terms");
    await page.getByRole("navigation", { name: "Contents" }).getByRole("link", { name: /Organiser terms/ }).click();
    await expect(page).toHaveURL(/\/terms#organisers$/);
    await expect(page.locator("#organisers")).toBeInViewport();
  });

  test("terms set no Startline insurance minimum", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByText(/\$10 million/)).toHaveCount(0);
  });

  test("footer links to the terms and privacy policy", async ({ page }) => {
    await goToHomepage(page);
    const footer = page.locator("footer");
    for (const [label, path] of [["Privacy Policy", "/privacy"], ["Terms of Service", "/terms"]] as const) {
      await expect(footer.getByRole("link", { name: label })).toHaveAttribute("href", path);
    }
  });
});

test.describe("agreeing to the legal pages", () => {
  test("sign-up links to the terms and privacy policy", async ({ page }) => {
    await goToHomepage(page);
    await page.getByRole("button", { name: "SIGN IN" }).click();
    await page.waitForSelector('[role="dialog"]');
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await page.getByPlaceholder("you@example.com").fill(`legal.${Date.now()}@example.com`);
    await page.getByPlaceholder("Create a password").fill("Password123!");
    await page.getByPlaceholder("Re-enter password").fill("Password123!");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.waitForSelector("text=Tell us a bit about yourself");

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/coming soon/i)).toHaveCount(0);
    await expectOpensInNewTab(page, dialog.getByRole("link", { name: "Terms of Service" }), "/terms", PAGES[0].heading);
    await expectOpensInNewTab(page, dialog.getByRole("link", { name: "Privacy Policy" }), "/privacy", PAGES[1].heading);
  });

  test("sign-up asks for the terms by name when the box is left unticked", async ({ page }) => {
    await goToHomepage(page);
    await page.getByRole("button", { name: "SIGN IN" }).click();
    await page.waitForSelector('[role="dialog"]');
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await page.getByPlaceholder("you@example.com").fill(`legal.${Date.now()}@example.com`);
    await page.getByPlaceholder("Create a password").fill("Password123!");
    await page.getByPlaceholder("Re-enter password").fill("Password123!");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.waitForSelector("text=Tell us a bit about yourself");

    await page.getByPlaceholder("First").fill("Legal");
    await page.getByPlaceholder("Last").fill("Check");
    await page.locator('input[aria-label="Day"]').fill("15");
    await page.locator('input[aria-label="Month"]').fill("06");
    await page.locator('input[aria-label="Year"]').fill("1990");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Please agree to the Terms of Service to continue.")).toBeVisible();
  });

  test("the event wizard's final review links to the organiser terms", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.getByPlaceholder(/Apex Throwdown/i).fill("E2E Legal Link Event");

    // Continue does not block on incomplete steps (drafts are allowed), so
    // stepping through reaches the review without filling every field.
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: /continue/i }).click();
    }

    const link = page.getByRole("link", { name: "Terms of Service" });
    await expect(page.getByText(/I agree to the organiser terms in the/)).toBeVisible();
    await expect(page.getByText(/Event Listing Policy/)).toHaveCount(0);
    await expectOpensInNewTab(page, link, "/terms#organisers", PAGES[0].heading);
  });
});

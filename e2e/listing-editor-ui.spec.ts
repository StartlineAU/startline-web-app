import { test, expect } from "@playwright/test";
import { chooseDiscipline, organiserLogin } from "./helpers";

// Listing editor fixes from #579.
test.describe("listing editor (#579)", () => {
  test.beforeEach(async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
  });

  test("category is a dropdown that offers Functional Fitness", async ({ page }) => {
    const pill = page.getByRole("button", { name: "Choose category" });
    await pill.click();
    await expect(pill).toHaveAttribute("aria-expanded", "true");
    // A listbox under the pill, not a modal over the page.
    await expect(page.getByRole("dialog", { name: "Category" })).toHaveCount(0);
    await expect(page.getByRole("listbox", { name: "Category" })).toBeVisible({ timeout: 15000 });

    await chooseDiscipline(page, "Functional Fitness");
    await expect(page.getByRole("listbox", { name: "Category" })).toHaveCount(0);
    await expect(pill).toContainText("Functional Fitness");
  });

  test("the category dropdown closes on Escape", async ({ page }) => {
    const pill = page.getByRole("button", { name: "Choose category" });
    await pill.click();
    await expect(page.getByRole("listbox", { name: "Category" })).toBeVisible({ timeout: 15000 });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox", { name: "Category" })).toHaveCount(0);
    await expect(pill).toBeFocused();
  });

  test("the description toolbar has no heading or alignment buttons", async ({ page }) => {
    const region = page.locator("#region-description");
    await expect(region.getByTitle("Bold (Ctrl+B)")).toBeVisible({ timeout: 15000 });
    await expect(region.getByTitle("Bullet list")).toBeVisible();
    for (const title of ["Heading", "Subheading", "Normal text"]) {
      await expect(region.getByTitle(title, { exact: true })).toHaveCount(0);
    }
  });

  test("the title field slants its text, caret included", async ({ page }) => {
    const title = page.getByLabel("Event title");
    await expect(title).toBeVisible({ timeout: 15000 });
    const transform = await title.evaluate(el => getComputedStyle(el).transform);
    // skewX(-10deg) computes to a matrix with a non-zero third value.
    expect(transform).toMatch(/^matrix\(1, 0, -0\.1\d+, 1, 0, 0\)$/);
  });

  test("Edit contact details opens Settings over the editor", async ({ page }) => {
    await page.getByLabel("Event title").fill("Unsaved title");
    const editor = page.getByTestId("contact-editor");
    await editor.getByRole("button", { name: "Edit contact details" }).click();

    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings).toBeVisible();
    await expect(settings.locator("#settings-org-contact")).toBeVisible({ timeout: 15000 });

    await settings.getByRole("button", { name: "Close settings" }).click();
    await expect(settings).toHaveCount(0);
    // Still on the editor, with what was typed intact.
    await expect(page).toHaveURL(/\/organiser\/new-listing/);
    await expect(page.getByLabel("Event title")).toHaveValue("Unsaved title");
  });

  test("a paid ticket states its advertised price, with fees in a bubble", async ({ page }) => {
    await page.getByLabel("Ticket price").fill("75");
    const summary = page.getByTestId("fee-breakdown").first();
    await expect(summary).toContainText("Advertised at A$75.00");
    await expect(page.getByTestId("fee-breakdown-details")).toHaveCount(0);

    await summary.getByRole("button", { name: "About fees and payout" }).click();
    await expect(page.getByTestId("fee-breakdown-details")).toContainText("A$75.00 stays the price athletes see on your event page");
  });
});

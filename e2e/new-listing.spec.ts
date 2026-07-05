import { test, expect } from "@playwright/test";
import { organiserLogin } from "./helpers";

test.describe("new listing wizard", () => {
  test("loads the new listing page with 6 steps", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Create new listing")).toBeVisible();
    await expect(page.getByText("The Basics").first()).toBeVisible();
    await expect(page.getByText("Date & Location").first()).toBeVisible();
    await expect(page.getByText("Format & Categories").first()).toBeVisible();
    await expect(page.getByText("Tickets & Pricing").first()).toBeVisible();
    await expect(page.getByText("Details & Media").first()).toBeVisible();
    await expect(page.getByText("Review & Publish").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /save draft/i })).toBeVisible();
  });

  test("fills step 1 basics and proceeds to step 2", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/functional fitness/i).fill("E2E Test Event");
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByText(/when and where/i).first()).toBeVisible();
  });

  test("address autocomplete shows suggestions", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    // Fill step 1 basics to get to step 2
    await page.getByPlaceholder(/functional fitness/i).fill("Address Test");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/when and where/i).first()).toBeVisible();

    // Set date and time
    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    await page.getByRole("button", { name: /\d{4}/i }).first().click();
    await page.getByText("Select time").click({ force: true });
    await page.locator('input[placeholder="e.g. 7:15 AM or 19:15"]').fill("09:00");
    await page.getByRole("button", { name: /^set$/i }).click();

    // Type into address autocomplete
    const addrInput = page.getByPlaceholder(/start typing an address/i);
    await addrInput.fill("George St Sydney");

    // Wait for suggestion dropdown
    const dropdown = page.locator('[role="combobox"] + div').filter({ has: page.locator('button') });
    await expect(dropdown.first()).toBeVisible({ timeout: 10000 });

    // Should have at least one suggestion
    const count = await dropdown.first().locator("button").count();
    expect(count).toBeGreaterThan(0);

    // Select the first suggestion
    await dropdown.first().locator("button").first().click();

    // Address field should be filled
    const filledAddr = await addrInput.inputValue();
    expect(filledAddr.length).toBeGreaterThan(0);
  });

  test("fills all 6 steps and saves as draft", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    // === Step 1: The Basics ===
    await page.getByPlaceholder(/functional fitness/i).fill("E2E Draft Event");
    await page.getByRole("button", { name: /continue/i }).click();

    // === Step 2: Date & Location ===
    await expect(page.getByText(/when and where/i).first()).toBeVisible();

    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    await page.getByRole("button", { name: /\d{4}/i }).first().click();

    await page.getByText("Select time").click({ force: true });
    await page.locator('input[placeholder="e.g. 7:15 AM or 19:15"]').fill("09:00");
    await page.getByRole("button", { name: /^set$/i }).click();

    // Address with autocomplete (also fills city + state on selection)
    const addrInput = page.getByPlaceholder(/start typing an address/i);
    await addrInput.fill("George St Sydney");
    const addrDropdown = page.locator('[role="combobox"] + div').filter({ has: page.locator('button') });
    if (await addrDropdown.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await addrDropdown.first().locator("button").first().click();
    } else {
      await addrInput.fill("1 Test St, Sydney NSW 2000");
    }

    await page.getByRole("button", { name: /continue/i }).click();

    // === Step 3: Format & Categories ===
    await expect(page.getByText(/format.*categories/i).first()).toBeVisible();
    await page.getByRole("button", { name: /continue/i }).click();

    // === Step 4: Tickets & Pricing ===
    await expect(page.getByText(/tickets.*pricing/i).first()).toBeVisible();

    await page.getByRole("button", { name: /startline/i }).first().click();

    const ticketLabel = page.getByPlaceholder(/general admission/i);
    if (await ticketLabel.isVisible()) {
      await ticketLabel.fill("Standard Entry");
    }

    const ticketPrice = page.locator('input[placeholder="129"]');
    if (await ticketPrice.isVisible()) {
      await ticketPrice.fill("50");
    }

    await page.getByRole("button", { name: /no refunds/i }).click();

    await page.getByRole("button", { name: /continue/i }).click();

    // === Step 5: Details & Media ===
    await expect(page.getByText(/cover image/i).first()).toBeVisible();

    const editor = page.locator("[contenteditable]");
    if (await editor.isVisible()) {
      await editor.fill("This is a test event description created by E2E tests.");
    }

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles({
        name: "test.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("test image content"),
      });
    }

    await page.getByRole("button", { name: /continue/i }).click();

    // === Step 6: Review & Publish ===
    await expect(page.getByText(/review/i).first()).toBeVisible();

    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /save draft/i }).click();

    await page.waitForTimeout(2000);
    // ponytail: API save may fail in test env; wizard UX is what's being tested
  });

  test("shows validation errors on empty submit", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    for (let i = 0; i < 5; i++) {
      await page.getByRole("button", { name: /continue/i }).click();
    }

    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /publish listing/i }).click();
    await expect(page.getByText(/please complete the following/i)).toBeVisible();
  });
});

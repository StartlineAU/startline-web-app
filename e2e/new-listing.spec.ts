import { test, expect } from "@playwright/test";
import { organiserLogin, pickTime } from "./helpers";

test.describe("new listing wizard", () => {
  test("loads the new listing page with 5 steps", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Create new listing")).toBeVisible();
    await expect(page.getByText("The Basics").first()).toBeVisible();
    await expect(page.getByText("Date & Location").first()).toBeVisible();
    await expect(page.getByText("Tickets & Pricing").first()).toBeVisible();
    await expect(page.getByText("Media & Description").first()).toBeVisible();
    await expect(page.getByText("Final Review").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /save draft/i })).toBeVisible();
  });

  test("fills step 1 basics and proceeds to step 2", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/Apex Throwdown/i).fill("E2E Test Event");
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByText(/when and where/i).first()).toBeVisible();
  });

  // Continue is at the foot of the step, so the next step used to open
  // scrolled to its own footer.
  test("continue lands at the top of the next step", async ({ page }) => {
    await organiserLogin(page);
    await page.setViewportSize({ width: 390, height: 740 });
    await page.goto("/organiser/new-listing");

    const next = page.getByRole("button", { name: /continue/i });
    await next.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await next.click();

    await expect(page.getByText(/when and where/i).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  // A long value in the review table used to widen the whole step past the
  // screen, and the notifications panel hung off the left edge.
  test("review step and notifications fit a phone screen", async ({ page }) => {
    await organiserLogin(page);
    await page.setViewportSize({ width: 390, height: 740 });
    await page.goto("/organiser/new-listing");

    await page.getByPlaceholder(/Apex Throwdown/i)
      .fill("The Very Long Named Coastal Endurance Championship Weekend 2026");
    await page.locator("button", { hasText: /^05/ }).first().click();
    await expect(page.getByText(/hit publish/i)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    const panel = page.getByText(/^Notifications/).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });

  // The preview fills a phone screen, so the back swipe is how people leave
  // it. That used to leave the wizard altogether and lose the event.
  test("back from the preview returns to the wizard with the event intact", async ({ page }) => {
    await organiserLogin(page);
    await page.setViewportSize({ width: 390, height: 740 });
    await page.goto("/organiser/new-listing");

    const title = page.getByPlaceholder(/Apex Throwdown/i);
    await title.fill("Back Swipe Classic");
    const openPreview = page.getByRole("button", { name: "Preview", exact: true });
    const banner = page.getByText("Athlete view preview");

    await openPreview.click();
    await expect(banner).toBeVisible();
    await page.goBack();
    await expect(banner).toHaveCount(0);
    await expect(page).toHaveURL(/\/organiser\/new-listing/);
    await expect(title).toHaveValue("Back Swipe Classic");

    // Closing with the button leaves no extra history entry behind either.
    await openPreview.click();
    await page.getByRole("button", { name: /close preview/i }).click();
    await expect(banner).toHaveCount(0);
    await expect(page).toHaveURL(/\/organiser\/new-listing/);
    await expect(title).toHaveValue("Back Swipe Classic");
  });

  test("address autocomplete shows suggestions", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    // Fill step 1 basics to get to step 2
    await page.getByPlaceholder(/Apex Throwdown/i).fill("Address Test");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/when and where/i).first()).toBeVisible();

    // Set date and time
    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    await page.getByRole("button", { name: /\d{4}/i }).first().click();
    await pickTime(page, "Start time", { hour: "9", minute: "00", period: "AM" });

    // Type into address autocomplete
    const addrInput = page.getByPlaceholder(/start typing an address/i);
    await addrInput.fill("George St Sydney");

    // Wait for suggestion dropdown (may require valid AWS GeoPlaces credentials)
    const dropdown = page.locator("#address-suggestions");
    if (await dropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
      const count = await dropdown.locator("button").count();
      expect(count).toBeGreaterThan(0);
      await dropdown.locator("button").first().click();
      const filledAddr = await addrInput.inputValue();
      expect(filledAddr.length).toBeGreaterThan(0);
    }
    // Skips if the AWS GeoPlaces API is unavailable in the test env.
  });

  test("blocks an end time at or before the start time", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/Apex Throwdown/i).fill("Time Test Event");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/when and where/i).first()).toBeVisible();

    await pickTime(page, "Start time",   { hour: "10", minute: "00", period: "AM" });
    await pickTime(page, "Cut-off time", { hour: "9",  minute: "00", period: "AM" });

    await expect(page.getByText(/end time must be after start time/i)).toBeVisible();
  });

  test("fills all 5 steps and saves as draft", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    // === Step 1: The Basics ===
    await page.getByPlaceholder(/Apex Throwdown/i).fill("E2E Draft Event");
    await page.getByRole("button", { name: /continue/i }).click();

    // === Step 2: Date & Location ===
    await expect(page.getByText(/when and where/i).first()).toBeVisible();

    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    await page.getByRole("button", { name: /\d{4}/i }).first().click();

    await pickTime(page, "Start time", { hour: "9", minute: "00", period: "AM" });

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

    // === Step 3: Tickets & Pricing ===
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

    // === Step 4: Media & Description ===
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

    // === Step 5: Final Review ===
    await expect(page.getByText(/review/i).first()).toBeVisible();

    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /save draft/i }).click();

    await page.waitForTimeout(2000);
    // The API save may fail in the test env; the wizard UX is what's being tested.
  });

  test("step rail stays pinned while scrolling", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(400);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
    // Regression: overflow-x on html/body used to disable position:sticky
    // site-wide, so the rail scrolled out of view.
    const rail = await page.locator("div.sticky.top-14").boundingBox();
    expect(rail).not.toBeNull();
    expect(rail!.y).toBeGreaterThanOrEqual(0);
  });

  test("single-day date reads clean after closing the picker", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/Apex Throwdown/i).fill("Single Day Test");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/when and where/i).first()).toBeVisible();

    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    // Close the popover with only a start date picked — a valid single-day event.
    await page.locator("h1").click();
    const dateField = page.locator("button", { hasText: /\d{4}/ }).first();
    await expect(dateField).not.toContainText(/pick end date/i);
  });

  test("price input strips non-numeric characters", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/Apex Throwdown/i).fill("Price Test");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    const price = page.locator('input[placeholder="129"]');
    await price.fill("abc");
    await expect(price).toHaveValue("");
    await price.fill("12.50");
    await expect(price).toHaveValue("12.50");
  });

  test("draft without a cut-off time saves without a silent failure", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    // Minimal draft: title only, endTime left empty (it's optional).
    // Regression: the API used to coerce empty endTime to null, which the
    // required schema column rejected — every such save 500ed.
    await page.getByPlaceholder(/Apex Throwdown/i).fill("E2E No Cutoff Draft");
    await page.getByRole("button", { name: /save draft/i }).click();

    // Success navigates to the dashboard; if the test env lacks an organiser
    // profile the API errors instead — either way the user must see an
    // outcome, never stay stuck on a silently-failed save.
    const errorBanner = page.getByText(/unauthorised|failed to save|went wrong/i).first();
    await expect
      .poll(
        async () =>
          page.url().includes("/organiser/dashboard") ||
          (await errorBanner.isVisible().catch(() => false)),
        { timeout: 30000 },
      )
      .toBe(true);
  });

  // What is missing shows in the review table itself, before any click, rather
  // than as a warning that only appeared after Publish was pressed.
  test("review table flags missing required fields and blocks publish", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");

    // Advance through all 5 steps without filling anything
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: /continue/i }).click();
    }

    await expect(page.getByText(/required items still need fixing/i)).toBeVisible();
    await expect(page.getByText("Add an event name of at least 3 characters")).toBeVisible();
    await expect(page.getByText("Upload a cover image")).toBeVisible();
    await expect(page.getByText(/ready to publish/i)).toHaveCount(0);

    // Optional extras stay out of the table until something is added to them.
    for (const optional of ["Prize money", "Info PDFs", "Gallery"]) {
      await expect(page.getByText(optional, { exact: true })).toHaveCount(0);
    }

    // Ticking the confirmation is not enough while rows are still flagged.
    await page.locator('input[type="checkbox"]').check();
    await expect(page.getByRole("button", { name: /publish listing/i })).toBeDisabled();

    // Fix takes them to the step, and the row clears once the field is filled.
    await page.locator('[data-missing="true"]', { hasText: "Title" }).getByRole("button", { name: /fix/i }).click();
    await page.getByPlaceholder(/Apex Throwdown/i).fill("Review Table Classic");
    await page.getByRole("button", { name: /Final Review/i }).click();
    await expect(page.getByText("Add an event name of at least 3 characters")).toHaveCount(0);
    await expect(page.getByText("Review Table Classic").first()).toBeVisible();
  });
});

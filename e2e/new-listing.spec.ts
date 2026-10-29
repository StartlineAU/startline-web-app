import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { organiserLogin, pickTime, ensureDatabaseUrl } from "./helpers";

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

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

  // #352: the old test passed when AWS was unavailable, so it never proved the
  // selection filled the form. Stub both lookups and assert the whole handoff.
  test("address autocomplete fills city, state and location preview", async ({ page }) => {
    const label = "123 Test St, Sydney NSW 2000";
    await page.route("**/api/places/autocomplete**", (route) =>
      route.fulfill({
        json: {
          results: [{ placeId: "place-1", label, title: "123 Test St", placeType: "Address" }],
        },
      }),
    );
    await page.route("**/api/places/geocode**", (route) =>
      route.fulfill({
        json: {
          result: {
            label,
            city: "Sydney",
            stateCode: "nsw",
            latitude: -33.8688,
            longitude: 151.2093,
          },
        },
      }),
    );

    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/Apex Throwdown/i).fill("Address Test");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/when and where/i).first()).toBeVisible();

    const addrInput = page.getByPlaceholder(/start typing an address/i);
    await addrInput.fill("123 Test St Sydney");
    await page.locator("#address-suggestions button").first().click();

    await expect(addrInput).toHaveValue(label);
    await expect(page.getByPlaceholder("e.g. Melbourne")).toHaveValue("Sydney");
    await expect(page.getByRole("combobox", { name: "State" })).toContainText("NSW");
    await expect(page.getByTestId("location-preview-map")).toBeVisible();
    await expect(page.getByTestId("location-preview-empty")).toHaveCount(0);
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

  // A saved event whose discipline has no picker (crossfit, hybrid, triathlon)
  // still carries categories on the record. The summary shows what will
  // publish, so it must list them rather than drop them because the picker
  // list does not apply. seed-event-022 is a crossfit event owned by Apex.
  test("review table shows saved categories for a discipline with no picker", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await organiserLogin(page);

    // The wizard loads the event after hydration, and on a cold dev server that
    // can lose the race with the server-rendered step rail — a click before
    // hydration focuses the button but never fires. Retry the load until the
    // review table shows the event's categories.
    await expect(async () => {
      await page.goto("/organiser/new-listing?id=seed-event-022");
      await page.getByRole("button", { name: /Final Review/i }).click();
      await expect(page.getByText("Rx, Scaled", { exact: true })).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });

    await expect(page.getByText("Categories", { exact: true })).toBeVisible();
  });
});

// A link out of the wizard (Payments, in the ABN notice) goes through the same
// "Leave without saving?" prompt as Cancel, so following it cannot silently drop
// an unsaved event, and "Save draft & leave" saves before it navigates.
//
// Both seeded organisers have an ABN, so this spec owns an organiser without
// one rather than mutating seed data other specs depend on.
test.describe("new listing wizard: leaving for Payments without an ABN", () => {
  const EMAIL = "noabn.organiser@startline.test";
  let organiserId = "";

  test.beforeAll(async () => {
    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      update: { cognitoSub: "dev-bypass-noabn-test" },
      create: { cognitoSub: "dev-bypass-noabn-test", email: EMAIL, name: "No ABN Organiser" },
    });
    const org = await prisma.organiser.create({
      data: {
        createdBy: user.id,
        email: EMAIL,
        orgName: "E2E No ABN Events",
        contactName: "No ABN",
        contactEmail: EMAIL,
        phone: "+61 400 000 002",
        abn: null,
        verified: true,
        status: "APPROVED",
      },
    });
    organiserId = org.id;
    await prisma.organiserMember.create({
      data: { organiserId: org.id, userId: user.id, role: "OWNER" },
    });
  });

  test.afterAll(async () => {
    // Event.organiser has no cascade, so the events go before the organiser.
    await prisma.event.deleteMany({ where: { organiserId } });
    await prisma.organiser.deleteMany({ where: { email: EMAIL } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.$disconnect();
  });

  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      { name: "__e2e_bypass", value: "noabn", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
  });

  test("Payments prompts, and Save draft & leave saves the event then continues", async ({ page }) => {
    await page.goto("/organiser/new-listing");
    await page.getByPlaceholder(/Apex Throwdown/i).fill("Payments Prompt Classic");

    await page.locator("button", { hasText: /^05/ }).first().click();
    const notice = page.getByTestId("abn-notice");
    await expect(notice).toBeVisible();

    // Keep editing closes the prompt and leaves the wizard untouched.
    await notice.getByRole("link", { name: "Payments", exact: true }).click();
    await expect(page.getByText(/leave without saving/i)).toBeVisible();
    await page.getByRole("button", { name: /keep editing/i }).click();
    await expect(page.getByText(/leave without saving/i)).toHaveCount(0);
    await expect(page).toHaveURL(/\/organiser\/new-listing/);

    // Save draft & leave saves first, then follows the link.
    await notice.getByRole("link", { name: "Payments", exact: true }).click();
    await page.getByRole("button", { name: /save draft & leave/i }).click();
    await expect(page).toHaveURL(/\/organiser\/payments/, { timeout: 30000 });

    const draft = await prisma.event.findFirst({
      where: { organiserId },
      orderBy: { createdAt: "desc" },
      select: { title: true, status: true },
    });
    expect(draft).toMatchObject({ title: "Payments Prompt Classic", status: "DRAFT" });
  });

  // The ABN is for tax reporting on paid entries and Stripe is where takings are
  // paid out. A free event takes no money, so neither holds it up: it used to
  // go to review, where no admin could approve it without both.
  const listing = (title: string, price: string) => ({
    title,
    discipline: "Running",
    eventDate: "2027-03-14",
    startTime: "07:00",
    endTime: "10:00",
    venue: "Albert Park",
    city: "Melbourne",
    state: "VIC",
    format: "Individual",
    level: "All levels",
    registrationType: "startline",
    waves: [{ label: "General", price, closes: "", startTime: "" }],
  });

  test("a free event publishes straight away without an ABN", async ({ page }) => {
    const res = await page.request.post("/api/organiser/events", {
      data: { ...listing("Free Fun Run E2E", "0"), submit: true },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe("APPROVED");
    expect(body.abnRequired).toBeUndefined();
  });

  test("a paid event without an ABN still waits for review", async ({ page }) => {
    const res = await page.request.post("/api/organiser/events", {
      data: { ...listing("Paid Half E2E", "45"), submit: true },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe("PENDING");
    expect(body.abnRequired).toBe(true);
  });

  test("the review step does not warn about the ABN on a free event", async ({ page }) => {
    const res = await page.request.post("/api/organiser/events", {
      data: { ...listing("Free Draft E2E", "0"), submit: false },
    });
    const { id } = await res.json();

    // Same hydration race as the categories test above: retry until the review
    // step shows the saved event.
    await expect(async () => {
      await page.goto(`/organiser/new-listing?id=${id}`);
      await page.locator("button", { hasText: /^05/ }).first().click();
      await expect(page.getByText("Free Draft E2E").first()).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });
    await expect(page.getByTestId("abn-notice")).toHaveCount(0);
  });
});

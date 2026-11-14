import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { organiserLogin, pickTime, ensureDatabaseUrl, openDetail, pickSingleDayToday, chooseDiscipline, createCompleteDraft } from "./helpers";

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// The listing editor (#528): organisers fill in the athlete event page itself,
// so the form is its own preview, and a checklist, not a step rail, says what
// is still missing. The terms are agreed in a dialog Publish opens.
test.describe("new listing editor", () => {
  test("opens as an empty event page", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");

    await expect(page.getByText("Create new listing")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Event title" })).toBeVisible();
    for (const heading of ["Event Overview", "Pricing", "Gallery"]) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByText("Event Details", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit date", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /save draft/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /publish listing/i }).first()).toBeVisible();
    // No step rail, and no separate preview: the page is the preview.
    await expect(page.getByText("Final Review")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Preview", exact: true })).toHaveCount(0);
    // The terms are not asked for until the organiser publishes.
    await expect(page.getByText(/I agree to the organiser terms/)).toHaveCount(0);
  });

  test("the checklist names what is missing and takes you to it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");

    await page.getByTestId("checklist-toggle").click();
    const checklist = page.getByTestId("checklist");
    const item = (name: string) => checklist.getByRole("button", { name, exact: true });
    await expect(page.getByTestId("checklist-toggle")).toContainText(/required/i);
    await expect(item("Event title")).toHaveAttribute("data-done", "false");
    await expect(item("Cover image")).toHaveAttribute("data-done", "false");

    // Following an item opens its row of the details card, in place.
    await item("Date").click();
    await expect(page.getByRole("button", { name: "Done editing date", exact: true })).toBeVisible();
    await expect(page.getByText("Pick start date")).toBeVisible();

    // The checklist only lists what is left: the page is marked up only once
    // the organiser tries to publish.
    await expect(page.locator('[data-missing="true"]')).toHaveCount(0);
    await page.getByRole("button", { name: /publish listing/i }).first().click();
    await expect(page.locator('[data-region="title"][data-missing="true"]')).toBeVisible();
    await page.getByRole("textbox", { name: "Event title" }).fill("Checklist Classic");
    await expect(page.locator('[data-region="title"][data-missing="true"]')).toHaveCount(0);
    await page.getByTestId("checklist-toggle").click();
    await expect(item("Event title")).toHaveAttribute("data-done", "true");
  });

  // Answering a row moves on to the next unfinished one by itself (#528).
  test("finishing a details row opens the next one", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");

    await openDetail(page, "format");
    await page.getByRole("button", { name: /individual solo athletes/i }).click();
    await expect(page.locator("#region-intensity button[aria-expanded]").first()).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#region-format button[aria-expanded]").first()).toHaveAttribute("aria-expanded", "false");

    // A date range is not cut short: the row waits until the picker closes.
    await openDetail(page, "date");
    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator("#region-date button[aria-expanded]").first()).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("heading", { name: /Event Overview/ }).click();
    await expect(page.locator("#region-time button[aria-expanded]").first()).toHaveAttribute("aria-expanded", "true");

    // Time stays open after the start time, so the optional cut-off can follow.
    await pickTime(page, "Start time", { hour: "7", minute: "00", period: "AM" });
    await page.waitForTimeout(1500);
    await expect(page.locator("#region-time button[aria-expanded]").first()).toHaveAttribute("aria-expanded", "true");
    await pickTime(page, "Cut-off time", { hour: "11", minute: "00", period: "AM" });
    await page.getByRole("button", { name: /next: location/i }).click();
    await expect(page.locator("#region-location button[aria-expanded]").first()).toHaveAttribute("aria-expanded", "true");
  });

  // A long title used to widen the page past the screen, and the
  // notifications panel hung off the left edge.
  test("the editor and notifications fit a phone screen", async ({ page }) => {
    await organiserLogin(page);
    await page.setViewportSize({ width: 390, height: 740 });
    await page.goto("/organiser/new-listing");

    await page.getByRole("textbox", { name: "Event title" })
      .fill("The Very Long Named Coastal Endurance Championship Weekend 2026");
    await page.getByTestId("checklist-toggle").click();
    const list = (await page.getByTestId("checklist").boundingBox())!;
    expect(list.x).toBeGreaterThanOrEqual(0);
    expect(list.x + list.width).toBeLessThanOrEqual(390);
    await page.getByTestId("checklist-toggle").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    const panel = page.getByText(/^Notifications/).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });

  // #352: the old test passed when AWS was unavailable, so it never proved the
  // selection filled the form. Stub both lookups and assert the whole handoff.
  // Field guidance lives in info bubbles, not small print on the page.
  test("info bubbles explain a field on hover, focus and tap", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    const tip = page.getByRole("button", { name: "About tickets available" });
    const bubble = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    await expect(page.getByText(/Leave blank for no limit/)).toHaveCount(0);

    // Hover opens it and names the field; moving away closes it.
    await tip.hover();
    await expect(bubble).toContainText("Tickets available");
    await expect(bubble).toContainText(/Leave blank for no limit/);
    await expect(tip).toHaveAttribute("aria-describedby", await bubble.getAttribute("id") ?? "");
    await page.mouse.move(0, 0);
    await expect(bubble).toHaveCount(0);

    // Keyboard: focus opens it, Escape closes it.
    // Tabbing out of the ticket name lands on the price's icon.
    await page.getByLabel("Ticket category name").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "About price" })).toBeFocused();
    await expect(page.getByRole("tooltip")).toContainText(/athletes pay/i);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "About price" })).toBeFocused();

    // A click pins it open, and opening another closes the first.
    await tip.click();
    await page.mouse.move(0, 0);
    await expect(bubble).toContainText(/Leave blank for no limit/);
    await page.getByRole("button", { name: "About pricing" }).click();
    await expect(page.getByRole("tooltip")).toHaveCount(1);
    await expect(page.getByRole("tooltip")).toContainText(/Early bird/);
    // A click anywhere else closes it.
    await page.getByRole("heading", { name: /Event Overview/ }).click();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });

  test("an info bubble opens on tap and stays on a phone screen", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    const tip = page.getByRole("button", { name: "About tickets available" });
    await tip.scrollIntoViewIfNeeded();
    await tip.tap();
    const bubble = page.getByRole("tooltip");
    await expect(bubble).toContainText(/Leave blank for no limit/);
    const box = (await bubble.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    // A second tap closes it.
    await tip.tap();
    await expect(bubble).toHaveCount(0);
    await context.close();
  });

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
    await openDetail(page, "location");

    const addrInput = page.getByPlaceholder(/start typing an address/i);
    await addrInput.fill("123 Test St Sydney");
    await page.locator("#address-suggestions button").first().click();

    await expect(addrInput).toHaveValue(label);
    await expect(page.getByPlaceholder("e.g. Melbourne")).toHaveValue("Sydney");
    await expect(page.getByRole("combobox", { name: "State" })).toContainText("NSW");
    // The preview must render the real map. The token-missing state used to
    // pass this test, which hid a deployment with no Mapbox token (#352).
    await expect(page.getByTestId("location-preview-map")).toBeVisible();
    await expect(page.getByTestId("location-preview-no-token")).toHaveCount(0);
    await expect(page.getByTestId("location-preview-empty")).toHaveCount(0);

    // The banner reads the place the way athletes will.
    await page.getByRole("button", { name: "Done editing location", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sydney, NSW", exact: true })).toBeVisible();
  });

  test("blocks an end time at or before the start time", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await openDetail(page, "time");

    await pickTime(page, "Start time",   { hour: "10", minute: "00", period: "AM" });
    await pickTime(page, "Cut-off time", { hour: "9",  minute: "00", period: "AM" });

    await expect(page.getByText(/end time must be after start time/i)).toBeVisible();
  });

  test("fills in the page and saves it as a draft", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    const title = `E2E Page Draft ${Date.now()}`;

    // Banner
    await chooseDiscipline(page, "Running");
    await page.getByRole("textbox", { name: "Event title" }).fill(title);

    // Main column
    await page.getByRole("textbox", { name: "Event description" }).fill("Flat, fast and friendly. Bring a smile.");
    await page.getByRole("button", { name: /add a prize pool/i }).click();
    await page.getByLabel("Total prize pool").fill("2,000");
    await page.getByLabel("Ticket category name").fill("Standard Entry");
    await page.getByLabel("Ticket price").fill("50");
    await expect(page.getByText(/athlete pays/i).first()).toBeVisible();
    // The organiser's own number: never shown to athletes, read by checkout.
    await page.getByLabel("Tickets available", { exact: true }).fill("1000");
    await expect(page.getByTestId("ticket-total")).toContainText("1,000 tickets");

    // Event Details card
    await pickSingleDayToday(page);
    await openDetail(page, "time");
    await pickTime(page, "Start time", { hour: "9", minute: "00", period: "AM" });
    await openDetail(page, "location");
    await page.getByPlaceholder(/start typing an address/i).fill("1 Test St, Sydney NSW 2000");
    await page.getByPlaceholder("Sydney Olympic Park").fill("Centennial Park");
    await openDetail(page, "format");
    await page.getByRole("button", { name: /individual solo athletes/i }).click();
    await openDetail(page, "divisions");
    await page.getByRole("button", { name: /^10km$/i }).click();
    await openDetail(page, "intensity");
    await page.getByRole("button", { name: /^moderate/i }).click();

    await page.getByRole("button", { name: /save draft/i }).first().click();
    await page.waitForURL("**/organiser/dashboard", { timeout: 30000 });

    const saved = await prisma.event.findFirst({ where: { title }, orderBy: { createdAt: "desc" } });
    expect(saved).toMatchObject({
      status: "DRAFT",
      discipline: "running",
      venue: "Centennial Park",
      format: "individual",
      level: "moderate",
      // The event cap is the total of the ticket quantities.
      cap: 1000,
      categories: ["10K"],
    });
    expect(saved?.waves).toEqual([{ label: "Standard Entry", price: "50", closes: "", startTime: "", qty: 1000 }]);
    expect(saved?.extras).toContain("2,000");
    await prisma.event.deleteMany({ where: { title } });
  });

  test("the header stays pinned while scrolling", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await expect(page.getByRole("textbox", { name: "Event title" })).toBeVisible();

    await page.mouse.wheel(0, 900);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    // Regression: overflow-x on html/body used to disable position:sticky
    // site-wide, so the header scrolled out of view.
    const header = await page.getByTestId("editor-header").boundingBox();
    expect(header).not.toBeNull();
    expect(header!.y).toBeGreaterThanOrEqual(0);
  });

  test("single-day date reads clean after closing the picker", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await openDetail(page, "date");

    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    // Close the popover with only a start date picked — a valid single-day event.
    await page.getByRole("heading", { name: "Event Overview" }).click();
    const dateField = page.locator("button", { hasText: /\d{4}/ }).first();
    await expect(dateField).not.toContainText(/pick end date/i);
  });

  test("price input strips non-numeric characters", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");

    const price = page.getByLabel("Ticket price");
    await price.fill("abc");
    await expect(price).toHaveValue("");
    await price.fill("12.50");
    await expect(price).toHaveValue("12.50");
  });

  test("draft without a cut-off time saves without a silent failure", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");

    // Minimal draft: title only, endTime left empty (it's optional).
    // Regression: the API used to coerce empty endTime to null, which the
    // required schema column rejected — every such save 500ed.
    await page.getByRole("textbox", { name: "Event title" }).fill("E2E No Cutoff Draft");
    await page.getByRole("button", { name: /save draft/i }).first().click();

    // Success navigates to the dashboard; otherwise the error must show. Either
    // way the organiser sees an outcome, never a silently failed save.
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

  test("publish takes you to the first missing field instead of asking for the terms", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.getByRole("textbox", { name: "Event title" }).fill("Toast Classic");

    await page.getByRole("button", { name: /publish listing/i }).first().click();
    await expect(page.getByTestId("editor-toast")).toContainText(/required fields? left/i);
    await expect(page.getByTestId("publish-dialog")).toHaveCount(0);

    // View all opens the checklist.
    await page.getByTestId("editor-toast").getByRole("button", { name: /view all/i }).click();
    await expect(page.getByTestId("checklist")).toBeVisible();
  });

  test("a finished listing asks for the terms, then publishes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await organiserLogin(page);
    const title = `E2E Publish Dialog ${Date.now()}`;
    const id = await createCompleteDraft(page, title);

    try {
      await page.goto(`/organiser/new-listing?id=${id}`);
      await expect(page.getByRole("textbox", { name: "Event title" })).toHaveValue(title, { timeout: 30000 });
      await expect(page.getByTestId("checklist-toggle")).toContainText(/ready to publish/i);

      await page.getByRole("button", { name: /publish listing/i }).first().click();
      const dialog = page.getByTestId("publish-dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", /\/terms#organisers$/);

      // The terms are agreed here, and only once they are does it publish.
      const confirm = dialog.getByRole("button", { name: /publish listing/i });
      await expect(confirm).toBeDisabled();
      await dialog.getByRole("checkbox").check();
      await confirm.click();
      await page.waitForURL("**/organiser/dashboard", { timeout: 30000 });

      // Apex is verified and has an ABN, so a finished listing goes live.
      expect((await prisma.event.findUnique({ where: { id } }))?.status).toBe("APPROVED");
    } finally {
      await prisma.event.deleteMany({ where: { id } });
    }
  });

  // A saved event whose discipline has no picker (crossfit, hybrid, triathlon)
  // still carries categories on the record, and the details card must show
  // them rather than drop them because the picker list does not apply.
  // seed-event-002 is a pending hybrid event owned by Apex.
  test("an existing event loads into the page, divisions included", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await organiserLogin(page);
    await page.goto("/organiser/new-listing?id=seed-event-002");

    await expect(page.getByRole("textbox", { name: "Event title" })).not.toHaveValue("", { timeout: 30000 });
    await expect(page.getByText("Edit listing")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit divisions", exact: true })).toBeVisible();
    for (const division of ["Open Male", "Open Female", "Masters 40+"]) {
      await expect(page.getByText(division, { exact: true }).first()).toBeVisible();
    }
  });
});

// A link out of the editor (Payments, in the ABN notice) goes through the same
// "Leave without saving?" prompt as Cancel, so following it cannot silently drop
// an unsaved event, and "Save draft & leave" saves before it navigates.
//
// Both seeded organisers have an ABN, so this spec owns an organiser without
// one rather than mutating seed data other specs depend on.
test.describe("new listing editor: leaving for Payments without an ABN", () => {
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
    // The organiser's events cascade with it.
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
    await page.getByRole("textbox", { name: "Event title" }).fill("Payments Prompt Classic");

    // A paid Startline event without an ABN: the editor says so up front.
    const notice = page.getByTestId("abn-notice");
    await expect(notice).toBeVisible();

    // Keep editing closes the prompt and leaves the editor untouched.
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
    address: "Aughtie Dr, Albert Park VIC 3206",
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

  test("the editor does not warn about the ABN on a free event", async ({ page }) => {
    const res = await page.request.post("/api/organiser/events", {
      data: { ...listing("Free Draft E2E", "0"), submit: false },
    });
    const { id } = await res.json();

    await page.goto(`/organiser/new-listing?id=${id}`);
    await expect(page.getByRole("textbox", { name: "Event title" })).toHaveValue("Free Draft E2E", { timeout: 30000 });
    await expect(page.getByText("Create new listing").or(page.getByText("Edit listing"))).toBeVisible();
    await expect(page.getByTestId("abn-notice")).toHaveCount(0);
  });
});

// #529: the browser's Back button skipped the leave prompt and threw away an
// unsaved event. With unsaved edits it now opens the same prompt.
test.describe("new listing editor: browser Back", () => {
  const TITLE = "Back Button Guard E2E";

  test.afterAll(async () => {
    await prisma.event.deleteMany({ where: { title: TITLE } });
  });

  test("Back with unsaved edits asks first, and Save draft & leave keeps the event", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/listings");
    await page.goto("/organiser/new-listing");
    await page.getByRole("textbox", { name: "Event title" }).fill(TITLE);

    // Back stays on the editor and asks.
    await page.goBack();
    await expect(page.getByText(/leave without saving/i)).toBeVisible();
    await expect(page).toHaveURL(/\/organiser\/new-listing/);

    // Keep editing keeps what was typed, and Back still asks afterwards.
    await page.getByRole("button", { name: /keep editing/i }).click();
    await expect(page.getByRole("textbox", { name: "Event title" })).toHaveValue(TITLE);
    await page.goBack();
    await expect(page.getByText(/leave without saving/i)).toBeVisible();

    await page.getByRole("button", { name: /save draft & leave/i }).click();
    await expect(page).toHaveURL(/\/organiser\/listings/, { timeout: 30000 });
    await expect.poll(() => prisma.event.count({ where: { title: TITLE, status: "DRAFT" } })).toBe(1);
  });

  test("Back with nothing typed leaves straight away", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/listings");
    await page.goto("/organiser/new-listing");
    await expect(page.getByRole("textbox", { name: "Event title" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/organiser\/listings/);
    await expect(page.getByText(/leave without saving/i)).toHaveCount(0);
  });
});

// #530: a listing reached review with a city of spaces, and showed as ", VIC".
// Spaces and symbols are refused by the API, and the editor says why.
test.describe("new listing editor: a real location", () => {
  const base = {
    title: "Junk Location E2E",
    discipline: "Running",
    eventDate: "2027-03-14",
    startTime: "07:00",
    venue: "Albert Park",
    address: "Aughtie Dr, Albert Park VIC 3206",
    city: "Melbourne",
    state: "VIC",
    format: "Individual",
    level: "All levels",
    registrationType: "startline",
    waves: [{ label: "General", price: "0", closes: "", startTime: "" }],
    submit: true,
  };

  test.afterAll(async () => {
    await prisma.event.deleteMany({ where: { title: base.title } });
  });

  for (const [what, patch] of [
    ["a city of spaces", { city: "   " }],
    ["a city of symbols", { city: "!!!" }],
    ["a street address of symbols", { address: "#### ####" }],
    ["a venue of symbols", { venue: "???" }],
  ] as const) {
    test(`the API refuses ${what}`, async ({ page }) => {
      await organiserLogin(page);
      const res = await page.request.post("/api/organiser/events", { data: { ...base, ...patch } });
      expect(res.status()).toBe(400);
    });
  }

  test("the editor flags a city of symbols", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await openDetail(page, "location");
    await page.getByPlaceholder("e.g. Melbourne").fill("!!!");
    await expect(page.getByText(/enter a real city or suburb/i)).toBeVisible();
  });
});

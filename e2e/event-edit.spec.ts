import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { organiserLogin, ensureDatabaseUrl } from "./helpers";

// Editing a published event (#490): every edit is logged, and changing the
// date, time, location or type of an event with paid entrants offers those
// entrants a full refund, which the organiser must confirm first.

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EVENT_ID = "e2e-event-edit-refunds";
const EARLY_ID = "e2e-event-edit-early-entrant";
const HARPER_ID = "e2e-event-edit-harper";
const LATE_ID = "e2e-event-edit-late-entrant";

function isoDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const eventDate = isoDate(60);

async function resetFixture() {
  const organiser = await prisma.organiser.findFirst({
    where: { orgName: "Apex Endurance Events" },
    select: { id: true },
  });
  expect(organiser, "seeded Apex organiser should exist").toBeTruthy();

  await prisma.registration.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.eventChange.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.event.deleteMany({ where: { id: EVENT_ID } });

  const startsAtUtc = new Date(`${eventDate}T07:00:00+11:00`);
  await prisma.event.create({
    data: {
      id: EVENT_ID,
      organiserId: organiser!.id,
      status: "APPROVED",
      title: "E2E Edit Refunds 10K",
      discipline: "running",
      description: "<p>Flat and fast.</p>",
      eventDate,
      startTime: "07:00",
      endTime: "10:00",
      timeZone: "Australia/Melbourne",
      startsAtUtc,
      endsAtUtc: new Date(startsAtUtc.getTime() + 3 * 60 * 60 * 1000),
      venue: "Albert Park",
      address: "Aughtie Drive",
      city: "Melbourne",
      state: "vic",
      format: "individual",
      level: "moderate",
      categories: ["10K"],
      cap: 500,
      minAge: 16,
      waves: [{ label: "General", price: "45", closes: "", startTime: "" }],
      refundTiers: [{ daysBefore: 30, percent: 100 }],
      coverImageUrl: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1600&q=80",
      photos: [],
    },
  });

  // Two paid entrants before any change. No payment intent, so a refund here
  // takes the route's no-charge path and never reaches Stripe.
  const entrant = (id: string, name: string, email: string) => ({
    id,
    eventId: EVENT_ID,
    organiserId: organiser!.id,
    athleteName: name,
    athleteEmail: email,
    status: "CONFIRMED" as const,
    amountCents: 4500,
    platformFeeCents: 323,
    feeStructure: "athlete",
  });
  await prisma.registration.createMany({
    data: [
      entrant(EARLY_ID, "Early Entrant", "early.entrant@startline.test"),
      entrant(HARPER_ID, "Harper Jones", "harper.jones@startline.test"),
    ],
  });
}

test.beforeEach(resetFixture);

test.afterAll(async () => {
  await prisma.registration.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.eventChange.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.event.deleteMany({ where: { id: EVENT_ID } });
  await prisma.$disconnect();
});

/** Open the wizard on the fixture, with the hydration retry new-listing.spec uses. */
async function openWizardAt(page: Page, stepPrefix: string, expectVisible: () => Promise<void>) {
  await expect(async () => {
    await page.goto(`/organiser/new-listing?id=${EVENT_ID}&from=${encodeURIComponent(`/organiser/events/${EVENT_ID}`)}`);
    await page.locator("button", { hasText: new RegExp(`^${stepPrefix}`) }).first().click();
    await expectVisible();
  }).toPass({ timeout: 30000 });
}

async function saveFromReview(page: Page) {
  await page.locator("button", { hasText: /^05/ }).first().click();
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: /Save changes/ }).click();
}

test.describe("editing a published event", () => {
  test("a non-material edit saves straight away and is logged", async ({ page }) => {
    await organiserLogin(page);

    const res = await page.request.patch(`/api/organiser/events/${EVENT_ID}`, {
      data: { description: "<p>Flat, fast and now with pacers.</p>" },
    });
    expect(res.ok()).toBe(true);
    expect((await res.json()).status).toBe("APPROVED");

    const changes = await prisma.eventChange.findMany({ where: { eventId: EVENT_ID }, orderBy: { kind: "asc" } });
    // A baseline of the original details, then the edit.
    expect(changes.map((c) => c.kind)).toEqual(["BASELINE", "EDIT"]);
    expect(changes[1].material).toBe(false);

    const entrants = await prisma.registration.findMany({ where: { eventId: EVENT_ID } });
    expect(entrants.every((r) => r.fullRefundUntil === null)).toBe(true);
  });

  test("a venue change warns first; keeping the original details saves nothing", async ({ page }) => {
    await organiserLogin(page);
    await openWizardAt(page, "02", async () => {
      await expect(page.getByPlaceholder("Sydney Olympic Park")).toHaveValue("Albert Park", { timeout: 3000 });
    });

    await expect(page.getByTestId("change-refund-notice")).toContainText("2 athletes have paid to enter");
    await page.getByPlaceholder("Sydney Olympic Park").fill("Princes Park");
    await saveFromReview(page);

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("This change triggers full refunds");
    await expect(dialog).toContainText("2 athletes have");
    await expect(page.getByTestId("change-refund-diff")).toContainText("Albert Park");
    await expect(page.getByTestId("change-refund-diff")).toContainText("Princes Park");

    await dialog.getByRole("button", { name: "Keep original details" }).click();
    await expect(dialog).toHaveCount(0);

    const event = await prisma.event.findUnique({ where: { id: EVENT_ID } });
    expect(event?.venue).toBe("Albert Park");
    expect(await prisma.eventChange.count({ where: { eventId: EVENT_ID } })).toBe(0);
  });

  test("confirming saves the change, entitles existing entrants only, and shows in the history", async ({ page }) => {
    await organiserLogin(page);
    await openWizardAt(page, "02", async () => {
      await expect(page.getByPlaceholder("Sydney Olympic Park")).toHaveValue("Albert Park", { timeout: 3000 });
    });
    await page.getByPlaceholder("Sydney Olympic Park").fill("Princes Park");
    await saveFromReview(page);
    await page.getByRole("alertdialog").getByRole("button", { name: "Save and offer refunds" }).click();

    // Saving returns to the event page, which sends a live event on to its dashboard.
    await expect(page).toHaveURL(new RegExp(`/organiser/events/${EVENT_ID}(/dashboard)?$`));

    const entrants = await prisma.registration.findMany({ where: { eventId: EVENT_ID } });
    expect(entrants).toHaveLength(2);
    expect(entrants.every((r) => r.fullRefundUntil && r.fullRefundUntil.getTime() > Date.now())).toBe(true);

    // Someone entering after the change is on the normal policy.
    const organiserId = entrants[0].organiserId;
    await prisma.registration.create({
      data: {
        id: LATE_ID, eventId: EVENT_ID, organiserId, athleteName: "Late Entrant",
        athleteEmail: "late.entrant@startline.test", status: "CONFIRMED", amountCents: 4500, platformFeeCents: 323,
      },
    });
    const late = await prisma.registration.findUnique({ where: { id: LATE_ID } });
    expect(late?.fullRefundUntil).toBeNull();

    const history = page.getByTestId("event-change-history");
    await expect(history).toBeVisible();
    const first = history.getByTestId("event-change-entry").first();
    await expect(first).toContainText("Date, location or type");
    await expect(first).toContainText("Albert Park");
    await expect(first).toContainText("Princes Park");
    await expect(first).toContainText("2 registered athletes offered a full refund");
    await expect(history.getByTestId("event-change-entry").last()).toContainText("Original details");
  });

  test("an entitled athlete sees the change and gets everything back", async ({ page, context }) => {
    await organiserLogin(page);
    const res = await page.request.patch(`/api/organiser/events/${EVENT_ID}`, {
      data: { venue: "Princes Park", acknowledgeChangeRefunds: true },
    });
    expect(res.ok()).toBe(true);
    expect((await res.json()).affectedCount).toBe(2);

    await context.clearCookies();
    await context.addCookies([{ name: "__e2e_bypass", value: "athlete", url: "http://localhost:3000" }]);
    await page.goto("/activity");

    const notice = page.getByTestId("event-changed-notice");
    await expect(notice).toContainText("This event has changed");
    await expect(notice).toContainText("Princes Park");

    await page.getByRole("button", { name: "Withdraw for a full refund" }).click();
    const breakdown = page.getByTestId("full-refund-breakdown");
    await expect(breakdown).toContainText("A$45.00");
    await expect(breakdown).toContainText("A$3.23");
    await expect(breakdown).toContainText("A$48.23");
    await page.getByRole("button", { name: "Withdraw and refund in full" }).click();

    await expect.poll(async () =>
      (await prisma.registration.findUnique({ where: { id: HARPER_ID } }))?.status,
    ).toBe("REFUNDED");
    const harper = await prisma.registration.findUnique({ where: { id: HARPER_ID } });
    expect(harper).toMatchObject({ refundType: "FULL", refundPercent: 100, refundAmountCents: 4823 });
  });

  test("an event that is underway stays locked", async ({ page }) => {
    await organiserLogin(page);
    const now = Date.now();
    await prisma.event.update({
      where: { id: EVENT_ID },
      // The route re-derives the status from the local dates, so they must say
      // "underway" too, not just the stored UTC instants.
      data: {
        status: "IN_PROGRESS",
        eventDate: isoDate(-1),
        endDate: isoDate(1),
        startsAtUtc: new Date(now - 86_400_000),
        endsAtUtc: new Date(now + 86_400_000),
      },
    });

    const res = await page.request.patch(`/api/organiser/events/${EVENT_ID}`, {
      data: { venue: "Somewhere else", acknowledgeChangeRefunds: true },
    });
    expect(res.status()).toBe(409);
  });
});

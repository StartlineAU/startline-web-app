import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { organiserLogin, adminLogin, ensureDatabaseUrl, openDetail } from "./helpers";

// Editing a published event (#490): every edit is logged, and changing the
// date, time, location or type of an event emails the athletes already entered.
// There is no automatic refund: a refund is raised through Support.

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

/** Open the listing editor on the fixture, once its details have loaded. */
async function openEditor(page: Page) {
  await page.goto(`/organiser/new-listing?id=${EVENT_ID}&from=${encodeURIComponent(`/organiser/events/${EVENT_ID}`)}`);
  await expect(page.getByRole("textbox", { name: "Event title" })).not.toHaveValue("", { timeout: 30000 });
}

/** A live event saves its changes straight away; it agreed to the terms when published. */
async function saveChanges(page: Page) {
  await page.getByRole("button", { name: /Save changes/ }).first().click();
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
  });

  test("a venue change saves and is logged, and offers no automatic refund", async ({ page }) => {
    await organiserLogin(page);
    await openEditor(page);
    await openDetail(page, "location");
    await expect(page.getByPlaceholder("Sydney Olympic Park")).toHaveValue("Albert Park");

    await expect(page.getByTestId("change-notice")).toContainText("2 athletes have entered");
    await page.getByPlaceholder("Sydney Olympic Park").fill("Princes Park");
    await saveChanges(page);

    await expect(page).toHaveURL(new RegExp(`/organiser/events/${EVENT_ID}(/dashboard)?$`));
    expect((await prisma.event.findUnique({ where: { id: EVENT_ID } }))?.venue).toBe("Princes Park");

    const history = page.getByTestId("event-change-history");
    await expect(history).toBeVisible();
    const first = history.getByTestId("event-change-entry").first();
    await expect(first).toContainText("Date, location or type");
    await expect(first).toContainText("Albert Park");
    await expect(first).toContainText("Princes Park");
    await expect(first).toContainText("A refund is requested through Support");
  });

  test("a paid entry has no refund button and is sent to Support", async ({ page, context }) => {
    await organiserLogin(page);
    const res = await page.request.patch(`/api/organiser/events/${EVENT_ID}`, {
      data: { venue: "Princes Park" },
    });
    expect(res.ok()).toBe(true);

    await context.clearCookies();
    await context.addCookies([{ name: "__e2e_bypass", value: "athlete", url: "http://localhost:3000" }]);
    await page.goto("/activity");

    await expect(page.getByRole("button", { name: /Withdraw/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Request a refund" }).first()).toHaveAttribute("href", "/support");

    // The old route refuses a paid entry.
    const refused = await page.request.post(`/api/user/registrations/${HARPER_ID}/refund-request`);
    expect(refused.status()).toBe(409);
    expect((await prisma.registration.findUnique({ where: { id: HARPER_ID } }))?.status).toBe("CONFIRMED");
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
      data: { venue: "Somewhere else" },
    });
    expect(res.status()).toBe(409);
  });
});

test.describe("unverified organiser edits a published event", () => {
  const EVENT_ID = "e2e-unverified-edit";

  test("the listing stays live until an admin approves the edit", async ({ page }) => {
    const organiser = await prisma.organiser.findFirst({
      where: { orgName: "Coastal Fitness Collective" },
      select: { id: true, verified: true },
    });
    expect(organiser, "seeded Coastal organiser should exist").toBeTruthy();

    await prisma.registration.deleteMany({ where: { eventId: EVENT_ID } });
    await prisma.eventChange.deleteMany({ where: { eventId: EVENT_ID } });
    await prisma.eventRevision.deleteMany({ where: { eventId: EVENT_ID } });
    await prisma.event.deleteMany({ where: { id: EVENT_ID } });
    await prisma.organiser.update({ where: { id: organiser!.id }, data: { verified: false } });

    const startsAtUtc = new Date(`${eventDate}T07:00:00+11:00`);
    await prisma.event.create({
      data: {
        id: EVENT_ID,
        organiserId: organiser!.id,
        status: "APPROVED",
        title: "E2E Unverified Edit",
        discipline: "running",
        eventDate,
        startTime: "07:00",
        endTime: "10:00",
        timeZone: "Australia/Melbourne",
        startsAtUtc,
        endsAtUtc: new Date(startsAtUtc.getTime() + 3 * 60 * 60 * 1000),
        venue: "Albert Park",
        city: "Melbourne",
        state: "vic",
        format: "individual",
        level: "moderate",
        categories: ["10K"],
        waves: [{ label: "General", price: "0", closes: "", startTime: "" }],
        coverImageUrl: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1600&q=80",
        photos: [],
      },
    });

    try {
      await page.context().addCookies([
        { name: "__e2e_bypass", value: "user", domain: "localhost", path: "/", sameSite: "Lax" },
      ]);
      const queued = await page.request.patch(`/api/organiser/events/${EVENT_ID}`, {
        data: { venue: "Princes Park" },
      });
      expect(queued.status()).toBe(200);
      expect((await queued.json()).pendingReview).toBe(true);
      expect((await prisma.event.findUnique({ where: { id: EVENT_ID } }))?.venue).toBe("Albert Park");

      await adminLogin(page);
      const approved = await page.request.post(`/api/admin/events/${EVENT_ID}/revision`, {
        data: { action: "approve" },
      });
      expect(approved.status()).toBe(200);
      expect((await prisma.event.findUnique({ where: { id: EVENT_ID } }))?.venue).toBe("Princes Park");
    } finally {
      await prisma.organiser.update({ where: { id: organiser!.id }, data: { verified: organiser!.verified } });
      await prisma.eventRevision.deleteMany({ where: { eventId: EVENT_ID } });
      await prisma.eventChange.deleteMany({ where: { eventId: EVENT_ID } });
      await prisma.event.deleteMany({ where: { id: EVENT_ID } });
    }
  });
});

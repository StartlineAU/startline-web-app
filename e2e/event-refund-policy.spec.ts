import { test, expect } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { organiserLogin, ensureDatabaseUrl } from "./helpers";

// #580: a listing uses its organisation's refund policy unless the organiser
// sets one for that event. Entries already sold keep the policy they bought
// under, and an organisation-wide change no longer overwrites an event's own.

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EVENT_ID = "e2e-event-refund-policy";
const ENTRY_ID = "e2e-event-refund-policy-entry";
const ORG_TIERS = [{ daysBefore: 30, percent: 100 }];
const OWN_TIERS = [{ daysBefore: 0, percent: 100 }];

function isoDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

let organiserId = "";
let savedOrgPolicy: { refundTiers: unknown; refundPolicy: string | null } | null = null;

async function clearFixture() {
  await prisma.registration.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.eventChange.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.event.deleteMany({ where: { id: EVENT_ID } });
}

test.beforeAll(async () => {
  const organiser = await prisma.organiser.findFirstOrThrow({
    where: { orgName: "Apex Endurance Events" },
    select: { id: true, refundTiers: true, refundPolicy: true },
  });
  organiserId = organiser.id;
  savedOrgPolicy = { refundTiers: organiser.refundTiers, refundPolicy: organiser.refundPolicy };
});

test.beforeEach(async () => {
  await clearFixture();
  const eventDate = isoDate(60);
  const startsAtUtc = new Date(`${eventDate}T07:00:00+11:00`);
  await prisma.event.create({
    data: {
      id: EVENT_ID,
      organiserId,
      status: "APPROVED",
      title: "E2E Refund Policy 10K",
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
      refundTiers: ORG_TIERS,
      refundFollowsOrg: true,
      photos: [],
    },
  });
  await prisma.registration.create({
    data: {
      id: ENTRY_ID,
      eventId: EVENT_ID,
      organiserId,
      athleteName: "Early Entrant",
      athleteEmail: "early.entrant@startline.test",
      status: "CONFIRMED",
      amountCents: 4500,
      platformFeeCents: 323,
      feeStructure: "athlete",
    },
  });
});

test.afterAll(async () => {
  await clearFixture();
  if (savedOrgPolicy) {
    await prisma.organiser.update({
      where: { id: organiserId },
      data: {
        refundTiers: savedOrgPolicy.refundTiers == null
          ? Prisma.DbNull
          : (savedOrgPolicy.refundTiers as Prisma.InputJsonValue),
        refundPolicy: savedOrgPolicy.refundPolicy,
      },
    });
  }
  await prisma.$disconnect();
});

test("an event's own policy freezes what was sold and survives an organisation change", async ({ page }) => {
  await organiserLogin(page);

  // The organiser sets a policy for this event alone.
  const own = await page.request.patch(`/api/organiser/events/${EVENT_ID}`, {
    data: { refundFollowsOrg: false, refundTiers: OWN_TIERS, refundPolicy: "Transfers are free." },
  });
  expect(own.status()).toBe(200);
  expect(await prisma.event.findUnique({ where: { id: EVENT_ID } })).toMatchObject({
    refundFollowsOrg: false,
    refundTiers: OWN_TIERS,
    refundPolicy: "Transfers are free.",
  });
  // The athlete who entered first keeps the policy they bought under.
  expect((await prisma.registration.findUnique({ where: { id: ENTRY_ID } }))?.soldRefundTiers).toEqual(ORG_TIERS);

  // An organisation-wide change leaves the event's own policy alone.
  const orgSave = await page.request.patch("/api/organiser/profile", {
    data: { refundTiers: [{ daysBefore: 14, percent: 50 }], refundPolicy: null },
  });
  expect(orgSave.status()).toBe(200);
  expect((await prisma.event.findUnique({ where: { id: EVENT_ID } }))?.refundTiers).toEqual(OWN_TIERS);

  // Going back to the organisation's policy takes it again.
  const back = await page.request.patch(`/api/organiser/events/${EVENT_ID}`, { data: { refundFollowsOrg: true } });
  expect(back.status()).toBe(200);
  expect(await prisma.event.findUnique({ where: { id: EVENT_ID } })).toMatchObject({
    refundFollowsOrg: true,
    refundTiers: [{ daysBefore: 14, percent: 50 }],
  });
});

test("the listing editor offers the organisation's policy and a policy for this event", async ({ page }) => {
  await prisma.organiser.update({ where: { id: organiserId }, data: { refundTiers: ORG_TIERS } });
  await organiserLogin(page);
  await page.goto(`/organiser/new-listing?id=${EVENT_ID}`);
  const card = page.getByTestId("refund-card");
  await expect(card).toContainText("Your organisation's policy", { timeout: 15000 });
  await card.getByRole("button", { name: "Set a policy for this event" }).click();
  await expect(card).toContainText("This event's own policy");
  await card.getByRole("radio", { name: "Always refundable" }).click();
  await expect(card).toContainText("Any time before the event: full refund.");
  await expect(card.getByRole("button", { name: "Use my organisation's policy" })).toBeVisible();
});

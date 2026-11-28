import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl, organiserLogin } from "./helpers";

// Cancelling is the new delete for an event with entries. Every athlete is
// refunded everything they paid, booking fee included; a free entry is
// released. The paid entries here carry fake PaymentIntent ids, so whether the
// Stripe call succeeds depends on the environment. What must hold either way is
// that every paid entry is flagged for a full refund and none is left behind:
// a failed refund is recorded FAILED and retried by the lifecycle worker.

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EVENT_ID = "e2e-event-cancel";
const EMPTY_EVENT_ID = "e2e-event-cancel-empty";
const PAID_A = "e2e-event-cancel-paid-a";
const PAID_B = "e2e-event-cancel-paid-b";
const FREE = "e2e-event-cancel-free";

const cookie = (identity: string) => ({ Cookie: `__e2e_bypass=${identity}` });

function eventData(id: string, organiserId: string) {
  const startsAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
  return {
    id,
    organiserId,
    status: "APPROVED" as const,
    title: `E2E Cancel ${id}`,
    discipline: "running",
    eventDate: startsAt.toISOString().slice(0, 10),
    startTime: "07:30",
    endTime: "12:00",
    timeZone: "Australia/Sydney",
    startsAtUtc: startsAt,
    endsAtUtc: new Date(startsAt.getTime() + 4 * 60 * 60 * 1000),
    venue: "Test Venue",
    city: "Sydney",
    state: "nsw",
    format: "individual",
    level: "open",
    categories: [],
    waves: [{ label: "General", price: "45" }],
    photos: [],
    registrationType: "startline",
    feeStructure: "athlete",
  };
}

function registration(id: string, organiserId: string, paid: boolean) {
  return {
    id,
    eventId: EVENT_ID,
    organiserId,
    athleteName: `Athlete ${id}`,
    athleteEmail: `${id}@startline.test`,
    waveLabel: "General",
    amountCents: paid ? 4500 : 0,
    platformFeeCents: paid ? 323 : 0,
    // Both paid entries share one PaymentIntent, like a group booking.
    stripePaymentIntentId: paid ? "pi_e2e_event_cancel_group" : null,
    feeStructure: "athlete",
    status: "CONFIRMED" as const,
  };
}

async function cleanup() {
  await prisma.supportTicket.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.userNotification.deleteMany({ where: { eventId: { in: [EVENT_ID, EMPTY_EVENT_ID] } } });
  await prisma.notification.deleteMany({ where: { eventId: { in: [EVENT_ID, EMPTY_EVENT_ID] } } });
  await prisma.registration.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.event.deleteMany({ where: { id: { in: [EVENT_ID, EMPTY_EVENT_ID] } } });
}

let apexId = "";

test.beforeAll(async () => {
  await cleanup();
  const apex = await prisma.organiser.findFirst({
    where: { orgName: "Apex Endurance Events" },
    select: { id: true },
  });
  expect(apex, "seeded Apex organiser should exist").toBeTruthy();
  apexId = apex!.id;
});

test.beforeEach(async () => {
  await cleanup();
  await prisma.event.create({ data: eventData(EVENT_ID, apexId) });
  await prisma.event.create({ data: eventData(EMPTY_EVENT_ID, apexId) });
  await prisma.registration.createMany({
    data: [registration(PAID_A, apexId, true), registration(PAID_B, apexId, true), registration(FREE, apexId, false)],
  });
});

test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("an event with entries can't be deleted, and points at cancelling", async () => {
  const res = await fetch(`${BASE_URL}/api/organiser/events/${EVENT_ID}`, {
    method: "DELETE",
    headers: cookie("organiser"),
  });
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("HAS_ENTRIES");
  expect(body.error).toMatch(/Cancel it instead/);
});

test("the cancel preview totals everything paid, booking fee included", async () => {
  const res = await fetch(`${BASE_URL}/api/organiser/events/${EVENT_ID}/cancel`, { headers: cookie("organiser") });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ entries: 3, paidEntries: 2, refundCents: 2 * (4500 + 323) });
});

test("only an owner can cancel", async () => {
  const res = await fetch(`${BASE_URL}/api/organiser/events/${EVENT_ID}/cancel`, {
    method: "POST",
    headers: { ...cookie("member"), "Content-Type": "application/json" },
    body: "{}",
  });
  expect(res.status).toBe(403);
  expect((await prisma.event.findUnique({ where: { id: EVENT_ID } }))?.status).toBe("APPROVED");
});

test("cancelling flags every paid entry for a full refund and releases free ones", async () => {
  const ticket = await prisma.supportTicket.create({
    data: {
      name: "Athlete", email: `${PAID_A}@startline.test`, requestType: "refund",
      eventId: EVENT_ID, organiserId: apexId, reason: "Can't make it.",
    },
  });

  const res = await fetch(`${BASE_URL}/api/organiser/events/${EVENT_ID}/cancel`, {
    method: "POST",
    headers: { ...cookie("organiser"), "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "Permit withdrawn" }),
  });
  expect(res.status).toBe(200);

  const event = await prisma.event.findUnique({ where: { id: EVENT_ID } });
  expect(event).toMatchObject({ status: "CANCELLED", cancelledByRole: "organiser", cancellationReason: "Permit withdrawn" });

  const rows = await prisma.registration.findMany({ where: { eventId: EVENT_ID }, orderBy: { id: "asc" } });
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  expect(byId[FREE].status).toBe("CANCELLED");
  for (const id of [PAID_A, PAID_B]) {
    // Refunded in full now, or recorded for the worker to retry. Never dropped.
    expect(["DONE", "FAILED", "PENDING"]).toContain(byId[id].cancelRefundStatus);
    if (byId[id].cancelRefundStatus === "DONE") {
      expect(byId[id]).toMatchObject({ status: "REFUNDED", refundAmountCents: 4500 + 323 });
    }
  }

  // The open refund ticket is settled by the cancellation.
  expect((await prisma.supportTicket.findUnique({ where: { id: ticket.id } }))?.status).toBe("REFUNDED");

  // Entries of a cancelled event can no longer be changed by hand.
  const patch = await fetch(`${BASE_URL}/api/organiser/events/${EVENT_ID}/registrations`, {
    method: "PATCH",
    headers: { ...cookie("organiser"), "Content-Type": "application/json" },
    body: JSON.stringify({ registrations: [{ registrationId: FREE, status: "CONFIRMED" }] }),
  });
  expect(patch.status).toBe(409);

  // A refund request for it is answered with the automatic refund instead.
  // Every refund request names its entry and comes from the entry's athlete,
  // so the entry is handed to Harper and she asks for it.
  await prisma.registration.update({
    where: { id: PAID_B },
    data: { athleteEmail: "harper.jones@startline.test" },
  });
  const support = await fetch(`${BASE_URL}/api/support`, {
    method: "POST",
    headers: { ...cookie("athlete"), "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Harper Jones", email: "harper.jones@startline.test", requestType: "refund",
      registrationId: PAID_B, reason: "Event cancelled",
    }),
  });
  expect(support.status).toBe(409);
  expect((await support.json()).error).toContain("This event was cancelled");
});

test("an event with no entries can still be deleted", async () => {
  const res = await fetch(`${BASE_URL}/api/organiser/events/${EMPTY_EVENT_ID}`, {
    method: "DELETE",
    headers: cookie("organiser"),
  });
  expect(res.status).toBe(200);
});

test("the listings menu offers Cancel, not Delete, for an event with entries", async ({ page }) => {
  await organiserLogin(page);
  await page.goto("/organiser/listings");
  // Match the title exactly: "E2E Cancel e2e-event-cancel" is also a prefix of
  // the empty event's title, which sorts first and offers Delete instead.
  const row = page
    .getByTestId("listing-row")
    .filter({ has: page.getByText(`E2E Cancel ${EVENT_ID}`, { exact: true }) });
  await row.getByRole("button").last().click();
  await expect(page.getByRole("button", { name: "Cancel event", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete event", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Cancel event", exact: true }).click();
  await expect(page.getByTestId("cancel-preview")).toContainText("$96.46");
  const confirm = page.getByRole("button", { name: "Cancel event and refund everyone" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Type the event name to confirm").fill(`E2E Cancel ${EVENT_ID}`);
  await expect(confirm).toBeEnabled();
});

test("a cancelled event's page tells athletes they are refunded", async ({ page }) => {
  await prisma.event.update({ where: { id: EVENT_ID }, data: { status: "CANCELLED" } });
  await page.goto(`/events/${EVENT_ID}`);
  await expect(page.getByTestId("event-cancelled-notice")).toContainText("refunded everything they paid");
});

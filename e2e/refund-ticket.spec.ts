import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { adminLogin, ensureDatabaseUrl } from "./helpers";

// A refund is a support ticket. The organiser decides and Startline issues the
// refund (#570); Startline decides only after the organiser's window has
// passed, or as an override with a note. Nothing is refunded from the ticket
// itself. Inside 24 hours of the start the change-of-mind policy owes nothing,
// but the athlete can still ask.
//
// A request raised from the athlete's own entry (#492) is linked to it and
// takes the policy quote. The organiser's reason sets the refund type, approving
// issues the refund, and declining gives the athlete their entry back.
//
// Support allows three posts a minute from one address; this file makes three.

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// A seeded, published event owned by Coastal Fitness Collective.
const EVENT_ID = "seed-event-017";

// A paid entry for Harper, made by this spec and removed again.
const PAYMENT_INTENT = "pi_e2e_refund_queue";

async function cleanUp() {
  await prisma.supportTicket.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.userNotification.deleteMany({
    where: { eventId: EVENT_ID, type: { in: ["REFUND_DECLINED", "REFUND_APPROVED", "REFUND_PROCESSED"] } },
  });
  await prisma.registration.deleteMany({ where: { stripePaymentIntentId: PAYMENT_INTENT } });
}

test.afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

test.beforeEach(cleanUp);

/** $120 ticket plus a $3 booking fee Harper paid on top. */
async function seedPaidEntry() {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: EVENT_ID },
    select: { organiserId: true },
  });
  return prisma.registration.create({
    data: {
      eventId: EVENT_ID,
      organiserId: event.organiserId,
      athleteName: "Harper Jones",
      athleteEmail: "harper.jones@startline.test",
      waveLabel: "Sprint",
      status: "CONFIRMED",
      amountCents: 12000,
      platformFeeCents: 300,
      feeStructure: "athlete",
      stripePaymentIntentId: PAYMENT_INTENT,
      // Half back up to 14 days out, whatever the event says now.
      soldRefundTiers: [{ daysBefore: 14, percent: 50 }],
    },
  });
}

const asAthlete = (page: Page) =>
  page.context().addCookies([
    { name: "__e2e_bypass", value: "athlete", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);

/** A ticket written straight to the database, so the Support rate limit is not in play. */
async function seedTicket(createdAt = new Date()) {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: EVENT_ID },
    select: { organiserId: true, title: true },
  });
  return prisma.supportTicket.create({
    data: {
      name: "Harper Jones",
      email: "harper.jones@startline.test",
      requestType: "refund",
      eventId: EVENT_ID,
      eventName: event.title,
      organiserId: event.organiserId,
      reason: "Clash with another race that weekend.",
      createdAt,
    },
  });
}

const DECLINE = { action: "decline", reason: "OUTSIDE_POLICY", note: "Outside our policy." };

const asOrganiser = (page: Page) =>
  page.context().addCookies([
    { name: "__e2e_bypass", value: "user", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);

test("organiser decides, then Startline issues and marks it refunded", async ({ page }) => {
  const created = await page.request.post("/api/support", {
    data: {
      name: "Harper Jones",
      email: "harper.jones@startline.test",
      requestType: "refund",
      eventId: EVENT_ID,
      reason: "Clash with another race that weekend.",
    },
  });
  expect(created.status()).toBe(200);
  const { id } = await created.json();

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  expect(ticket).toMatchObject({ status: "OPEN", requestType: "refund", eventId: EVENT_ID });
  expect(ticket?.organiserId).toBeTruthy();

  // The organisation sees it, with its window to respond, and decides.
  await asOrganiser(page);
  const list = await page.request.get("/api/organiser/refund-requests");
  expect(list.ok()).toBeTruthy();
  const { tickets } = await list.json();
  const listed = tickets.find((t: { id: string }) => t.id === id);
  expect(listed?.organiserResponseDue).toBeTruthy();

  // A decision needs a reason.
  const bare = await page.request.patch(`/api/organiser/refund-requests/${id}`, { data: { action: "approve" } });
  expect(bare.status()).toBe(400);

  const decided = await page.request.patch(`/api/organiser/refund-requests/${id}`, {
    data: { action: "approve", reason: "WITHIN_POLICY", note: "Happy to refund." },
  });
  expect(decided.status()).toBe(200);
  // Not linked to an entry, so nothing is issued yet: Startline does it by hand.
  expect(await decided.json()).toMatchObject({ status: "APPROVED", issued: false });
  expect(await prisma.supportTicket.findUnique({ where: { id } })).toMatchObject({
    status: "APPROVED",
    organiserDecision: "APPROVED",
    organiserNote: "Happy to refund.",
    organiserReason: "WITHIN_POLICY",
    refundType: "POLICY",
  });

  // A second decision from the organiser is refused.
  const again = await page.request.patch(`/api/organiser/refund-requests/${id}`, {
    data: { action: "decline", reason: "OTHER", note: "Changed my mind." },
  });
  expect(again.status()).toBe(409);

  // Startline sees the organiser's decision and acts on it.
  await adminLogin(page);
  const adminList = await page.request.get("/api/admin/refund-requests");
  expect(adminList.ok()).toBeTruthy();
  const adminTicket = (await adminList.json()).tickets.find((t: { id: string }) => t.id === id);
  expect(adminTicket).toMatchObject({ status: "APPROVED", organiserDecision: "APPROVED" });

  const refunded = await page.request.patch(`/api/admin/refund-requests/${id}`, { data: { action: "refunded" } });
  expect(refunded.status()).toBe(200);
  expect((await prisma.supportTicket.findUnique({ where: { id } }))?.status).toBe("REFUNDED");
});

test("Startline cannot overwrite the organiser's decision without an override and a note", async ({ page }) => {
  const ticket = await seedTicket();
  await asOrganiser(page);
  const declined = await page.request.patch(`/api/organiser/refund-requests/${ticket.id}`, { data: DECLINE });
  expect(declined.status()).toBe(200);

  await adminLogin(page);
  const plain = await page.request.patch(`/api/admin/refund-requests/${ticket.id}`, { data: { action: "approve" } });
  expect(plain.status()).toBe(409);

  const noNote = await page.request.patch(`/api/admin/refund-requests/${ticket.id}`, {
    data: { action: "approve", override: true },
  });
  expect(noNote.status()).toBe(400);
  expect((await prisma.supportTicket.findUnique({ where: { id: ticket.id } }))?.status).toBe("DECLINED");
});

test("an override with a note is recorded, audited and sent to the organiser", async ({ page }) => {
  const ticket = await seedTicket();
  await asOrganiser(page);
  await page.request.patch(`/api/organiser/refund-requests/${ticket.id}`, { data: DECLINE });

  await adminLogin(page);
  const note = "The date moved a week, so the athlete is owed a remedy.";
  const res = await page.request.patch(`/api/admin/refund-requests/${ticket.id}`, {
    data: { action: "approve", override: true, note },
  });
  expect(res.status()).toBe(200);

  // The organiser's decision is kept beside Startline's.
  expect(await prisma.supportTicket.findUnique({ where: { id: ticket.id } })).toMatchObject({
    status: "APPROVED",
    organiserDecision: "DECLINED",
    adminDecisionKind: "OVERRIDE",
    adminNote: note,
  });

  const audit = await prisma.adminAuditLog.findFirst({
    where: { action: "REFUND_TICKET_OVERRIDE", targetId: ticket.id },
  });
  expect(audit).toBeTruthy();

  const notice = await prisma.notification.findFirst({
    where: { organiserId: ticket.organiserId!, type: "REFUND_TICKET_OVERRIDE" },
    orderBy: { createdAt: "desc" },
  });
  expect(notice?.body).toContain(note);

  await prisma.adminAuditLog.deleteMany({ where: { targetId: ticket.id } });
  await prisma.notification.deleteMany({ where: { id: notice!.id } });
});

test("Startline decides a ticket the organiser left past its window", async ({ page }) => {
  // Two weeks old: well past three business days.
  const stale = await seedTicket(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
  const fresh = await seedTicket();

  await adminLogin(page);
  const early = await page.request.patch(`/api/admin/refund-requests/${fresh.id}`, { data: { action: "approve" } });
  expect(early.status()).toBe(409);

  const late = await page.request.patch(`/api/admin/refund-requests/${stale.id}`, { data: { action: "approve" } });
  expect(late.status()).toBe(200);
  expect(await prisma.supportTicket.findUnique({ where: { id: stale.id } })).toMatchObject({
    status: "APPROVED",
    adminDecisionKind: "NO_RESPONSE",
    organiserDecision: null,
  });
  await prisma.adminAuditLog.deleteMany({ where: { targetId: stale.id } });
});

test("the admin refunds page shows the organiser's decision and gates the override on a note", async ({ page }) => {
  const ticket = await seedTicket();
  await asOrganiser(page);
  await page.request.patch(`/api/organiser/refund-requests/${ticket.id}`, {
    data: { action: "decline", reason: "OUTSIDE_POLICY", note: "Outside our policy." },
  });

  await adminLogin(page);
  await page.goto("/admin/refunds");
  const card = page.getByTestId("refund-ticket").filter({ hasText: "Outside our policy." });
  await expect(card).toContainText("Organiser declined");
  await expect(card.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await card.getByRole("button", { name: "Override…" }).click();
  await expect(card.getByRole("button", { name: "Confirm override" })).toBeDisabled();
});

test("accepts a request inside 24 hours of the start: only the change-of-mind quote stops", async ({ page }) => {
  // The Australian Consumer Law cases are owed at any time, so the athlete can
  // still ask on race day. The policy owes nothing that close to the start.
  const today = new Date().toISOString().slice(0, 10);
  const res = await page.request.post("/api/support", {
    data: {
      name: "Harper Jones",
      email: "harper.jones@startline.test",
      requestType: "refund",
      eventName: "Race day",
      eventDate: today,
      reason: "The course was moved to another town.",
    },
  });
  expect(res.status()).toBe(200);
  await prisma.supportTicket.delete({ where: { id: (await res.json()).id } });
});

test("a request from the athlete's own entry takes the policy quote, and a decline gives the entry back", async ({ page }) => {
  const entry = await seedPaidEntry();

  // The Activity link preselects the entry and shows what the policy returns.
  await asAthlete(page);
  await page.goto(`/support?registration=${entry.id}`);
  const quote = page.getByTestId("refund-quote");
  await expect(quote).toContainText("$60.00", { timeout: 15000 });
  await expect(quote).toContainText("$123.00");

  const created = await page.request.post("/api/support", {
    data: {
      name: "Harper Jones",
      email: "harper.jones@startline.test",
      requestType: "refund",
      registrationId: entry.id,
      reason: "Injured.",
    },
  });
  expect(created.status()).toBe(200);
  const { id } = await created.json();

  // Linked, quoted on the ticket price only, and the entry is held.
  expect(await prisma.supportTicket.findUnique({ where: { id } })).toMatchObject({
    registrationId: entry.id,
    policyRefundPercent: 50,
    policyRefundCents: 6000,
  });
  expect(await prisma.registration.findUnique({ where: { id: entry.id } })).toMatchObject({
    status: "REFUND_REQUESTED",
    refundAmountCents: 6000,
  });

  // The organiser sees the quote and the full amount, and declines with a note.
  await asOrganiser(page);
  const listed = (await (await page.request.get("/api/organiser/refund-requests")).json())
    .tickets.find((t: { id: string }) => t.id === id);
  expect(listed).toMatchObject({ policyRefundCents: 6000, fullRefundCents: 12300 });

  const declined = await page.request.patch(`/api/organiser/refund-requests/${id}`, { data: DECLINE });
  expect(declined.status()).toBe(200);
  expect(await prisma.registration.findUnique({ where: { id: entry.id } })).toMatchObject({
    status: "CONFIRMED",
    refundAmountCents: null,
    refundRequestedAt: null,
  });
});

test("goodwill refunds the whole ticket price and keeps the booking fee", async ({ page }) => {
  const entry = await seedPaidEntry();
  await prisma.registration.update({ where: { id: entry.id }, data: { status: "REFUND_REQUESTED" } });
  const ticket = await seedTicket();
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { registrationId: entry.id, policyRefundPercent: 50, policyRefundCents: 6000 },
  });

  await asOrganiser(page);
  await page.goto("/organiser/refunds");
  const card = page.getByTestId("refund-ticket").filter({ hasText: "Clash with another race" });
  await card.getByLabel("Reason for your decision").selectOption("GOODWILL");
  await expect(card).toContainText("The athlete gets $120.00");
  // Goodwill says why before it can be sent.
  const approve = card.getByRole("button", { name: "Approve and refund $120.00" });
  await expect(approve).toBeDisabled();
  await card.getByLabel("Note").fill("Injured, with a medical certificate.");
  await approve.click();

  // The fake payment intent cannot be refunded in Stripe, so the approval
  // stands with the error for Startline to retry, unless Stripe is mocked out.
  await expect.poll(async () => (await prisma.supportTicket.findUnique({ where: { id: ticket.id } }))?.status)
    .toMatch(/APPROVED|REFUNDED/);
  const decided = await prisma.supportTicket.findUnique({ where: { id: ticket.id } });
  expect(decided).toMatchObject({ organiserReason: "GOODWILL", refundType: "TICKET" });
  if (decided?.status === "APPROVED") expect(decided.refundError).toBeTruthy();
});

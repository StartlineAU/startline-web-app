import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { adminLogin, ensureDatabaseUrl } from "./helpers";

// A refund is a support ticket. The organiser decides and Startline issues the
// refund (#570); Startline decides only after the organiser's window has
// passed, or as an override with a note. Nothing is refunded from the ticket
// itself, and a change-of-mind request is refused inside 24 hours of the start.

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// A seeded, published event owned by Coastal Fitness Collective.
const EVENT_ID = "seed-event-017";

test.afterAll(async () => {
  await prisma.supportTicket.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.$disconnect();
});

test.beforeEach(async () => {
  await prisma.supportTicket.deleteMany({ where: { eventId: EVENT_ID } });
});

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

  const decided = await page.request.patch(`/api/organiser/refund-requests/${id}`, {
    data: { action: "approve", note: "Happy to refund." },
  });
  expect(decided.status()).toBe(200);
  expect(await prisma.supportTicket.findUnique({ where: { id } })).toMatchObject({
    status: "APPROVED",
    organiserDecision: "APPROVED",
    organiserNote: "Happy to refund.",
  });

  // A second decision from the organiser is refused.
  const again = await page.request.patch(`/api/organiser/refund-requests/${id}`, { data: { action: "decline" } });
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
  const declined = await page.request.patch(`/api/organiser/refund-requests/${ticket.id}`, { data: { action: "decline" } });
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
  await page.request.patch(`/api/organiser/refund-requests/${ticket.id}`, { data: { action: "decline" } });

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
    data: { action: "decline", note: "Outside our policy." },
  });

  await adminLogin(page);
  await page.goto("/admin/refunds");
  const card = page.getByTestId("refund-ticket").filter({ hasText: "Outside our policy." });
  await expect(card).toContainText("Organiser declined");
  await expect(card.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await card.getByRole("button", { name: "Override…" }).click();
  await expect(card.getByRole("button", { name: "Confirm override" })).toBeDisabled();
});

test("refuses a change-of-mind request inside 24 hours of the start", async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10);
  const res = await page.request.post("/api/support", {
    data: {
      name: "Harper Jones",
      email: "harper.jones@startline.test",
      requestType: "refund",
      eventName: "Race day",
      eventDate: today,
      reason: "Change of mind.",
    },
  });

  expect(res.status()).toBe(409);
  expect((await res.json()).error).toMatch(/24 hours/);
  expect(await prisma.supportTicket.count({ where: { eventId: EVENT_ID } })).toBe(0);
});

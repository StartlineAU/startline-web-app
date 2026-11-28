import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { adminLogin, ensureDatabaseUrl } from "./helpers";
import { signEntryRefund } from "../lib/entry-claim-token";

// A refund is a support ticket. The organiser decides and Startline issues the
// refund (#570); Startline decides only after the organiser's window has
// passed, or as an override with a note. Nothing is refunded from the ticket
// itself, and a change-of-mind request is refused inside 24 hours of the start.

ensureDatabaseUrl();
// Must match the dev server's (playwright.config.ts), or the link is refused.
process.env.ENTRY_CLAIM_SECRET ||= "e2e-entry-claim-secret";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// A seeded, published event owned by Coastal Fitness Collective.
const EVENT_ID = "seed-event-017";
// Harper's own paid place, and one Harper bought for a teammate.
const OWN_ENTRY = "e2e-refund-own";
const TEAMMATE_ENTRY = "e2e-refund-teammate";

async function clearFixture() {
  await prisma.supportTicket.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.registration.deleteMany({ where: { id: { in: [OWN_ENTRY, TEAMMATE_ENTRY] } } });
  // /api/support allows 3 requests a minute per caller; every test here posts.
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "support:" } } });
}

test.afterAll(async () => {
  await clearFixture();
  await prisma.$disconnect();
});

test.beforeEach(clearFixture);

/**
 * Harper's User row, as the "athlete" bypass resolves it: the seeded row is
 * adopted by email and re-pointed at the bypass sub. Registration.userId is the
 * row's cuid, not the sub, and nothing guarantees a bypass request has created
 * or claimed the row before this spec runs.
 */
async function harperUserId() {
  const user = await prisma.user.upsert({
    where: { email: "harper.jones@startline.test" },
    update: { cognitoSub: "dev-bypass-harper-jones" },
    create: { cognitoSub: "dev-bypass-harper-jones", email: "harper.jones@startline.test", name: "Harper Jones" },
    select: { id: true },
  });
  return user.id;
}

/** Harper's entry, bought by Harper, for Harper or for someone else. */
async function seedEntry(id: string, athlete: { name: string; email: string }) {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: EVENT_ID }, select: { organiserId: true } });
  await prisma.registration.create({
    data: {
      id,
      eventId: EVENT_ID,
      organiserId: event.organiserId,
      userId: await harperUserId(),
      athleteName: athlete.name,
      athleteEmail: athlete.email,
      status: "CONFIRMED",
      amountCents: 4500,
      platformFeeCents: 323,
      feeStructure: "athlete",
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

const asOrganiser = (page: Page) =>
  page.context().addCookies([
    { name: "__e2e_bypass", value: "user", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);

test("organiser decides, then Startline issues and marks it refunded", async ({ page }) => {
  await seedEntry(OWN_ENTRY, { name: "Harper Jones", email: "harper.jones@startline.test" });
  await asAthlete(page);
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

test("a buyer cannot request a refund for a teammate's place on a group ticket", async ({ page }) => {
  // Harper paid for the place, but it is Lachlan's entry.
  await seedEntry(TEAMMATE_ENTRY, { name: "Lachlan Teammate", email: "lachlan.teammate@startline.test" });
  await asAthlete(page);

  const res = await page.request.post("/api/support", {
    data: {
      name: "Harper Jones",
      email: "harper.jones@startline.test",
      requestType: "refund",
      eventId: EVENT_ID,
      reason: "Lachlan can't make it.",
    },
  });
  expect(res.status()).toBe(403);
  expect(await prisma.supportTicket.count({ where: { eventId: EVENT_ID } })).toBe(0);

  // The refund form does not offer the event either.
  await page.goto(`/refunds?event=${EVENT_ID}`);
  await expect(page.getByText("You can only request a refund for your own entry.", { exact: false })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Event" })).toHaveCount(0);
});

test("a second request for the same event is refused while the first is open", async ({ page }) => {
  await seedEntry(OWN_ENTRY, { name: "Harper Jones", email: "harper.jones@startline.test" });
  await seedTicket();
  await asAthlete(page);

  const res = await page.request.post("/api/support", {
    data: {
      name: "Harper Jones",
      email: "harper.jones@startline.test",
      requestType: "refund",
      eventId: EVENT_ID,
      reason: "Asking again.",
    },
  });
  expect(res.status()).toBe(409);
  expect((await res.json()).error).toMatch(/already have a refund request open/);
  expect(await prisma.supportTicket.count({ where: { eventId: EVENT_ID } })).toBe(1);
});

test("the confirmation email's refund link works for an athlete entered under another address", async ({ page }) => {
  // Harper bought Lachlan's place. Lachlan signs in elsewhere, or not at all,
  // but can read the inbox the confirmation was sent to.
  const lachlan = { name: "Lachlan Teammate", email: "lachlan.teammate@startline.test" };
  await seedEntry(TEAMMATE_ENTRY, lachlan);
  const token = signEntryRefund({ registrationId: TEAMMATE_ENTRY, athleteEmail: lachlan.email })!;

  await page.goto(`/refunds?event=${EVENT_ID}&t=${encodeURIComponent(token)}`);
  await expect(page.getByRole("combobox", { name: "Event" })).toContainText("Noosa Triathlon");
  await page.getByRole("textbox", { name: "Reason" }).fill("Injured.");
  await page.getByRole("button", { name: "Request a refund" }).click();
  await expect(page.getByText("Request sent")).toBeVisible();

  // Recorded against the entry's own address, so staff can find the entry.
  const ticket = await prisma.supportTicket.findFirstOrThrow({ where: { eventId: EVENT_ID } });
  expect(ticket).toMatchObject({ email: lachlan.email, userId: null, requestType: "refund" });

  // A link for another event, or a tampered one, proves nothing.
  const forged = await page.request.post("/api/support", {
    data: { ...lachlan, requestType: "refund", eventId: EVENT_ID, reason: "x", refundToken: `${token}x` },
  });
  expect(forged.status()).toBe(401);
});

test("a refund link stops working once the entry's address changes", async ({ page }) => {
  await seedEntry(TEAMMATE_ENTRY, { name: "Lachlan Teammate", email: "lachlan.teammate@startline.test" });
  const token = signEntryRefund({ registrationId: TEAMMATE_ENTRY, athleteEmail: "lachlan.teammate@startline.test" })!;
  // A team swap writes someone else into the same row.
  await prisma.registration.update({ where: { id: TEAMMATE_ENTRY }, data: { athleteEmail: "new.member@startline.test" } });

  const res = await page.request.post("/api/support", {
    data: {
      name: "Lachlan Teammate", email: "lachlan.teammate@startline.test",
      requestType: "refund", eventId: EVENT_ID, reason: "x", refundToken: token,
    },
  });
  expect(res.status()).toBe(401);
  await page.goto(`/refunds?event=${EVENT_ID}&t=${encodeURIComponent(token)}`);
  await expect(page.getByText("That refund link no longer matches its entry", { exact: false })).toBeVisible();
});

test("a refund request needs a signed-in athlete", async ({ page }) => {
  const res = await page.request.post("/api/support", {
    data: {
      name: "Harper Jones",
      email: "harper.jones@startline.test",
      requestType: "refund",
      eventId: EVENT_ID,
      reason: "Clash with another race that weekend.",
    },
  });
  expect(res.status()).toBe(401);
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

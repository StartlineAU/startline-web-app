import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { adminLogin, ensureDatabaseUrl } from "./helpers";
import { signEntryRefund } from "../lib/entry-claim-token";

// A refund is a support ticket about one entry. The organiser decides and
// Startline issues the refund (#570); Startline decides only after the
// organiser's window has passed, or as an override with a note.
//
// A request names the entry (#492). It takes the policy quote, the organiser's
// reason sets the refund type, approving issues the refund, and declining gives
// the athlete their entry back. The athlete or the buyer who paid for the place
// can ask, signed in, or anyone holding the confirmation email's refund link
// for that entry (#614).

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
// A paid entry for Harper with a frozen policy, made by this spec.
const PAYMENT_INTENT = "pi_e2e_refund_queue";

async function cleanUp() {
  await prisma.supportTicket.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.userNotification.deleteMany({
    where: { eventId: EVENT_ID, type: { in: ["REFUND_DECLINED", "REFUND_APPROVED", "REFUND_PROCESSED"] } },
  });
  await prisma.registration.deleteMany({
    where: { OR: [{ stripePaymentIntentId: PAYMENT_INTENT }, { id: { in: [OWN_ENTRY, TEAMMATE_ENTRY] } }] },
  });
  // /api/support allows 3 requests a minute per caller; several tests here post.
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "support:" } } });
}

test.afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

test.beforeEach(cleanUp);

/**
 * Harper's User row, as the "athlete" bypass resolves it: the seeded row is
 * adopted by email and re-pointed at the bypass sub. Registration.userId is the
 * row's cuid, not the sub.
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

/** A place Harper paid for, for Harper or for someone else. */
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
      stripePaymentIntentId: `pi_e2e_${id}`,
    },
  });
}

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
  // A ticket with no entry, from before #492: Startline issues it by hand.
  const { id } = await seedTicket();

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
  // The route writes APPROVED before it calls Stripe and records the error
  // after, so wait for the outcome rather than the first status change.
  await expect.poll(async () => {
    const t = await prisma.supportTicket.findUnique({ where: { id: ticket.id } });
    if (t?.status === "REFUNDED") return "settled";
    return t?.status === "APPROVED" && t.refundError ? "settled" : t?.status;
  }).toBe("settled");
  const decided = await prisma.supportTicket.findUnique({ where: { id: ticket.id } });
  expect(decided).toMatchObject({ organiserReason: "GOODWILL", refundType: "TICKET" });
});

test("a buyer can request a refund for a place they paid for on a group ticket", async ({ page }) => {
  // Harper paid for the place, but it is Lachlan's entry. The money goes back
  // to Harper's card, so Harper can ask.
  await seedEntry(TEAMMATE_ENTRY, { name: "Lachlan Teammate", email: "lachlan.teammate@startline.test" });
  await asAthlete(page);

  const res = await page.request.post("/api/support", {
    data: {
      name: "Harper Jones",
      email: "harper.jones@startline.test",
      requestType: "refund",
      registrationId: TEAMMATE_ENTRY,
      reason: "Lachlan can't make it.",
    },
  });
  expect(res.status()).toBe(200);
  expect(await prisma.supportTicket.findFirst({ where: { eventId: EVENT_ID } })).toMatchObject({
    registrationId: TEAMMATE_ENTRY,
  });
});

test("someone who neither raced nor paid cannot request a refund on an entry", async ({ page }) => {
  await seedEntry(OWN_ENTRY, { name: "Harper Jones", email: "harper.jones@startline.test" });
  // Signed in as Jade, who has nothing to do with Harper's entry.
  await asOrganiser(page);
  const res = await page.request.post("/api/support", {
    data: {
      name: "Jade Nguyen",
      email: "jade.nguyen@startline.test",
      requestType: "refund",
      registrationId: OWN_ENTRY,
      reason: "x",
    },
  });
  expect(res.status()).toBe(403);
  expect(await prisma.supportTicket.count({ where: { eventId: EVENT_ID } })).toBe(0);
});

test("a refund request names an entry", async ({ page }) => {
  await asAthlete(page);
  const res = await page.request.post("/api/support", {
    data: {
      name: "Harper Jones",
      email: "harper.jones@startline.test",
      requestType: "refund",
      eventId: EVENT_ID,
      reason: "Clash with another race that weekend.",
    },
  });
  expect(res.status()).toBe(400);
});

test("a second request for the same entry is refused while the first is open", async ({ page }) => {
  await seedEntry(OWN_ENTRY, { name: "Harper Jones", email: "harper.jones@startline.test" });
  await asAthlete(page);
  const ask = () =>
    page.request.post("/api/support", {
      data: {
        name: "Harper Jones",
        email: "harper.jones@startline.test",
        requestType: "refund",
        registrationId: OWN_ENTRY,
        reason: "Asking again.",
      },
    });

  expect((await ask()).status()).toBe(200);
  const again = await ask();
  expect(again.status()).toBe(409);
  expect((await again.json()).error).toMatch(/already asked/);
  expect(await prisma.supportTicket.count({ where: { eventId: EVENT_ID } })).toBe(1);
});

test("the confirmation email's refund link works for an athlete entered under another address", async ({ page }) => {
  // Harper bought Lachlan's place. Lachlan signs in elsewhere, or not at all,
  // but can read the inbox the confirmation was sent to.
  const lachlan = { name: "Lachlan Teammate", email: "lachlan.teammate@startline.test" };
  await seedEntry(TEAMMATE_ENTRY, lachlan);
  const token = signEntryRefund({ registrationId: TEAMMATE_ENTRY, athleteEmail: lachlan.email })!;

  await page.goto(`/refunds?t=${encodeURIComponent(token)}`);
  await expect(page.getByRole("combobox", { name: "Entry" })).toContainText("Noosa Triathlon");
  await page.getByRole("textbox", { name: "Reason" }).fill("Injured.");
  await page.getByRole("button", { name: "Request a refund" }).click();
  await expect(page.getByText("Request sent")).toBeVisible();

  // Recorded against the entry and its own address, so staff can find it.
  const ticket = await prisma.supportTicket.findFirstOrThrow({ where: { eventId: EVENT_ID } });
  expect(ticket).toMatchObject({
    email: lachlan.email,
    userId: null,
    requestType: "refund",
    registrationId: TEAMMATE_ENTRY,
  });

  // A tampered link proves nothing.
  const forged = await page.request.post("/api/support", {
    data: { ...lachlan, requestType: "refund", reason: "x", refundToken: `${token}x` },
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
      requestType: "refund", reason: "x", refundToken: token,
    },
  });
  expect(res.status()).toBe(401);
  await page.goto(`/refunds?t=${encodeURIComponent(token)}`);
  await expect(page.getByText("That refund link no longer matches its entry", { exact: false })).toBeVisible();
});

test("a refund request without a link needs a signed-in athlete", async ({ page }) => {
  await seedEntry(OWN_ENTRY, { name: "Harper Jones", email: "harper.jones@startline.test" });
  const res = await page.request.post("/api/support", {
    data: {
      name: "Harper Jones",
      email: "harper.jones@startline.test",
      requestType: "refund",
      registrationId: OWN_ENTRY,
      reason: "Clash with another race that weekend.",
    },
  });
  expect(res.status()).toBe(401);
});

import { test, expect, type Page } from "@playwright/test";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl, organiserLogin } from "./helpers";

// #571: an organiser removes an athlete from an event, the athlete is told,
// a paid entry is refunded, and a block stops them entering again.

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EVENT_ID = "e2e-remove-athlete-event";
const FREE_REG = "e2e-remove-athlete-free";
const PAID_REG = "e2e-remove-athlete-paid";
const HARPER = "harper.jones@startline.test";
const MANAGE = `/organiser/events/${EVENT_ID}/dashboard?panel=manage`;

let apexId = "";
let harperId = "";

function eventData() {
  const startsAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
  return {
    id: EVENT_ID,
    organiserId: apexId,
    status: "APPROVED" as const,
    title: "E2E Removal Fun Run",
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
    waves: [{ label: "General", price: "0" }],
    photos: [],
    registrationType: "startline",
    feeStructure: "athlete",
  };
}

function harperEntry(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    eventId: EVENT_ID,
    organiserId: apexId,
    userId: harperId,
    athleteName: "Harper Jones",
    athleteEmail: HARPER,
    firstName: "Harper",
    lastName: "Jones",
    waveLabel: "General",
    bibNumber: "501",
    feeStructure: "athlete",
    status: "CONFIRMED" as const,
    ...extra,
  };
}

// The replacement in the remove-and-replace test gets an account; removed again.
const REPLACEMENT_EMAIL = "e2e-remove-replacement@example.com";

async function cleanup() {
  await prisma.organiserBlock.deleteMany({ where: { email: HARPER } });
  await prisma.userNotification.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.registration.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.team.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.event.deleteMany({ where: { id: EVENT_ID } });
  await prisma.user.deleteMany({ where: { email: REPLACEMENT_EMAIL } });
}

test.beforeAll(async () => {
  const apex = await prisma.organiser.findFirstOrThrow({
    where: { orgName: "Apex Endurance Events" },
    select: { id: true },
  });
  apexId = apex.id;
  harperId = (await prisma.user.findUniqueOrThrow({ where: { email: HARPER }, select: { id: true } })).id;
});

test.beforeEach(async () => {
  await cleanup();
  await prisma.event.create({ data: eventData() });
});

test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

async function removeFromBoard(page: Page, opts: { reason: RegExp; block?: boolean }) {
  await page.goto(MANAGE);
  await page.getByLabel("Search athletes").fill("Harper Jones");
  await page.getByRole("button", { name: /remove harper jones from event/i }).click();

  const dialog = page.getByTestId("remove-athlete-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^reason$/i).click();
  await page.getByRole("option", { name: opts.reason }).click();
  if (opts.block) await dialog.getByLabel(/also block from entering again/i).check();
  await dialog.getByRole("button", { name: /^remove from event$/i }).click();
  await expect(page.getByTestId("remove-message")).toContainText("Harper Jones was removed and emailed.");
}

test("an organiser removes an athlete, who is told and loses their bib", async ({ page }) => {
  test.slow();
  await prisma.registration.create({ data: harperEntry(FREE_REG) });
  await organiserLogin(page);

  await removeFromBoard(page, { reason: /no-show to a required briefing/i });

  const row = await prisma.registration.findUniqueOrThrow({ where: { id: FREE_REG } });
  expect(row.status).toBe("REMOVED");
  expect(row.bibNumber).toBeNull();
  expect(row.startWaveId).toBeNull();

  const log = await prisma.registrationRemoval.findFirstOrThrow({ where: { registrationId: FREE_REG } });
  expect(log).toMatchObject({
    reason: "NO_SHOW_BRIEFING",
    refund: "NOT_PAID",
    blocked: false,
    removedByEmail: "sarah.mitchell@startline.test",
  });

  const notice = await prisma.userNotification.findFirst({
    where: { userId: harperId, eventId: EVENT_ID, type: "REMOVED_FROM_EVENT" },
  });
  expect(notice?.body).toContain("No-show to a required briefing");

  // Off the board for good: a removed entry holds no place.
  await page.reload();
  await page.getByLabel("Search athletes").fill("Harper Jones");
  await expect(page.getByRole("button", { name: /remove harper jones from event/i })).toHaveCount(0);
});

test("a blocked athlete cannot enter again until the owner lifts the block", async ({ page, browser }) => {
  test.slow();
  await prisma.registration.create({ data: harperEntry(FREE_REG) });
  await organiserLogin(page);

  await removeFromBoard(page, { reason: /code of conduct/i, block: true });
  await expect(page.getByTestId("remove-message")).toContainText("blocked from your future events");

  const block = await prisma.organiserBlock.findUniqueOrThrow({
    where: { organiserId_email: { organiserId: apexId, email: HARPER } },
  });
  expect(block.userId).toBe(harperId);

  // Harper is told up front, and the server refuses the RSVP regardless.
  const athlete = await browser.newContext();
  await athlete.addCookies([
    { name: "__e2e_bypass", value: "athlete", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
  const harper = await athlete.newPage();
  await harper.goto(`/events/${EVENT_ID}/register`);
  await expect(harper.getByTestId("entry-blocked")).toContainText("You can't enter this event. Contact the organiser.");
  const rsvp = await harper.request.post("/api/registrations/free/rsvp", {
    data: { eventId: EVENT_ID, waveLabel: "General", acceptedTerms: true },
  });
  if (rsvp.status() !== 400) {
    // 400 only when Turnstile is configured and wants a real token.
    expect(rsvp.status()).toBe(409);
    expect((await rsvp.json()).reason).toBe("blocked");
  }

  // Harper's Activity says what happened rather than dropping the entry.
  await harper.goto("/activity");
  await expect(harper.getByText("Removed from event").first()).toBeVisible({ timeout: 20000 });

  // The owner sees the block in Settings and lifts it.
  await page.goto("/organiser/dashboard?settings=blocked");
  const settings = page.getByRole("dialog", { name: "Settings" });
  const list = settings.getByTestId("block-list");
  await expect(list).toContainText(HARPER, { timeout: 30000 });
  await list.getByRole("button", { name: /unblock harper jones/i }).click();
  await expect(settings.getByTestId("block-empty")).toBeVisible();
  expect(await prisma.organiserBlock.count({ where: { organiserId: apexId, email: HARPER } })).toBe(0);

  await harper.goto(`/events/${EVENT_ID}/register`);
  await expect(harper.getByTestId("entry-blocked")).toHaveCount(0);
  await athlete.close();
});

test("an owner can block someone directly from Settings", async ({ page }) => {
  test.slow();
  await organiserLogin(page);
  await page.goto("/organiser/dashboard?settings=blocked");

  const settings = page.getByRole("dialog", { name: "Settings" });
  const add = settings.getByTestId("block-add");
  await expect(add).toBeVisible({ timeout: 30000 });
  await add.getByLabel(/^email$/i).fill("Harper.Jones@Startline.test");
  await add.getByRole("button", { name: /^block$/i }).click();

  await expect(settings.getByTestId("block-list")).toContainText(HARPER);
  const block = await prisma.organiserBlock.findUniqueOrThrow({
    where: { organiserId_email: { organiserId: apexId, email: HARPER } },
  });
  // Added by address, but linked to the account so signed-in entries are caught.
  expect(block.userId).toBe(harperId);
});

test("a manager sees the block list but cannot change it", async ({ page }) => {
  test.slow();
  await page.context().addCookies([
    { name: "__e2e_bypass", value: "member", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
  await page.goto("/organiser/dashboard?settings=blocked");
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings.getByText("Only the owner can change this.")).toBeVisible({ timeout: 30000 });
  await expect(settings.getByTestId("block-add")).toHaveCount(0);

  const res = await page.request.post("/api/organiser/blocked-athletes", { data: { email: HARPER } });
  expect(res.status()).toBe(403);
});

test("a removed team member's place can be handed to someone else", async ({ page }) => {
  test.slow();
  const team = await prisma.team.create({
    data: { eventId: EVENT_ID, name: "Harbour Pair", ticketLabel: "General", size: 2, bibNumber: "77" },
  });
  const member = (id: string, first: string, email: string, userId: string | null) => ({
    id,
    eventId: EVENT_ID,
    organiserId: apexId,
    userId,
    athleteName: `${first} Pair`,
    athleteEmail: email,
    firstName: first,
    lastName: "Pair",
    dateOfBirth: "1990-05-01",
    waveLabel: "General",
    feeStructure: "athlete",
    status: "CONFIRMED" as const,
    teamId: team.id,
  });
  await prisma.registration.createMany({
    data: [member("e2e-remove-pair-1", "Cap", "cap-pair@example.com", null), member(FREE_REG, "Harper", HARPER, harperId)],
  });
  await prisma.team.update({ where: { id: team.id }, data: { captainRegistrationId: "e2e-remove-pair-1" } });

  await organiserLogin(page);
  await page.goto(MANAGE);
  await page.getByLabel("Search athletes").fill("Harper Pair");
  await page.getByRole("button", { name: /remove harper pair from event/i }).click();

  const dialog = page.getByTestId("remove-athlete-dialog");
  await dialog.getByLabel(/^reason$/i).click();
  await page.getByRole("option", { name: /ineligible/i }).click();
  await dialog.getByLabel(/give it to someone else/i).check();
  const fields: [RegExp, string][] = [
    [/^first name$/i, "Remy"],
    [/^last name$/i, "Stand-In"],
    [/^email$/i, REPLACEMENT_EMAIL],
    [/^date of birth$/i, "1992-07-14"],
    [/^mobile$/i, "0400000000"],
    [/^emergency contact name$/i, "Jo Stand-In"],
    [/^emergency contact phone$/i, "0400000001"],
  ];
  const replacement = dialog.getByTestId("remove-replacement");
  for (const [label, value] of fields) await replacement.getByLabel(label).fill(value);
  await dialog.getByRole("button", { name: /^remove and replace$/i }).click();
  await expect(page.getByTestId("remove-message")).toContainText("Remy Stand-In now holds their place.");

  // The same place, still confirmed and on the team, now held by the replacement.
  const row = await prisma.registration.findUniqueOrThrow({ where: { id: FREE_REG } });
  expect(row).toMatchObject({ status: "CONFIRMED", athleteEmail: REPLACEMENT_EMAIL, teamId: team.id });
  expect(row.userId).not.toBe(harperId);

  const log = await prisma.registrationRemoval.findFirstOrThrow({ where: { registrationId: FREE_REG } });
  expect(log).toMatchObject({
    athleteName: "Harper Pair",
    athleteEmail: HARPER,
    replacedByName: "Remy Stand-In",
    replacedByEmail: REPLACEMENT_EMAIL,
    refund: "REPLACED",
  });
  expect(await prisma.teamMemberChange.count({ where: { registrationId: FREE_REG, kind: "SWAP" } })).toBe(1);

  // Harper is told; the team stays full.
  const notice = await prisma.userNotification.findFirst({
    where: { userId: harperId, eventId: EVENT_ID, type: "REMOVED_FROM_EVENT" },
  });
  expect(notice?.body).toContain("given to another member");
  expect(await prisma.registration.count({ where: { teamId: team.id, status: "CONFIRMED" } })).toBe(2);
});

test.describe("paid removal (real test-mode Stripe)", () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  test.skip(!secret, "STRIPE_SECRET_KEY not set — skipping the Stripe refund on removal");

  test("removing a paid entry refunds everything the athlete paid", async ({ page }) => {
    const stripe = new Stripe(secret!);
    // A direct platform charge: $45 ticket plus the $3.00 booking fee.
    const pi = await stripe.paymentIntents.create({
      amount: 4800,
      currency: "aud",
      payment_method: "pm_card_visa",
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      confirm: true,
    });
    expect(pi.status).toBe("succeeded");
    await prisma.registration.create({
      data: harperEntry(PAID_REG, { amountCents: 4500, platformFeeCents: 300, stripePaymentIntentId: pi.id }),
    });

    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.getByLabel("Search athletes").fill("Harper Jones");
    await page.getByRole("button", { name: /remove harper jones from event/i }).click();
    const dialog = page.getByTestId("remove-athlete-dialog");
    await dialog.getByLabel(/^reason$/i).click();
    await page.getByRole("option", { name: /ineligible/i }).click();
    // No reason but code of conduct may keep the fee.
    await expect(dialog.getByTestId("remove-refund")).toContainText("A full refund of $48.00");
    await expect(dialog.getByRole("radio", { name: /no refund/i })).toHaveCount(0);
    await dialog.getByRole("button", { name: /^remove from event$/i }).click();
    await expect(page.getByTestId("remove-message")).toContainText("A refund of $48.00 is on its way");

    const row = await prisma.registration.findUniqueOrThrow({ where: { id: PAID_REG } });
    expect(row.status).toBe("REMOVED");
    expect(row.stripeRefundId).toBeTruthy();
    const refund = await stripe.refunds.retrieve(row.stripeRefundId!);
    expect(refund.amount).toBe(4800);

    const log = await prisma.registrationRemoval.findFirstOrThrow({ where: { registrationId: PAID_REG } });
    expect(log).toMatchObject({ refund: "FULL", refundCents: 4800, stripeRefundId: row.stripeRefundId });
  });
});

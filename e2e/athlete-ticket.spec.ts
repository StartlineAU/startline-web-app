import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl } from "./helpers";

// #552: a registered event in Activity opens the athlete's ticket (event
// essentials, wave, bib, organiser announcements) in an overlay, rather than
// navigating to the public event page.

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// A seeded, published event owned by Coastal Fitness Collective.
const EVENT_ID = "seed-event-017";
const HARPER = "harper.jones@startline.test";
const BIB = "E2E-552";
const ANNOUNCEMENT_TITLE = "E2E 552 transition area opens at 5am";

async function cleanUp() {
  await prisma.registration.deleteMany({ where: { eventId: EVENT_ID, bibNumber: BIB } });
  await prisma.announcement.deleteMany({ where: { eventId: EVENT_ID, title: ANNOUNCEMENT_TITLE } });
}

async function signInAs(page: Page, identity: "athlete" | "user") {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: identity, domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

type Mode = "OFF" | "PRIVATE" | "SHARED";

// Waves and bibs are opt-in per event (#566). Each test sets them, and the
// event's own modes are put back afterwards.
let originalModes: { waveMode: Mode; bibMode: Mode } | null = null;

async function setModes(waveMode: Mode, bibMode: Mode) {
  await prisma.event.update({ where: { id: EVENT_ID }, data: { waveMode, bibMode } });
}

test.beforeAll(async () => {
  originalModes = await prisma.event.findUniqueOrThrow({
    where: { id: EVENT_ID },
    select: { waveMode: true, bibMode: true },
  });
});

test.beforeEach(cleanUp);

test.afterAll(async () => {
  await cleanUp();
  if (originalModes) await setModes(originalModes.waveMode, originalModes.bibMode);
  await prisma.$disconnect();
});

async function openTicket(page: Page) {
  await page.goto("/activity");
  const card = page.locator(`[data-testid="registration-entry"][data-event-id="${EVENT_ID}"]`);
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.getByTestId("event-card").click();
  const dialog = page.getByTestId("ticket-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function seedEntry() {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: EVENT_ID },
    select: { organiserId: true },
  });
  await prisma.registration.create({
    data: {
      eventId: EVENT_ID,
      organiserId: event.organiserId,
      athleteName: "Harper Jones",
      athleteEmail: HARPER,
      waveLabel: "Sprint",
      startWaveLabel: "Wave 3",
      bibNumber: BIB,
      status: "CONFIRMED",
    },
  });
  await prisma.announcement.create({
    data: {
      eventId: EVENT_ID,
      organiserId: event.organiserId,
      title: ANNOUNCEMENT_TITLE,
      body: "<p>Racks are numbered by bib.</p>",
    },
  });
}

test("a registered card in Activity opens the athlete's ticket over the page", async ({ page }) => {
  await setModes("SHARED", "SHARED");
  await seedEntry();
  await signInAs(page, "athlete");

  await page.goto("/activity");
  const card = page.locator(`[data-testid="registration-entry"][data-event-id="${EVENT_ID}"]`);
  await expect(card).toBeVisible({ timeout: 15000 });
  // The card is just the event: no heart, no price, no wave or bib row.
  await expect(card.getByRole("button", { name: /save|saved/i })).toHaveCount(0);
  await expect(card.getByText(/^From /)).toHaveCount(0);
  await expect(card.getByText(BIB)).toHaveCount(0);
  await card.getByTestId("event-card").click();

  // An overlay, not a navigation.
  const dialog = page.getByTestId("ticket-dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/activity$/);
  await expect(dialog).toContainText("Noosa Triathlon");

  const entry = dialog.getByTestId("ticket-entry");
  await expect(entry).toHaveCount(1);
  await expect(entry.getByTestId("ticket-wave")).toHaveText("Wave 3");
  await expect(entry.getByTestId("ticket-bib")).toHaveText(`#${BIB}`);
  await expect(entry.getByTestId("ticket-qr")).toBeVisible();

  const announcement = dialog.getByTestId("ticket-announcement").filter({ hasText: ANNOUNCEMENT_TITLE });
  await expect(announcement).toContainText("Racks are numbered by bib.");

  // The full event page is still one click away.
  await expect(dialog.getByTestId("ticket-event-link")).toHaveAttribute("href", `/events/${EVENT_ID}`);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("the ticket shows no wave or bib when the event does not use them", async ({ page }) => {
  await setModes("OFF", "OFF");
  await seedEntry();
  await signInAs(page, "athlete");

  const entry = (await openTicket(page)).getByTestId("ticket-entry");
  await expect(entry).toHaveCount(1);
  // The tier and what was paid for it stay; no placeholder for a wave or bib.
  await expect(entry.getByTestId("ticket-tier")).toContainText("Sprint");
  await expect(entry.getByTestId("ticket-wave")).toHaveCount(0);
  await expect(entry.getByTestId("ticket-bib")).toHaveCount(0);
  await expect(entry.getByText("TBC")).toHaveCount(0);
});

test("a private wave or bib never reaches the athlete", async ({ page }) => {
  await setModes("PRIVATE", "PRIVATE");
  await seedEntry();
  await signInAs(page, "athlete");

  const res = await page.request.get(`/api/user/tickets/${EVENT_ID}`);
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).not.toContain(BIB);
  expect(body).not.toContain("Wave 3");

  const entry = (await openTicket(page)).getByTestId("ticket-entry");
  await expect(entry.getByTestId("ticket-wave")).toHaveCount(0);
  await expect(entry.getByTestId("ticket-bib")).toHaveCount(0);
});

test("a shared wave not yet assigned says so quietly", async ({ page }) => {
  await setModes("SHARED", "OFF");
  await seedEntry();
  await prisma.registration.updateMany({
    where: { eventId: EVENT_ID, bibNumber: BIB },
    data: { startWaveLabel: null },
  });
  await signInAs(page, "athlete");

  const entry = (await openTicket(page)).getByTestId("ticket-entry");
  await expect(entry.getByTestId("ticket-wave")).toHaveText("Not assigned yet");
  await expect(entry.getByTestId("ticket-bib")).toHaveCount(0);
});

test("the ticket API refuses someone without an entry", async ({ page }) => {
  await seedEntry();
  // Jade owns the organisation but holds no entry for this event.
  await signInAs(page, "user");

  const res = await page.request.get(`/api/user/tickets/${EVENT_ID}`);
  expect(res.status()).toBe(404);
  expect(await res.text()).not.toContain(BIB);
});

test("the ticket API refuses a signed-out visitor", async ({ page }) => {
  const res = await page.request.get(`/api/user/tickets/${EVENT_ID}`);
  expect(res.status()).toBe(401);
});

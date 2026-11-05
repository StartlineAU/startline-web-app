import { test, expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { organiserLogin } from "./helpers";

// Prefer the CI-provided DATABASE_URL; locally read it from .env.local (which
// may not exist in CI). Only DATABASE_URL is read — loading the whole file
// would leak NEXT_PUBLIC_* vars (e.g. a real Cognito pool id) into the shared
// worker env and make auth.spec's hasCognito guard run its real-Cognito tests.
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  const dbUrl = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  if (dbUrl) process.env.DATABASE_URL = dbUrl;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EVENT_ID = "e2e-checkin-event";
const REG_ID = "e2e-checkin-registration";
const USER_EMAIL = "tom.whitfield@startline.test";
const ATHLETE_NAME = "Tom Whitfield";
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const STORED_START = new Date(Date.now() + 30 * 60 * 1000);
const STORED_END = new Date(Date.now() + 3 * 60 * 60 * 1000);

async function setBypass(page: Page, value: string): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value, domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

// Generates (or reuses) the event's check-in QR and returns the encoded URL.
async function getCheckinUrl(page: Page): Promise<string> {
  await organiserLogin(page);
  await page.goto(`/organiser/events/${EVENT_ID}/dashboard`);
  await page.getByRole("button", { name: "Check-in QR" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const input = dialog.locator("input[readonly]");
  // The first call in CI cold-compiles the check-in-qr route and the qrcode
  // module, so give the URL a generous window before failing.
  await expect(input).toHaveValue(/\/checkin\//, { timeout: 30000 });
  return (await input.inputValue()).trim();
}

async function setWindow(startsAtUtc: Date, endsAtUtc: Date) {
  await prisma.event.update({
    where: { id: EVENT_ID },
    data: { startsAtUtc, endsAtUtc },
  });
}

async function restoreWindow() {
  await setWindow(STORED_START, STORED_END);
}

test.beforeAll(async () => {
  // A dedicated event keeps the time-window tests independent of the seed
  // event's real date and of other specs running in parallel.
  const organiser = await prisma.organiser.findFirst({
    where: { orgName: "Apex Endurance Events" },
    select: { id: true },
  });
  expect(organiser, "seeded organiser should exist").toBeTruthy();

  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true },
  });
  expect(user, `seeded user ${USER_EMAIL} should exist`).toBeTruthy();

  await prisma.event.delete({ where: { id: EVENT_ID } }).catch(() => {});
  await prisma.event.create({
    data: {
      id: EVENT_ID,
      organiserId: organiser!.id,
      status: "APPROVED",
      title: "E2E Check-in Event",
      discipline: "running",
      eventDate: new Date().toISOString().slice(0, 10),
      startTime: "07:30",
      endTime: "12:00",
      timeZone: "Australia/Sydney",
      startsAtUtc: STORED_START,
      endsAtUtc: STORED_END,
      venue: "Test Venue",
      city: "Sydney",
      state: "nsw",
      format: "individual",
      level: "open",
      categories: [],
      waves: [],
      photos: [],
      registrationType: "startline",
      feeStructure: "athlete",
    },
  });
  await prisma.registration.create({
    data: {
      id: REG_ID,
      eventId: EVENT_ID,
      organiserId: organiser!.id,
      userId: user!.id,
      athleteName: ATHLETE_NAME,
      athleteEmail: USER_EMAIL,
      waveLabel: "General",
      amountCents: 0,
      platformFeeCents: 0,
      feeStructure: "athlete",
      status: "CONFIRMED",
    },
  });

  // Warm the check-in QR route (cold-compiles the qrcode module in CI) so the
  // first test's clock isn't spent on compilation. Generated code is persisted.
  await fetch(`${BASE_URL}/api/organiser/events/${EVENT_ID}/check-in-qr`, {
    method: "POST",
    headers: { Cookie: "__e2e_bypass=organiser" },
  }).catch(() => {});
});

test.afterAll(async () => {
  await prisma.event.delete({ where: { id: EVENT_ID } }).catch(() => {});
  await prisma.$disconnect();
});

test.beforeEach(async () => {
  await prisma.registration.update({
    where: { id: REG_ID },
    data: { checkedInAt: null },
  });
  await restoreWindow();
});

test("organiser generates a scannable check-in QR for their event", async ({ page }) => {
  const url = await getCheckinUrl(page);
  expect(new URL(url).pathname).toMatch(new RegExp(`^/checkin/${EVENT_ID}/`));
  // The QR image itself renders inside the dialog.
  await expect(page.getByRole("dialog").getByRole("img", { name: /Check-in QR code/ })).toBeVisible();
});

test("downloads a print-ready A4 check-in poster", async ({ page }) => {
  await getCheckinUrl(page);
  const dialog = page.getByRole("dialog");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("link", { name: /download a4 pdf/i }).click(),
  ]);

  // #473 presented as a `pdf.txt` download: the route had failed in the deployed
  // standalone build. Assert the response itself, not only the saved bytes.
  const pdfResponse = await page.request.get(
    `/api/organiser/events/${EVENT_ID}/check-in-qr/pdf`,
  );
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  expect(pdfResponse.headers()["content-disposition"]).toMatch(/-check-in-qr\.pdf/i);

  expect(download.suggestedFilename()).toMatch(/-check-in-qr\.pdf$/i);
  const file = await download.path();
  expect(file).toBeTruthy();
  const bytes = readFileSync(file!);
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
});

test("downloads a branded QR image", async ({ page }) => {
  await getCheckinUrl(page);
  const dialog = page.getByRole("dialog");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: /download qr image/i }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/-check-in-qr\.png$/i);
  const file = await download.path();
  expect(file).toBeTruthy();
  const bytes = readFileSync(file!);
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  // The PNG is composed at 1200×1200 (IHDR width/height live at 16 and 20).
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(1200);
});

test("logged-out visitor scanning the QR is prompted to sign in", async ({ page }) => {
  const url = await getCheckinUrl(page);
  await page.context().clearCookies();
  await page.goto(url);
  await expect(page.getByText("Sign in to check in")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("a user not registered for the event sees a clear error", async ({ page }) => {
  const url = await getCheckinUrl(page);
  await page.context().clearCookies();
  await setBypass(page, "avery"); // avery.quinn@startline.test — not registered for this event
  await page.goto(url);
  await expect(page.getByText("You're not registered for this event")).toBeVisible();
});

test("check-in is blocked before it opens", async ({ page }) => {
  const url = await getCheckinUrl(page);
  const beforeOpenStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const beforeOpenEnd = new Date(Date.now() + 4 * 60 * 60 * 1000);

  try {
    await setWindow(beforeOpenStart, beforeOpenEnd);
    await setBypass(page, "member");
    await page.goto(url);

    await expect(page.getByText("Check-in isn't open yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Check In" })).toHaveCount(0);

    const res = await page.request.post(`/api/checkin/${EVENT_ID}`, {
      data: { registrationId: REG_ID },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).checkIn.state).toBe("before");
  } finally {
    await restoreWindow();
  }
});

test("check-in is closed after the event ends", async ({ page }) => {
  const url = await getCheckinUrl(page);
  const endedStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const endedEnd = new Date(Date.now() - 60 * 1000);

  try {
    await setWindow(endedStart, endedEnd);
    await setBypass(page, "member");
    await page.goto(url);

    await expect(page.getByText("Check-in is closed")).toBeVisible();

    const res = await page.request.post(`/api/checkin/${EVENT_ID}`, {
      data: { registrationId: REG_ID },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).checkIn.state).toBe("closed");
  } finally {
    await restoreWindow();
  }
});

test("Activity opens the athlete's registration-specific check-in page", async ({ page }) => {
  await setBypass(page, "member");
  await page.goto("/activity");

  const checkIn = page.getByTestId("activity-check-in");
  await expect(checkIn).toBeVisible();
  await checkIn.click();

  await expect(page).toHaveURL(new RegExp(`/checkin/${EVENT_ID}\\?registration=${REG_ID}`));
  await expect(page.getByRole("heading", { name: "Check in to this event" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check In" })).toBeVisible();
});

test("signed-in registered athlete checks in and sees the confirmed state", async ({ page }) => {
  const url = await getCheckinUrl(page);
  await setBypass(page, "member"); // tom.whitfield@startline.test
  await page.goto(url);

  await expect(page.getByText("Check in to this event")).toBeVisible();
  await expect(page.getByRole("main").getByText(ATHLETE_NAME)).toBeVisible();

  await page.getByRole("button", { name: "Check In" }).click();
  await expect(page.getByText("You're checked in")).toBeVisible();

  // Re-visiting (or re-scanning) shows the already-checked-in state — no duplicate.
  await page.reload();
  await expect(page.getByText("You're checked in")).toBeVisible();
});

test("organiser dashboard shows the live checked-in count", async ({ page }) => {
  // Check in via the athlete API so the assertion doesn't depend on UI clicks.
  await setBypass(page, "member");
  const res = await page.request.post(`/api/checkin/${EVENT_ID}`, {
    data: { registrationId: REG_ID },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.checkedInAt).toBeTruthy();

  await organiserLogin(page);
  await page.goto(`/organiser/events/${EVENT_ID}/dashboard`);
  await page.getByRole("button", { name: "Check-in QR" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/1 of \d+ checked in/)).toBeVisible();
});

test("the full organiser roster shows who has checked in", async ({ page }) => {
  await setBypass(page, "member");
  const res = await page.request.post(`/api/checkin/${EVENT_ID}`, {
    data: { registrationId: REG_ID },
  });
  expect(res.ok()).toBeTruthy();

  await organiserLogin(page);
  await page.goto(`/organiser/events/${EVENT_ID}/dashboard?panel=manage`);
  await expect(page.getByTestId("roster-check-in")).toBeVisible();
});

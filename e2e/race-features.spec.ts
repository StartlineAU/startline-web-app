import { test, expect, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl, organiserLogin } from "./helpers";

// Start waves and bib numbers are opt-in per event (#566). A dedicated event
// keeps these tests away from the seeded Apex Throwdown board, which the
// race-management spec relies on having both features shared.
ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EVENT_ID = "e2e-race-features-event";
const MANAGE = `/organiser/events/${EVENT_ID}/dashboard?panel=manage`;
const TOM_EMAIL = "tom.whitfield@startline.test";
const TOM_REG = "e2e-race-features-tom";

// Sorted by name: Alice, Bea (already holds bib 2), Cara, Tom Whitfield.
const ATHLETES = [
  { id: "e2e-race-features-alice", name: "Alice Archer", email: "alice.archer@example.com", bib: null },
  { id: "e2e-race-features-bea", name: "Bea Brennan", email: "bea.brennan@example.com", bib: "2" },
  { id: "e2e-race-features-cara", name: "Cara Collins", email: "cara.collins@example.com", bib: null },
  { id: TOM_REG, name: "Tom Whitfield", email: TOM_EMAIL, bib: null },
];

async function setModes(waveMode: "OFF" | "PRIVATE" | "SHARED", bibMode: "OFF" | "PRIVATE" | "SHARED") {
  await prisma.event.update({ where: { id: EVENT_ID }, data: { waveMode, bibMode } });
}

/** Tom's own bib, as the athlete activity API returns it to him. */
async function tomsBibAsAthlete(request: APIRequestContext): Promise<string | null> {
  const res = await request.get("/api/user/registrations", {
    headers: { Cookie: "__e2e_bypass=member" },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  const mine = json.registrations.find((r: { id: string }) => r.id === TOM_REG);
  expect(mine, "Tom's registration should be listed").toBeTruthy();
  return mine.bibNumber;
}

test.beforeAll(async () => {
  const organiser = await prisma.organiser.findFirst({
    where: { orgName: "Apex Endurance Events" },
    select: { id: true },
  });
  expect(organiser, "seeded organiser should exist").toBeTruthy();
  const tom = await prisma.user.findUnique({ where: { email: TOM_EMAIL }, select: { id: true } });
  expect(tom, "seeded user Tom should exist").toBeTruthy();

  await prisma.event.delete({ where: { id: EVENT_ID } }).catch(() => {});
  await prisma.event.create({
    data: {
      id: EVENT_ID,
      organiserId: organiser!.id,
      status: "APPROVED",
      title: "E2E Race Features Event",
      discipline: "running",
      eventDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      startTime: "07:30",
      endTime: "12:00",
      timeZone: "Australia/Sydney",
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
    },
  });
  for (const a of ATHLETES) {
    await prisma.registration.create({
      data: {
        id: a.id,
        eventId: EVENT_ID,
        organiserId: organiser!.id,
        userId: a.id === TOM_REG ? tom!.id : null,
        athleteName: a.name,
        athleteEmail: a.email,
        waveLabel: "General",
        amountCents: 0,
        platformFeeCents: 0,
        feeStructure: "athlete",
        status: "CONFIRMED",
      },
    });
  }
});

test.afterAll(async () => {
  await prisma.event.delete({ where: { id: EVENT_ID } }).catch(() => {});
  await prisma.$disconnect();
});

test.beforeEach(async () => {
  await setModes("OFF", "OFF");
  for (const a of ATHLETES) {
    await prisma.registration.update({ where: { id: a.id }, data: { bibNumber: a.bib } });
  }
});

test.describe.configure({ mode: "serial" });

test("an event without waves or bibs opens on the simple registrations list", async ({ page }) => {
  await organiserLogin(page);
  await page.goto(MANAGE);

  await expect(page.getByTestId("simple-roster")).toBeVisible();
  await expect(page.getByText("Alice Archer")).toBeVisible();
  await expect(page.getByTestId("race-feature-card-waves")).toBeVisible();
  await expect(page.getByTestId("race-feature-card-bibs")).toBeVisible();
  // "Confirmed N" was noise above a list that already shows everyone.
  await expect(page.getByText(/^confirmed \d+$/i)).toHaveCount(0);

  // None of the race-day machinery shows until it is asked for.
  await expect(page.getByRole("button", { name: /manage waves/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /assign bibs/i })).toHaveCount(0);
  await expect(page.getByText(/needs a wave/i)).toHaveCount(0);
  await expect(page.getByText(/^Bibs$/)).toHaveCount(0);

  // The event is free: nothing was paid, so there is nothing to refund.
  await expect(page.getByRole("button", { name: /^before race$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^refunds/i })).toHaveCount(0);
});

test("set up bibs, then number the whole field in one go", async ({ page }) => {
  await organiserLogin(page);
  await page.goto(MANAGE);

  await page.getByRole("button", { name: /set up bib numbers/i }).click();
  await expect(page.getByTestId("race-feature-card-bibs")).toHaveAttribute("data-mode", "PRIVATE");
  await expect(page.getByTestId("race-feature-card-bibs")).toContainText(/only you can see this/i);

  await page.getByRole("button", { name: /assign bibs/i }).click();
  const dialog = page.getByRole("dialog");
  // Bea keeps #2, so the other three take 1, 3 and 4.
  await expect(dialog.getByTestId("assign-bibs-preview")).toHaveText("3 athletes will get bibs #1–#4.");
  await dialog.getByRole("button", { name: /^assign$/i }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText(/ready for race day/i)).toBeVisible();
  const roster = page.getByTestId("simple-roster");
  await expect(roster.getByText("#4")).toBeVisible();

  const bibs = await prisma.registration.findMany({
    where: { eventId: EVENT_ID },
    orderBy: { athleteName: "asc" },
    select: { bibNumber: true },
  });
  expect(bibs.map((b) => b.bibNumber)).toEqual(["1", "2", "3", "4"]);
});

test("waves and bibs can both be set up on the same event", async ({ page }) => {
  await organiserLogin(page);
  await page.goto(MANAGE);

  await page.getByRole("button", { name: /set up bib numbers/i }).click();
  await expect(page.getByTestId("race-feature-card-bibs")).toHaveAttribute("data-mode", "PRIVATE");
  await page.getByRole("button", { name: /set up start waves/i }).click();
  await expect(page.getByTestId("race-feature-card-waves")).toHaveAttribute("data-mode", "PRIVATE");
  await expect(page.getByTestId("race-feature-card-bibs")).toHaveAttribute("data-mode", "PRIVATE");

  await expect(page.getByRole("button", { name: /manage waves/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /assign bibs/i })).toBeVisible();
});

test("a bib stays private until the organiser shares bibs", async ({ page, request }) => {
  await setModes("OFF", "PRIVATE");
  await prisma.registration.update({ where: { id: TOM_REG }, data: { bibNumber: "77" } });

  expect(await tomsBibAsAthlete(request)).toBeNull();

  await organiserLogin(page);
  await page.goto(MANAGE);
  await page.getByRole("button", { name: /share bib numbers with athletes/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^share$/i }).click();
  await expect(page.getByTestId("race-feature-card-bibs")).toHaveAttribute("data-mode", "SHARED");
  await expect(page.getByTestId("race-feature-card-bibs")).toContainText(/athletes can see this/i);

  expect(await tomsBibAsAthlete(request)).toBe("77");
});

test("turning bibs off hides them and keeps every number", async ({ page }) => {
  await setModes("OFF", "SHARED");
  await prisma.registration.update({ where: { id: TOM_REG }, data: { bibNumber: "9" } });

  await organiserLogin(page);
  await page.goto(MANAGE);
  await expect(page.getByTestId("simple-roster").getByText("#9")).toBeVisible();

  await page.getByRole("button", { name: /turn off bib numbers/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^turn off$/i }).click();
  await expect(page.getByTestId("race-feature-card-bibs")).toHaveAttribute("data-mode", "OFF");
  await expect(page.getByTestId("simple-roster").getByText("#9")).toHaveCount(0);

  const tom = await prisma.registration.findUnique({ where: { id: TOM_REG }, select: { bibNumber: true } });
  expect(tom?.bibNumber).toBe("9");

  // And the server refuses a bib write while the feature is off.
  const res = await page.request.patch(`/api/organiser/events/${EVENT_ID}/registrations`, {
    data: { registrations: [{ registrationId: TOM_REG, bibNumber: "10" }] },
  });
  expect(res.status()).toBe(409);

  // Turning it back on brings the number straight back.
  await page.getByRole("button", { name: /set up bib numbers/i }).click();
  await expect(page.getByTestId("simple-roster").getByText("#9")).toBeVisible();
});

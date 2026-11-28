import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { organiserLogin, ensureDatabaseUrl, openOrganiserSettings } from "./helpers";

// Event completion (#561): a finished event stays manageable for results,
// reads "Completed" to organisers rather than "Archived".

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const createdIds: string[] = [];

async function createDraft(page: Parameters<typeof organiserLogin>[0], title: string) {
  const res = await page.request.post("/api/organiser/events", {
    data: {
      title,
      discipline: "Running",
      eventDate: "2027-06-14",
      startTime: "07:00",
      endTime: "10:00",
      venue: "Albert Park",
      address: "Aughtie Dr, Albert Park VIC 3206",
      city: "Melbourne",
      state: "VIC",
      format: "Individual",
      level: "All levels",
      registrationType: "startline",
      waves: [{ label: "General", price: "0", closes: "", startTime: "" }],
      submit: false,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id } = (await res.json()) as { id: string };
  createdIds.push(id);
  return id;
}

async function createFinishedEvent(page: Parameters<typeof organiserLogin>[0], title: string) {
  const id = await createDraft(page, title);

  // The lifecycle worker is what archives an event in a deployed environment.
  const event = await prisma.event.update({ where: { id }, data: { status: "ARCHIVED" } });
  const registration = await prisma.registration.create({
    data: {
      eventId: id,
      organiserId: event.organiserId,
      athleteName: "Finished Athlete",
      athleteEmail: `finished.${Date.now()}@startline.test`,
      waveLabel: "General",
      amountCents: 0,
      platformFeeCents: 0,
      feeStructure: "athlete",
      status: "CONFIRMED",
    },
  });
  return { id, registrationId: registration.id };
}

test.afterEach(async () => {
  if (createdIds.length === 0) return;
  await prisma.notification.deleteMany({ where: { eventId: { in: createdIds } } });
  await prisma.registration.deleteMany({ where: { eventId: { in: createdIds } } });
  await prisma.event.deleteMany({ where: { id: { in: createdIds } } });
  createdIds.length = 0;
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("finished events for organisers", () => {
  test("open the dashboard on results instead of locking the organiser out", async ({ page }) => {
    // Three cold dev-server compiles in one test (status page, dashboard,
    // race-management panel): CI routinely spends most of 45s on them.
    test.slow();
    await organiserLogin(page);
    const { id } = await createFinishedEvent(page, `E2E Finished ${Date.now()}`);

    const api = await page.request.get(`/api/organiser/events/${id}/dashboard`);
    expect(api.status()).toBe(200);
    expect((await api.json()).event.status).toBe("ARCHIVED");

    // The status page sends a finished event on to its dashboard.
    await page.goto(`/organiser/events/${id}`);
    await expect(page).toHaveURL(new RegExp(`/organiser/events/${id}/dashboard`), { timeout: 45_000 });
    await expect(page.getByText("This event is complete")).toBeVisible();
    await expect(page.getByRole("button", { name: /Check-in QR/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New announcement" })).toHaveCount(0);

    // Import results is off the After race tab until #565, so the athlete's
    // own result action is what proves the results board opened.
    await page.getByRole("button", { name: /Enter results/ }).click();
    await expect(page.getByRole("button", { name: "Add result for Finished Athlete" })).toBeVisible({ timeout: 30_000 });
  });

  test("still accept results", async ({ page }) => {
    await organiserLogin(page);
    const { id, registrationId } = await createFinishedEvent(page, `E2E Finished Results ${Date.now()}`);

    const res = await page.request.patch(`/api/organiser/events/${id}/results`, {
      data: { results: [{ registrationId, resultTime: "00:42:10", resultPlacement: "3rd" }] },
    });
    expect(res.ok(), await res.text()).toBe(true);

    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registrationId } });
    expect(saved.resultPlacement).toBe("3rd");
  });

  test("are labelled Completed in listings", async ({ page }) => {
    await organiserLogin(page);
    const title = `E2E Finished Listing ${Date.now()}`;
    await createFinishedEvent(page, title);

    await page.goto("/organiser/listings");
    await expect(page.getByRole("button", { name: /^Completed/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Archived/ })).toHaveCount(0);
  });
});

test.describe("athlete race history", () => {
  test("an entry for an event that has not happened is upcoming, not completed", async ({ page }) => {
    await organiserLogin(page);
    const title = `E2E Upcoming Entry ${Date.now()}`;
    // Dated 2027 by createDraft, so its UTC window is still ahead.
    const id = await createDraft(page, title);
    const event = await prisma.event.update({ where: { id }, data: { status: "APPROVED" } });
    const harper = await prisma.user.findUniqueOrThrow({ where: { email: "harper.jones@startline.test" } });
    await prisma.registration.create({
      data: {
        eventId: id,
        organiserId: event.organiserId,
        userId: harper.id,
        // Her own ticket: race history reads the athlete, not the buyer (#592).
        athleteUserId: harper.id,
        athleteName: "Harper Jones",
        athleteEmail: harper.email,
        waveLabel: "General",
        amountCents: 0,
        platformFeeCents: 0,
        feeStructure: "athlete",
        status: "CONFIRMED",
      },
    });

    await page.context().addCookies([
      { name: "__e2e_bypass", value: "athlete", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
    await page.goto("/profile");

    await expect(page.getByRole("heading", { name: "Upcoming", exact: true })).toBeVisible();
    const card = page.getByRole("link", { name: new RegExp(title) });
    await expect(card).toContainText("Upcoming");
    await expect(card).not.toContainText("Completed");
  });
});

// The athlete's own summary of a race they finished (#561): /races/[id].
test.describe("athlete race summary", () => {
  async function harperEntry(
    page: Parameters<typeof organiserLogin>[0],
    title: string,
    status: "ARCHIVED" | "APPROVED",
    result: { resultTime?: string; resultPlacement?: string } = {},
  ) {
    await organiserLogin(page);
    const id = await createDraft(page, title);
    const event = await prisma.event.update({ where: { id }, data: { status } });
    const harper = await prisma.user.findUniqueOrThrow({ where: { email: "harper.jones@startline.test" } });
    const registration = await prisma.registration.create({
      data: {
        eventId: id,
        organiserId: event.organiserId,
        userId: harper.id,
        athleteUserId: harper.id,
        athleteName: "Harper Jones",
        athleteEmail: harper.email,
        waveLabel: "General",
        amountCents: 0,
        platformFeeCents: 0,
        feeStructure: "athlete",
        status: "CONFIRMED",
        ...result,
      },
    });
    await page.context().clearCookies();
    await page.context().addCookies([
      { name: "__e2e_bypass", value: "athlete", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
    return { id, registrationId: registration.id, harper };
  }

  test("a finished race on the profile opens its summary with the result", async ({ page }) => {
    test.slow();
    const title = `E2E Raced ${Date.now()}`;
    const { registrationId } = await harperEntry(page, title, "ARCHIVED", {
      resultTime: "00:41:07",
      resultPlacement: "7th",
    });

    await page.goto("/profile");
    await page.getByRole("link", { name: new RegExp(title) }).click();

    await expect(page).toHaveURL(new RegExp(`/races/${registrationId}$`), { timeout: 45_000 });
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Race summary", { exact: true })).toBeVisible();
    const result = page.getByTestId("race-summary-result");
    await expect(result).toContainText("00:41:07");
    await expect(result).toContainText("7th");
    await expect(page.getByRole("link", { name: "Your profile" })).toBeVisible();
  });

  test("says when results are not posted yet", async ({ page }) => {
    const { registrationId } = await harperEntry(page, `E2E Raced No Result ${Date.now()}`, "ARCHIVED");
    await page.goto(`/races/${registrationId}`);
    await expect(page.getByTestId("race-summary-result")).toContainText("hasn't posted results yet");
  });

  test("a race still to come goes to the event page instead", async ({ page }) => {
    const { id, registrationId } = await harperEntry(page, `E2E Not Raced ${Date.now()}`, "APPROVED");
    await page.goto(`/races/${registrationId}`);
    await expect(page).toHaveURL(new RegExp(`/events/(${id}|[a-z0-9-]+)$`), { timeout: 45_000 });
    expect(page.url()).not.toContain("/races/");
  });

  // Privacy is covered by unit tests (race-summary.test.ts). Flipping a seeded
  // profile private here would race other spec files that read it.
  test("an entry that is nobody's race is not found", async ({ page }) => {
    // A ticket the buyer bought for someone with no account.
    await organiserLogin(page);
    const { registrationId } = await createFinishedEvent(page, `E2E Nobody's Race ${Date.now()}`);
    const res = await page.goto(`/races/${registrationId}`);
    expect(res?.status()).toBe(404);
  });
});

test.describe("event finished notice", () => {
  test("has its own switch in organisation notifications", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/profile");
    const settings = await openOrganiserSettings(page);
    await settings.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect(settings.getByRole("switch", { name: "Event finished" })).toHaveAttribute("aria-checked", "true");
  });

  // The worker is the only thing that announces a finished event, and it
  // needs the shared secret. CI without it skips this.
  test("the lifecycle worker announces a finished event once", async ({ page }) => {
    const secret = process.env.EVENT_LIFECYCLE_SECRET;
    test.skip(!secret, "EVENT_LIFECYCLE_SECRET is not set");
    await organiserLogin(page);
    const { id } = await createFinishedEvent(page, `E2E Finished Notice ${Date.now()}`);

    const call = () => page.request.post(`/api/internal/events/lifecycle?eventId=${id}`, {
      headers: { "x-event-lifecycle-secret": secret! },
    });
    expect((await call()).ok()).toBe(true);
    expect((await call()).ok()).toBe(true);

    const notices = await prisma.notification.findMany({ where: { eventId: id, type: "EVENT_FINISHED" } });
    expect(notices).toHaveLength(1);
    expect(notices[0].body).toContain("1 athlete entered.");
  });
});

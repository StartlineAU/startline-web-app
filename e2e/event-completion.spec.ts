import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { organiserLogin, ensureDatabaseUrl } from "./helpers";

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

    await page.getByRole("button", { name: /Enter results/ }).click();
    await expect(page.getByRole("button", { name: /Import results/ })).toBeVisible({ timeout: 30_000 });
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

import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl } from "./helpers";

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EXPIRED_ID = "e2e-lifecycle-expired";
const RUNNING_ID = "e2e-lifecycle-running";

async function organiserId(): Promise<string> {
  const organiser = await prisma.organiser.findFirst({
    where: { orgName: "Apex Endurance Events" },
    select: { id: true },
  });
  expect(organiser, "seeded Apex organiser should exist").toBeTruthy();
  return organiser!.id;
}

async function upsertEvent(args: {
  id: string;
  title: string;
  startsAtUtc: Date;
  endsAtUtc: Date;
}) {
  const organiser = await organiserId();
  const eventDate = args.startsAtUtc.toISOString().slice(0, 10);
  await prisma.event.upsert({
    where: { id: args.id },
    update: {
      status: "APPROVED",
      title: args.title,
      startsAtUtc: args.startsAtUtc,
      endsAtUtc: args.endsAtUtc,
    },
    create: {
      id: args.id,
      organiserId: organiser,
      status: "APPROVED",
      title: args.title,
      discipline: "running",
      description: "Lifecycle E2E fixture",
      eventDate,
      startTime: "07:00",
      endTime: "12:00",
      timeZone: "Australia/Sydney",
      startsAtUtc: args.startsAtUtc,
      endsAtUtc: args.endsAtUtc,
      venue: "Lifecycle Test Venue",
      city: "Sydney",
      state: "nsw",
      format: "individual",
      level: "open",
      categories: ["10K"],
      waves: [{ label: "General", price: "20" }],
      photos: [],
    },
  });
}

test.beforeAll(async () => {
  const now = Date.now();
  await upsertEvent({
    id: EXPIRED_ID,
    title: "E2E Expired Approved Event",
    startsAtUtc: new Date(now - 3 * 60 * 60 * 1000),
    endsAtUtc: new Date(now - 2 * 60 * 60 * 1000),
  });
  await upsertEvent({
    id: RUNNING_ID,
    title: "E2E Running Event",
    startsAtUtc: new Date(now - 60 * 60 * 1000),
    endsAtUtc: new Date(now + 2 * 60 * 60 * 1000),
  });
});

test.afterAll(async () => {
  await prisma.event.deleteMany({ where: { id: { in: [EXPIRED_ID, RUNNING_ID] } } });
  await prisma.$disconnect();
});

function eventIds(events: { id: string }[]) {
  return events.map((event) => event.id);
}

test.describe("event lifecycle reads", () => {
  test("an expired approved row never appears in public discovery, even with no worker run", async ({ request }) => {
    const res = await request.get("/api/events");
    expect(res.ok()).toBeTruthy();
    expect(eventIds(await res.json())).not.toContain(EXPIRED_ID);

    // A read does not write the row. The scheduled worker owns that transition.
    const row = await prisma.event.findUnique({
      where: { id: EXPIRED_ID },
      select: { status: true },
    });
    expect(row?.status).toBe("APPROVED");
  });

  test("historical event details remain reachable after the event is over", async ({ page, request }) => {
    const detail = await request.get(`/api/events/${EXPIRED_ID}/detail`);
    expect(detail.ok()).toBeTruthy();

    await page.goto(`/events/${EXPIRED_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "E2E Expired Approved Event" }))
      .toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Registration closed")).toBeVisible();
  });

  test("a running event stays discoverable but cannot be registered for", async ({ page, request }) => {
    const res = await request.get("/api/events");
    expect(eventIds(await res.json())).toContain(RUNNING_ID);

    const availability = await request.get(`/api/events/${RUNNING_ID}/availability`);
    expect(availability.status()).toBe(404);

    await page.goto(`/events/${RUNNING_ID}`);
    await expect(page.getByText("Event in progress")).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("link", { name: /register now/i })).toHaveCount(0);
  });
});

import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl } from "./helpers";

// Entry and payout records are financial history, and a suspended organisation
// is really suspended. Driven through the API with the dev bypass cookie, so it
// checks the server rules rather than what the UI happens to offer.

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EVENT_ID = "e2e-entry-records-event";
const EMPTY_EVENT_ID = "e2e-entry-records-empty";
const PAID_REG = "e2e-entry-records-paid";
const FREE_REG = "e2e-entry-records-free";
const FREE_REG_2 = "e2e-entry-records-free-2";

const SUSPENDED_EMAIL = "suspended.organiser@startline.test";
const SUSPENDED_EVENT_ID = "e2e-entry-records-suspended";

function cookie(identity: string) {
  return { Cookie: `__e2e_bypass=${identity}` };
}

function eventData(id: string, organiserId: string, cap: number | null = null) {
  const startsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return {
    id,
    organiserId,
    status: "APPROVED" as const,
    title: `E2E ${id}`,
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
    cap,
  };
}

function registration(id: string, organiserId: string, paid: boolean, status: "CONFIRMED" | "CANCELLED" = "CONFIRMED") {
  return {
    id,
    eventId: EVENT_ID,
    organiserId,
    athleteName: `Athlete ${id}`,
    athleteEmail: `${id}@startline.test`,
    waveLabel: "General",
    amountCents: paid ? 4500 : 0,
    platformFeeCents: paid ? 300 : 0,
    stripePaymentIntentId: paid ? `pi_${id}` : null,
    feeStructure: "athlete",
    status,
  };
}

async function cleanup() {
  await prisma.registration.deleteMany({ where: { eventId: { in: [EVENT_ID, SUSPENDED_EVENT_ID] } } });
  await prisma.event.deleteMany({ where: { id: { in: [EVENT_ID, EMPTY_EVENT_ID, SUSPENDED_EVENT_ID] } } });
  await prisma.organiser.deleteMany({ where: { email: SUSPENDED_EMAIL } });
  await prisma.user.deleteMany({ where: { email: SUSPENDED_EMAIL } });
}

let apexId = "";

test.beforeAll(async () => {
  await cleanup();
  const apex = await prisma.organiser.findFirst({
    where: { orgName: "Apex Endurance Events" },
    select: { id: true },
  });
  expect(apex, "seeded Apex organiser should exist").toBeTruthy();
  apexId = apex!.id;
});

test.beforeEach(async () => {
  await prisma.registration.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.event.deleteMany({ where: { id: { in: [EVENT_ID, EMPTY_EVENT_ID] } } });
  await prisma.event.create({ data: eventData(EVENT_ID, apexId, 2) });
  await prisma.registration.createMany({
    data: [
      registration(PAID_REG, apexId, true),
      registration(FREE_REG, apexId, false),
      registration(FREE_REG_2, apexId, false, "CANCELLED"),
    ],
  });
});

test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test.describe("organiser registration status", () => {
  async function patch(registrationId: string, status: string) {
    return fetch(`${BASE_URL}/api/organiser/events/${EVENT_ID}/registrations`, {
      method: "PATCH",
      headers: { ...cookie("organiser"), "Content-Type": "application/json" },
      body: JSON.stringify({ registrations: [{ registrationId, status }] }),
    });
  }

  test("cannot change a paid entry's status", async () => {
    for (const status of ["REFUNDED", "CANCELLED", "REFUND_REQUESTED"]) {
      const res = await patch(PAID_REG, status);
      expect(res.status, status).toBe(403);
    }
    const row = await prisma.registration.findUnique({ where: { id: PAID_REG } });
    expect(row?.status).toBe("CONFIRMED");
  });

  test("can send a paid entry's current status back unchanged", async () => {
    const res = await patch(PAID_REG, "CONFIRMED");
    expect(res.status).toBe(200);
  });

  test("can cancel a free entry, and reinstating it respects the cap", async () => {
    // Cap 2: the paid and the free entry hold both places.
    const full = await patch(FREE_REG_2, "CONFIRMED");
    expect(full.status).toBe(409);

    expect((await patch(FREE_REG, "CANCELLED")).status).toBe(200);
    expect((await prisma.registration.findUnique({ where: { id: FREE_REG } }))?.status).toBe("CANCELLED");

    expect((await patch(FREE_REG_2, "CONFIRMED")).status).toBe(200);
    expect((await prisma.registration.findUnique({ where: { id: FREE_REG_2 } }))?.status).toBe("CONFIRMED");
  });
});

test.describe("deleting events with entries", () => {
  test("the owner cannot delete an event that has taken entries", async () => {
    const res = await fetch(`${BASE_URL}/api/organiser/events/${EVENT_ID}`, {
      method: "DELETE",
      headers: cookie("organiser"),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("HAS_ENTRIES");
    expect(await prisma.registration.count({ where: { eventId: EVENT_ID } })).toBe(3);
  });

  test("an admin cannot either, singly or in bulk", async () => {
    const single = await fetch(`${BASE_URL}/api/admin/events/${EVENT_ID}`, {
      method: "DELETE",
      headers: cookie("admin"),
    });
    expect(single.status).toBe(409);

    await prisma.event.create({ data: eventData(EMPTY_EVENT_ID, apexId) });
    const bulk = await fetch(`${BASE_URL}/api/admin/events/bulk`, {
      method: "POST",
      headers: { ...cookie("admin"), "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [EVENT_ID, EMPTY_EVENT_ID], action: "delete" }),
    });
    expect(bulk.status).toBe(200);
    const body = await bulk.json();
    expect(body.affected).toBe(1);
    expect(body.blocked.map((b: { id: string }) => b.id)).toEqual([EVENT_ID]);

    expect(await prisma.event.findUnique({ where: { id: EVENT_ID } })).not.toBeNull();
    expect(await prisma.event.findUnique({ where: { id: EMPTY_EVENT_ID } })).toBeNull();
  });

  test("the database refuses the delete too", async () => {
    await expect(prisma.event.delete({ where: { id: EVENT_ID } })).rejects.toThrow();
  });
});

test.describe("suspended organisation", () => {
  test.beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: SUSPENDED_EMAIL, cognitoSub: "dev-bypass-suspended-test", name: "Suspended Organiser" },
    });
    const org = await prisma.organiser.create({
      data: {
        email: SUSPENDED_EMAIL,
        orgName: "E2E Suspended Org",
        createdBy: user.id,
        verified: true,
        status: "SUSPENDED",
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    await prisma.event.create({ data: eventData(SUSPENDED_EVENT_ID, org.id) });
  });

  test("is refused by the organiser API", async () => {
    const res = await fetch(`${BASE_URL}/api/organiser/events`, { headers: cookie("suspended") });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SUSPENDED");
  });

  test("has its events hidden and closed to entries", async () => {
    const availability = await fetch(`${BASE_URL}/api/events/${SUSPENDED_EVENT_ID}/availability`);
    expect(availability.status).toBe(404);

    const page = await fetch(`${BASE_URL}/events/${SUSPENDED_EVENT_ID}`);
    expect(page.status).toBe(404);
  });
});

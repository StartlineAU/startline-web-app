import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { adminLogin, ensureDatabaseUrl } from "./helpers";

// A refund is a support ticket reviewed by the organiser and Startline. Nothing
// is refunded from the ticket itself, and a change-of-mind request is refused
// inside 24 hours of the event start.

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// A seeded, published event owned by Coastal Fitness Collective.
const EVENT_ID = "seed-event-017";

test.afterAll(async () => {
  await prisma.supportTicket.deleteMany({ where: { eventId: EVENT_ID } });
  await prisma.$disconnect();
});

test.beforeEach(async () => {
  await prisma.supportTicket.deleteMany({ where: { eventId: EVENT_ID } });
});

test("a refund request opens a ticket the organiser and Startline can review", async ({ page }) => {
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

  // The organisation sees it and records its decision.
  await page.context().addCookies([
    { name: "__e2e_bypass", value: "user", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
  const list = await page.request.get("/api/organiser/refund-requests");
  expect(list.ok()).toBeTruthy();
  const { tickets } = await list.json();
  expect(tickets.some((t: { id: string }) => t.id === id)).toBe(true);

  const decided = await page.request.patch(`/api/organiser/refund-requests/${id}`, {
    data: { action: "approve" },
  });
  expect(decided.status()).toBe(200);
  expect((await prisma.supportTicket.findUnique({ where: { id } }))?.status).toBe("APPROVED");

  // Startline reviews the same queue.
  await adminLogin(page);
  const adminList = await page.request.get("/api/admin/refund-requests");
  expect(adminList.ok()).toBeTruthy();
  const adminData = await adminList.json();
  expect(adminData.tickets.some((t: { id: string }) => t.id === id)).toBe(true);
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

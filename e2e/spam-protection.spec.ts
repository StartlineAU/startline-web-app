import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl } from "./helpers";

// Spam & bot protection behavior that is deterministic without a real
// Turnstile (server fails open when TURNSTILE_SECRET_KEY is unset, which it
// is in the E2E environment).

ensureDatabaseUrl();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Reviews need an entry with the organiser, so the review test gives the
// "user" bypass identity (Jade Nguyen) one on an Apex event and removes it after.
const REVIEW_REG_ID = "e2e-spam-review-entry";
const REVIEW_EVENT_ID = "seed-event-001";
const REVIEWER_EMAIL = "jade.nguyen@startline.test";

async function reviewableOrganiserId(): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { id: REVIEW_EVENT_ID },
    select: { organiserId: true },
  });
  const user = await prisma.user.findUnique({ where: { email: REVIEWER_EMAIL }, select: { id: true } });
  expect(event, "seeded Apex event should exist").toBeTruthy();
  expect(user, "seeded reviewer should exist").toBeTruthy();
  await prisma.registration.upsert({
    where: { id: REVIEW_REG_ID },
    update: { status: "CONFIRMED" },
    create: {
      id: REVIEW_REG_ID,
      eventId: REVIEW_EVENT_ID,
      organiserId: event!.organiserId,
      userId: user!.id,
      athleteName: "Jade Nguyen",
      athleteEmail: REVIEWER_EMAIL,
      amountCents: 0,
      platformFeeCents: 0,
      feeStructure: "athlete",
      status: "CONFIRMED",
    },
  });
  return event!.organiserId;
}

test.afterAll(async () => {
  await prisma.registration.deleteMany({ where: { id: REVIEW_REG_ID } });
  await prisma.$disconnect();
});

test.describe("spam & bot protection", () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate via the E2E bypass so review/report routes accept the user.
    await page.context().addCookies([
      { name: "__e2e_bypass", value: "user", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
  });

  test("a user cannot create a second review for the same organiser", async ({ page }) => {
    const organiserId = await reviewableOrganiserId();

    const body = {
      overallRating: 4,
      title: "Spam protection review",
      body: "E2E test for the one-review-per-organiser rule.",
      eventId: null,
    };

    const first = await page.request.post(`/api/public/reviews/${organiserId}`, { data: body });
    expect([201, 409]).toContain(first.status());

    const second = await page.request.post(`/api/public/reviews/${organiserId}`, { data: body });
    expect(second.status()).toBe(409);
  });

  test("contact form is rate limited", async ({ page }) => {
    const payload = { name: "Bot", email: "bot@example.com", subject: "Spam", message: "Spam test." };

    // Limit is 3/hr per IP. Fire enough requests that at least one is blocked,
    // regardless of whether an earlier run already consumed part of the window.
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await page.request.post("/api/contact", { data: payload });
      statuses.push(res.status());
    }
    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
  });
});

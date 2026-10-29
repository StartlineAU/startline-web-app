import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl } from "./helpers";

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const IP = "198.51.100.77";
const GEOCODE_KEY = `places-geocode:${IP}`;

test.afterAll(async () => {
  await prisma.rateLimit.deleteMany({ where: { key: GEOCODE_KEY } });
  await prisma.$disconnect();
});

test.describe("paid API protections", () => {
  test("address autocomplete refuses an anonymous caller", async ({ request }) => {
    const res = await request.get("/api/places/autocomplete?q=George%20St");

    expect(res.status()).toBe(401);
  });

  test("ABN lookup refuses an anonymous caller", async ({ request }) => {
    const res = await request.get("/api/abn?abn=12345678901");

    expect(res.status()).toBe(401);
  });

  // A 429 here is the observable proof that the request stopped at the limiter
  // rather than crossing into the paid geocoder. The route's own unit test
  // asserts that the geocode function is not called.
  test("geocode refuses a caller that has spent its budget", async ({ request }) => {
    await prisma.rateLimit.upsert({
      where: { key: GEOCODE_KEY },
      create: {
        key: GEOCODE_KEY,
        count: 31,
        resetAt: new Date(Date.now() + 60_000),
      },
      update: {
        count: 31,
        resetAt: new Date(Date.now() + 60_000),
      },
    });

    const res = await request.get("/api/places/geocode?q=St%20Kilda", {
      headers: { "x-forwarded-for": IP },
    });

    expect(res.status()).toBe(429);
    expect(res.headers()["retry-after"]).toBeTruthy();
  });
});

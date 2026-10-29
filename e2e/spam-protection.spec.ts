import { test, expect } from "@playwright/test";

// Spam & bot protection behavior that is deterministic without a real
// Turnstile (server fails open when TURNSTILE_SECRET_KEY is unset, which it
// is in the E2E environment).

async function getOrganiserId(page: import("@playwright/test").Page): Promise<string> {
  const eventsRes = await page.request.get("/api/events");
  expect(eventsRes.ok()).toBeTruthy();
  const { events } = await eventsRes.json();
  const organiserId = events.find((e: { organiserId?: string }) => e.organiserId)?.organiserId;
  expect(organiserId).toBeTruthy();
  return organiserId as string;
}

test.describe("spam & bot protection", () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate via the E2E bypass so review/report routes accept the user.
    await page.context().addCookies([
      { name: "__e2e_bypass", value: "user", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
  });

  test("a user cannot create a second review for the same organiser", async ({ page }) => {
    const organiserId = await getOrganiserId(page);

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

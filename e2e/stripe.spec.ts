import { test, expect } from "@playwright/test";

// Self-contained Stripe Connect / payout tests. These exercise the API routes'
// auth and validation paths without making real Stripe API calls, so they run
// in CI and against any local DB state. Live end-to-end validation (real
// PaymentIntents, webhooks, payouts) lives in scripts/validate-stripe-connect.mjs.
const BYPASS_COOKIE = { name: "__e2e_bypass", value: "1", domain: "localhost", path: "/", sameSite: "Lax" as const };
const BYPASS_HEADER = { extraHTTPHeaders: { Cookie: "__e2e_bypass=1" } };

test.describe("admin payouts API", () => {
  test("GET /api/admin/payouts returns 401 without auth", async ({ request }) => {
    const res = await request.get("/api/admin/payouts");
    expect(res.status()).toBe(401);
  });

  test("GET /api/admin/payouts returns a well-formed event list with auth", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000", ...BYPASS_HEADER });
    const res = await ctx.get("/api/admin/payouts");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("events");
    expect(Array.isArray(body.events)).toBe(true);
    await ctx.dispose();
  });

  test("POST /api/admin/payouts requires eventId", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000", ...BYPASS_HEADER });
    const res = await ctx.post("/api/admin/payouts", { data: {} });
    expect(res.status()).toBe(400);
    await ctx.dispose();
  });

  test("POST /api/admin/payouts returns 404 for a non-existent event", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000", ...BYPASS_HEADER });
    const res = await ctx.post("/api/admin/payouts", { data: { eventId: "does-not-exist" } });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not found");
    await ctx.dispose();
  });
});

test.describe("admin payouts page", () => {
  test("renders the payout view", async ({ page }) => {
    await page.context().addCookies([BYPASS_COOKIE]);
    await page.goto("/admin/payouts");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/stripe payouts/i).first()).toBeVisible();
  });
});

test.describe("stripe webhook", () => {
  test("POST /api/stripe/webhook returns 400 without a signature", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", {
      data: { type: "payment_intent.succeeded" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/stripe/webhook returns 400 for a malformed signature", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", {
      headers: { "stripe-signature": "garbage" },
      data: { type: "payment_intent.succeeded" },
    });
    expect(res.status()).toBe(400);
  });
});

// Issue #379: organiser accounts on Accounts v2. These never reach Stripe's
// account APIs with a real account, so they only pin the route contract.
test.describe("stripe connect (Accounts v2)", () => {
  test("POST /api/organiser/stripe/connect requires an organiser", async ({ request }) => {
    const res = await request.post("/api/organiser/stripe/connect");
    expect(res.status()).toBe(401);
  });

  test("POST /api/organiser/stripe/connect answers with a link or a reason", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: { Cookie: "__e2e_bypass=organiser" },
    });
    const res = await ctx.post("/api/organiser/stripe/connect");
    const body = await res.json();
    // Without Stripe keys (local dev, CI) the route says payments are
    // unavailable; with test keys it returns a v2 onboarding link.
    if (res.status() === 200) {
      expect(body.url).toMatch(/^https:\/\/[a-z.]*stripe\.com\//);
    } else {
      expect(res.status()).toBe(503);
      expect(typeof body.error).toBe("string");
    }
    await ctx.dispose();
  });

  test("GET /api/organiser/stripe/status keeps its response shape", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: { Cookie: "__e2e_bypass=organiser" },
    });
    const res = await ctx.get("/api/organiser/stripe/status");
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toEqual({
        connected:      expect.any(Boolean),
        chargesEnabled: expect.any(Boolean),
        payoutsEnabled: expect.any(Boolean),
      });
    } else {
      // A seeded account id the local key cannot see.
      expect(res.status()).toBe(503);
    }
    await ctx.dispose();
  });

  // A 404 here means the v2 event destination has nowhere to deliver, and
  // onboarding then completes only when the organiser comes back from Stripe.
  test("POST /api/stripe/account-events exists and refuses unsigned events", async ({ request }) => {
    const res = await request.post("/api/stripe/account-events", {
      data: { type: "v2.core.account[configuration.recipient].capability_status_updated" },
    });
    // 400 = signature checked and refused; 503 = no destination secret here.
    expect([400, 503]).toContain(res.status());
  });
});

test.describe("checkout API — Stripe Connect gate", () => {
  test("POST /api/checkout rejects an event whose organiser is not Stripe-onboarded", async ({ request }) => {
    // seed-event-001's organiser has no stripeAccountId by default, so the
    // Connect gate (or the dev direct-charge bypass) rejects the request
    // before any Stripe API call is made.
    const res = await request.post("/api/checkout", {
      data: {
        eventId: "seed-event-001",
        waveLabel: "Late Entry",
        firstName: "Jordan",
        lastName: "Clarke",
        email: "jordan@example.com",
        mobile: "0400000000",
        emergencyContactName: "Sam",
        emergencyContactPhone: "0400000001",
        waiverAccepted: true,
        dateOfBirth: "1990-01-01",
      },
    });
    // If setup-stripe-local.mjs or the validation script has onboarded the seed
    // organiser locally, checkout creates a real (test-mode) PaymentIntent and
    // the gate under test is no longer active — skip rather than fail.
    if (res.status() === 200) {
      test.skip();
      return;
    }
    // 409 = event not ready for payments, or a closed tier. Either way it must
    // fail without attempting a Stripe charge.
    expect([400, 409]).toContain(res.status());
  });
});

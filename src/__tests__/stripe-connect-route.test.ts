import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Issue #322: an organiser with a real ABN could not start Stripe onboarding
// and only ever saw "Failed to create Stripe onboarding link.". These cover the
// cases that message used to hide.

const mocks = vi.hoisted(() => ({
  requireOrganiser: vi.fn(),
  organiser: { findUnique: vi.fn(), update: vi.fn() },
  createAccount: vi.fn(),
  createAccountLink: vi.fn(),
  configured: { value: true },
}));

vi.mock("@/lib/organiser-api-auth", () => ({ requireOrganiser: mocks.requireOrganiser }));
vi.mock("@/lib/prisma", () => ({ default: { organiser: mocks.organiser } }));
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => mocks.configured.value,
  getStripe: () => ({
    accounts: { create: mocks.createAccount },
    accountLinks: { create: mocks.createAccountLink },
  }),
}));

const ORGANISER = "org-1";

function stripeError(code: string) {
  return Object.assign(new Error(`No such account`), {
    type: "StripeInvalidRequestError",
    code,
    requestId: "req_123",
  });
}

async function loadRoute(siteUrl?: string) {
  vi.resetModules();
  if (siteUrl) vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  return (await import("@/app/api/organiser/stripe/connect/route")).POST;
}

describe("POST /api/organiser/stripe/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.configured.value = true;
    mocks.requireOrganiser.mockResolvedValue({ session: { sub: ORGANISER } });
    mocks.organiser.update.mockResolvedValue({});
    mocks.createAccount.mockResolvedValue({ id: "acct_new" });
    mocks.createAccountLink.mockResolvedValue({ url: "https://connect.stripe.com/setup/e/acct_new" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("says payments are unavailable when the environment has no Stripe key", async () => {
    mocks.configured.value = false;
    const POST = await loadRoute();

    const res = await POST();

    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/not available yet/);
    expect(mocks.organiser.findUnique).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("STRIPE_SECRET_KEY"));
  });

  it("creates an Express account on first connect and returns the onboarding link", async () => {
    mocks.organiser.findUnique.mockResolvedValue({ stripeAccountId: null, email: "hugo@example.com" });
    const POST = await loadRoute();

    const res = await POST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://connect.stripe.com/setup/e/acct_new" });
    expect(mocks.createAccount).toHaveBeenCalledWith(expect.objectContaining({ type: "express", country: "AU" }));
    expect(mocks.organiser.update).toHaveBeenCalledWith({
      where: { id: ORGANISER },
      data:  { stripeAccountId: "acct_new", stripeOnboardingComplete: false },
    });
  });

  it("reuses an existing account", async () => {
    mocks.organiser.findUnique.mockResolvedValue({ stripeAccountId: "acct_old", email: "hugo@example.com" });
    const POST = await loadRoute();

    const res = await POST();

    expect(res.status).toBe(200);
    expect(mocks.createAccount).not.toHaveBeenCalled();
    expect(mocks.createAccountLink).toHaveBeenCalledWith(expect.objectContaining({ account: "acct_old" }));
  });

  // An id from the other Stripe mode (or a deleted account) can never produce
  // a link, so without this the organiser would be stuck permanently.
  it("replaces a stored account Stripe no longer recognises", async () => {
    mocks.organiser.findUnique.mockResolvedValue({ stripeAccountId: "acct_test_mode", email: "hugo@example.com" });
    mocks.createAccountLink
      .mockRejectedValueOnce(stripeError("resource_missing"))
      .mockResolvedValueOnce({ url: "https://connect.stripe.com/setup/e/acct_new" });
    const POST = await loadRoute();

    const res = await POST();

    expect(res.status).toBe(200);
    expect(mocks.createAccount).toHaveBeenCalledTimes(1);
    expect(mocks.createAccountLink).toHaveBeenLastCalledWith(expect.objectContaining({ account: "acct_new" }));
    expect(mocks.organiser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stripeAccountId: "acct_new", stripeOnboardingComplete: false } }),
    );
  });

  it("does not replace the account for other Stripe errors, and logs the Stripe details", async () => {
    mocks.organiser.findUnique.mockResolvedValue({ stripeAccountId: "acct_old", email: "hugo@example.com" });
    mocks.createAccountLink.mockRejectedValue(stripeError("rate_limit"));
    const POST = await loadRoute();

    const res = await POST();

    expect(res.status).toBe(503);
    expect(mocks.createAccount).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("account link"),
      expect.objectContaining({ code: "rate_limit", requestId: "req_123" }),
    );
  });

  it("returns a 503 and logs when Stripe refuses to create the account", async () => {
    mocks.organiser.findUnique.mockResolvedValue({ stripeAccountId: null, email: "hugo@example.com" });
    mocks.createAccount.mockRejectedValue(stripeError("platform_account_required"));
    const POST = await loadRoute();

    const res = await POST();

    expect(res.status).toBe(503);
    expect(mocks.organiser.update).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("create account"),
      expect.objectContaining({ code: "platform_account_required" }),
    );
  });

  // Production's site URL is the athlete host, which rewrites /organiser/* to
  // the waitlist, so Stripe has to send the organiser back to their own portal.
  it("sends the organiser back to the organiser portal in production", async () => {
    mocks.organiser.findUnique.mockResolvedValue({ stripeAccountId: "acct_old", email: "hugo@example.com" });
    const POST = await loadRoute("https://startlineau.com");

    await POST();

    expect(mocks.createAccountLink).toHaveBeenCalledWith(expect.objectContaining({
      return_url:  "https://organiser.startlineau.com/organiser/payments/return",
      refresh_url: "https://organiser.startlineau.com/organiser/payments?refresh=1",
    }));
  });
});

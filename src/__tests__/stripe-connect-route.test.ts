import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Issue #322: an organiser with a real ABN could not start Stripe onboarding
// and only ever saw "Failed to create Stripe onboarding link.". These cover the
// cases that message used to hide.

const mocks = vi.hoisted(() => ({
  getOrganiserSession: vi.fn(),
  organiser: { findUnique: vi.fn(), update: vi.fn() },
  createAccount: vi.fn(),
  retrieveAccount: vi.fn(),
  updateAccount: vi.fn(),
  createAccountLink: vi.fn(),
  updateBalanceSettings: vi.fn(),
  configured: { value: true },
}));

vi.mock("@/lib/amplify-server", () => ({ getOrganiserSession: mocks.getOrganiserSession }));
vi.mock("@/lib/prisma", () => ({ default: { organiser: mocks.organiser } }));
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => mocks.configured.value,
  getStripe: () => ({
    v2: {
      core: {
        accounts:     { create: mocks.createAccount, retrieve: mocks.retrieveAccount, update: mocks.updateAccount },
        accountLinks: { create: mocks.createAccountLink },
      },
    },
    balanceSettings: { update: mocks.updateBalanceSettings },
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
    mocks.getOrganiserSession.mockResolvedValue({ sub: ORGANISER });
    mocks.organiser.update.mockResolvedValue({});
    mocks.createAccount.mockResolvedValue({ id: "acct_new" });
    mocks.createAccountLink.mockResolvedValue({ url: "https://connect.stripe.com/setup/e/acct_new" });
    mocks.updateBalanceSettings.mockResolvedValue({});
    mocks.retrieveAccount.mockResolvedValue({
      id: "acct_old",
      identity: { entity_type: "individual", individual: null },
    });
    mocks.updateAccount.mockResolvedValue({});
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

  // Issue #379: v1 account creation is off by default on new platforms.
  it("creates an Accounts v2 account on first connect and returns the onboarding link", async () => {
    mocks.organiser.findUnique.mockResolvedValue({ stripeAccountId: null, email: "hugo@example.com" });
    const POST = await loadRoute();

    const res = await POST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://connect.stripe.com/setup/e/acct_new" });
    expect(mocks.createAccount).toHaveBeenCalledWith(expect.objectContaining({
      contact_email: "hugo@example.com",
      dashboard:     "express",
      identity:      { country: "AU" },
      defaults:      expect.objectContaining({
        currency:         "aud",
        responsibilities: { fees_collector: "application", losses_collector: "application" },
      }),
      configuration: {
        merchant:  { capabilities: { card_payments: { requested: true } } },
        recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
      },
    }));
    expect(mocks.createAccountLink).toHaveBeenCalledWith(expect.objectContaining({
      account:  "acct_new",
      use_case: expect.objectContaining({
        type:               "account_onboarding",
        account_onboarding: expect.objectContaining({ configurations: ["merchant", "recipient"] }),
      }),
    }));
    expect(mocks.organiser.update).toHaveBeenCalledWith({
      where: { id: ORGANISER },
      data:  { stripeAccountId: "acct_new", stripeOnboardingComplete: false },
    });
  });

  // Issue #336: the organiser may be a company. Stripe's hosted onboarding asks
  // which legal entity it is, so the account must not be created as an
  // individual or preloaded with a person's details.
  it("leaves the legal entity type for Stripe to ask during onboarding", async () => {
    mocks.organiser.findUnique.mockResolvedValue({
      stripeAccountId: null, email: "hugo@example.com",
      legalName: "Hugo Van Der Berg", dob: "1990-04-07", stripeOnboardingComplete: false,
    });
    const POST = await loadRoute();

    const res = await POST();

    expect(res.status).toBe(200);
    expect(mocks.createAccount).toHaveBeenCalledWith(expect.objectContaining({
      identity: { country: "AU" },
    }));
  });

  it("fills in what an unfinished existing individual account is missing, and nothing it holds", async () => {
    mocks.organiser.findUnique.mockResolvedValue({
      stripeAccountId: "acct_old", email: "hugo@example.com",
      legalName: "Hugo Berg", dob: "1990-04-07", stripeOnboardingComplete: false,
    });
    // Typed into Stripe's own form on an earlier visit: Stripe's copy wins.
    mocks.retrieveAccount.mockResolvedValue({
      id: "acct_old",
      identity: { entity_type: "individual", individual: { given_name: "Hugh", surname: "Berg" } },
    });
    const POST = await loadRoute();

    const res = await POST();

    expect(res.status).toBe(200);
    expect(mocks.retrieveAccount).toHaveBeenCalledWith("acct_old", { include: ["identity"] });
    expect(mocks.updateAccount).toHaveBeenCalledWith("acct_old", {
      identity: { individual: { date_of_birth: { day: 7, month: 4, year: 1990 } } },
    });
  });

  it("does not give a company account an individual's details", async () => {
    mocks.organiser.findUnique.mockResolvedValue({
      stripeAccountId: "acct_old", email: "hugo@example.com",
      legalName: "Hugo Berg", dob: "1990-04-07", stripeOnboardingComplete: false,
    });
    mocks.retrieveAccount.mockResolvedValue({
      id: "acct_old",
      identity: { entity_type: "company", individual: null },
    });
    const POST = await loadRoute();

    const res = await POST();

    expect(res.status).toBe(200);
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it("does not prefill an account whose entity type Stripe has not set", async () => {
    mocks.organiser.findUnique.mockResolvedValue({
      stripeAccountId: "acct_old", email: "hugo@example.com",
      legalName: "Hugo Berg", dob: "1990-04-07", stripeOnboardingComplete: false,
    });
    mocks.retrieveAccount.mockResolvedValue({ id: "acct_old", identity: {} });
    const POST = await loadRoute();

    const res = await POST();

    expect(res.status).toBe(200);
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it("leaves a finished account alone", async () => {
    mocks.organiser.findUnique.mockResolvedValue({
      stripeAccountId: "acct_old", email: "hugo@example.com",
      legalName: "Hugo Berg", dob: "1990-04-07", stripeOnboardingComplete: true,
    });
    const POST = await loadRoute();

    await POST();

    expect(mocks.retrieveAccount).not.toHaveBeenCalled();
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it("still hands out the link when the prefill fails", async () => {
    mocks.organiser.findUnique.mockResolvedValue({
      stripeAccountId: "acct_old", email: "hugo@example.com",
      legalName: "Hugo Berg", dob: "1990-04-07", stripeOnboardingComplete: false,
    });
    mocks.updateAccount.mockRejectedValue(stripeError("parameter_invalid_empty"));
    const POST = await loadRoute();

    const res = await POST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://connect.stripe.com/setup/e/acct_new" });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("prefill"), expect.anything());
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
      use_case: expect.objectContaining({
        account_onboarding: expect.objectContaining({
          return_url:  "https://organiser.startlineau.com/organiser/payments/return",
          refresh_url: "https://organiser.startlineau.com/organiser/payments?refresh=1",
        }),
      }),
    }));
  });

  // v2 accounts have no payout schedule of their own. Without this, Stripe
  // would sweep ticket money to the bank before lib/payout.ts runs.
  it("holds payouts for the manual payout run on every connect", async () => {
    mocks.organiser.findUnique.mockResolvedValue({ stripeAccountId: "acct_old", email: "hugo@example.com" });
    const POST = await loadRoute();

    await POST();

    expect(mocks.updateBalanceSettings).toHaveBeenCalledWith(
      { payments: { payouts: { schedule: { interval: "manual" } } } },
      { stripeAccount: "acct_old" },
    );
  });

  it("does not hand out a link when the payout schedule cannot be set", async () => {
    mocks.organiser.findUnique.mockResolvedValue({ stripeAccountId: "acct_old", email: "hugo@example.com" });
    mocks.updateBalanceSettings.mockRejectedValue(stripeError("rate_limit"));
    const POST = await loadRoute();

    const res = await POST();

    expect(res.status).toBe(503);
    expect(mocks.createAccountLink).not.toHaveBeenCalled();
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });
});

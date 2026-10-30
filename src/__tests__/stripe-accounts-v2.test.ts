import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";
import { NextRequest } from "next/server";
import { actionRequiredFromAccount, connectStatusFromAccount, individualPrefill, isOnboardingComplete, prefillExistingAccount } from "@/lib/stripe-connect";

// Issue #379: organiser accounts on Accounts v2. charges_enabled and
// payouts_enabled are gone; onboarding is read from capability statuses, by the
// status route and by the v2 event destination.

const mocks = vi.hoisted(() => ({
  requireOrganiser: vi.fn(),
  organiser: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  retrieveAccount: vi.fn(),
  updateAccount: vi.fn(),
  parseEventNotification: vi.fn(),
  configured: { value: true },
}));

vi.mock("@/lib/organiser-api-auth", () => ({ requireOrganiser: mocks.requireOrganiser }));
vi.mock("@/lib/prisma", () => ({ default: { organiser: mocks.organiser } }));
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => mocks.configured.value,
  getStripe: () => ({
    v2: { core: { accounts: { retrieve: mocks.retrieveAccount, update: mocks.updateAccount } } },
    parseEventNotification: mocks.parseEventNotification,
  }),
}));

type Status = "active" | "pending" | "restricted" | "unsupported";

function account(
  { card = "active", transfers = "active", payouts = "active" }: { card?: Status; transfers?: Status; payouts?: Status } = {},
): Stripe.V2.Core.Account {
  return {
    id: "acct_v2",
    configuration: {
      merchant:  { capabilities: { card_payments: { status: card, status_details: [] } } },
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { status: transfers, status_details: [] },
            payouts:          { status: payouts, status_details: [] },
          },
        },
      },
    },
  } as unknown as Stripe.V2.Core.Account;
}

describe("individualPrefill", () => {
  it("splits the surname off the end of the legal name", () => {
    expect(individualPrefill("Nathan Sweet", null)).toEqual({ given_name: "Nathan", surname: "Sweet" });
    expect(individualPrefill("  Mary  Jane   Watson ", null)).toEqual({ given_name: "Mary Jane", surname: "Watson" });
  });

  it("leaves a one-word name for Stripe to ask about", () => {
    expect(individualPrefill("Cher", null)).toEqual({});
    expect(individualPrefill(null, null)).toEqual({});
  });

  it("passes on a real date of birth for an adult", () => {
    expect(individualPrefill(null, "1990-04-07")).toEqual({ date_of_birth: { day: 7, month: 4, year: 1990 } });
  });

  it("drops a date that does not exist, is malformed or belongs to a minor", () => {
    expect(individualPrefill(null, "1990-02-30")).toEqual({});
    expect(individualPrefill(null, "07/04/1990")).toEqual({});
    expect(individualPrefill(null, "2999-01-01")).toEqual({});
    const tenYearsAgo = `${new Date().getUTCFullYear() - 10}-01-01`;
    expect(individualPrefill(null, tenYearsAgo)).toEqual({});
  });
});

// Issue #336: a new account lets Stripe ask whether the organiser is an
// individual or a company. Only an account Stripe has already established as
// an individual can take a person's details.
describe("prefillExistingAccount", () => {
  const stripe = {
    v2: { core: { accounts: { retrieve: mocks.retrieveAccount, update: mocks.updateAccount } } },
  } as unknown as Stripe;
  const prefill = { given_name: "Hugo", surname: "Berg" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateAccount.mockResolvedValue({});
  });

  it("fills in an individual account", async () => {
    mocks.retrieveAccount.mockResolvedValue({ identity: { entity_type: "individual", individual: null } });

    await prefillExistingAccount(stripe, "acct_1", prefill);

    expect(mocks.updateAccount).toHaveBeenCalledWith("acct_1", {
      identity: { individual: prefill },
    });
  });

  it("leaves a company account's representative for Stripe to collect", async () => {
    mocks.retrieveAccount.mockResolvedValue({ identity: { entity_type: "company", individual: null } });

    await prefillExistingAccount(stripe, "acct_1", prefill);

    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it("leaves an account with no entity type for onboarding to ask", async () => {
    mocks.retrieveAccount.mockResolvedValue({ identity: {} });

    await prefillExistingAccount(stripe, "acct_1", prefill);

    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });
});

describe("connectStatusFromAccount", () => {
  it("is complete when card payments, transfers and payouts are all active", () => {
    const status = connectStatusFromAccount(account());
    expect(status).toEqual({ chargesEnabled: true, payoutsEnabled: true });
    expect(isOnboardingComplete(status)).toBe(true);
  });

  // Checkout is a destination charge, so an account that can take cards but
  // not receive transfers still cannot be sold through.
  it("cannot charge until transfers are active", () => {
    expect(connectStatusFromAccount(account({ transfers: "pending" })).chargesEnabled).toBe(false);
    expect(connectStatusFromAccount(account({ card: "restricted" })).chargesEnabled).toBe(false);
  });

  it("is not complete while payouts are pending", () => {
    const status = connectStatusFromAccount(account({ payouts: "pending" }));
    expect(status).toEqual({ chargesEnabled: true, payoutsEnabled: false });
    expect(isOnboardingComplete(status)).toBe(false);
  });

  // An account Stripe has not yet configured, or a response without includes.
  it("treats missing configurations as not enabled", () => {
    expect(connectStatusFromAccount({ id: "acct_x" } as Stripe.V2.Core.Account))
      .toEqual({ chargesEnabled: false, payoutsEnabled: false });
  });

  // v1 accounts read through v2 can report payouts on the merchant side.
  it("accepts payouts reported on the merchant configuration", () => {
    const a = account({ payouts: "pending" });
    (a.configuration!.merchant!.capabilities as Record<string, unknown>).stripe_balance =
      { payouts: { status: "active", status_details: [] } };
    expect(connectStatusFromAccount(a).payoutsEnabled).toBe(true);
  });
});

// Issue #387: once the form is submitted, Stripe can hold capabilities at
// "pending" while it verifies. The organiser then has nothing to do, and the
// payments page must not send them back into onboarding.
describe("actionRequiredFromAccount", () => {
  function withEntries(entries: unknown[]): Stripe.V2.Core.Account {
    return { ...account({ payouts: "pending" }), requirements: { entries } } as unknown as Stripe.V2.Core.Account;
  }

  it("is false when nothing is outstanding", () => {
    expect(actionRequiredFromAccount(account())).toBe(false);
    expect(actionRequiredFromAccount(withEntries([]))).toBe(false);
  });

  it("is false while only Stripe has work to do", () => {
    expect(actionRequiredFromAccount(withEntries([
      { awaiting_action_from: "stripe", minimum_deadline: { status: "currently_due" } },
    ]))).toBe(false);
  });

  it("is true when the organiser owes something now", () => {
    expect(actionRequiredFromAccount(withEntries([
      { awaiting_action_from: "user", minimum_deadline: { status: "currently_due" } },
    ]))).toBe(true);
    expect(actionRequiredFromAccount(withEntries([
      { awaiting_action_from: "user", minimum_deadline: { status: "past_due" } },
    ]))).toBe(true);
  });

  it("ignores requirements that are only eventually due", () => {
    expect(actionRequiredFromAccount(withEntries([
      { awaiting_action_from: "user", minimum_deadline: { status: "eventually_due" } },
    ]))).toBe(false);
  });
});

describe("GET /api/organiser/stripe/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.requireOrganiser.mockResolvedValue({ session: { sub: "org-1" } });
  });

  async function get() {
    const { GET } = await import("@/app/api/organiser/stripe/status/route");
    return GET();
  }

  it("marks onboarding complete from v2 capability status", async () => {
    mocks.organiser.findUnique.mockResolvedValue({ stripeAccountId: "acct_v2", stripeOnboardingComplete: false });
    mocks.retrieveAccount.mockResolvedValue(account());

    const res = await get();

    expect(await res.json()).toEqual({ connected: true, chargesEnabled: true, payoutsEnabled: true, actionRequired: false });
    expect(mocks.retrieveAccount).toHaveBeenCalledWith("acct_v2", {
      include: expect.arrayContaining(["configuration.merchant", "configuration.recipient"]),
    });
    expect(mocks.organiser.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data:  { stripeOnboardingComplete: true },
    });
  });

  it("leaves the flag alone while a capability is pending", async () => {
    mocks.organiser.findUnique.mockResolvedValue({ stripeAccountId: "acct_v2", stripeOnboardingComplete: false });
    mocks.retrieveAccount.mockResolvedValue(account({ payouts: "pending" }));

    const res = await get();

    expect(await res.json()).toEqual({ connected: true, chargesEnabled: true, payoutsEnabled: false, actionRequired: false });
    expect(mocks.organiser.update).not.toHaveBeenCalled();
  });

  it("says when the organiser still owes Stripe something", async () => {
    mocks.organiser.findUnique.mockResolvedValue({ stripeAccountId: "acct_v2", stripeOnboardingComplete: false });
    mocks.retrieveAccount.mockResolvedValue({
      ...account({ transfers: "pending" }),
      requirements: { entries: [{ awaiting_action_from: "user", minimum_deadline: { status: "currently_due" } }] },
    });

    const res = await get();

    expect((await res.json()).actionRequired).toBe(true);
  });
});

describe("POST /api/stripe/account-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.configured.value = true;
    vi.stubEnv("STRIPE_ACCOUNT_EVENTS_SECRET", "whsec_test");
    mocks.organiser.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function post() {
    const { POST } = await import("@/app/api/stripe/account-events/route");
    return POST(new NextRequest("http://localhost/api/stripe/account-events", {
      method:  "POST",
      body:    "{}",
      headers: { "stripe-signature": "t=1,v1=sig" },
    }));
  }

  function notify(type: string, accountId = "acct_v2") {
    mocks.parseEventNotification.mockReturnValue({ type, related_object: { id: accountId, type: "v2.core.account", url: "" } });
  }

  it("says it is not configured without the destination secret", async () => {
    vi.stubEnv("STRIPE_ACCOUNT_EVENTS_SECRET", "");

    const res = await post();

    expect(res.status).toBe(503);
    expect(mocks.parseEventNotification).not.toHaveBeenCalled();
  });

  it("rejects a bad signature", async () => {
    mocks.parseEventNotification.mockImplementation(() => { throw new Error("bad signature"); });

    const res = await post();

    expect(res.status).toBe(400);
    expect(mocks.organiser.updateMany).not.toHaveBeenCalled();
  });

  it("verifies against the destination's own secret", async () => {
    notify("v2.core.account[configuration.recipient].capability_status_updated");
    mocks.retrieveAccount.mockResolvedValue(account());

    await post();

    expect(mocks.parseEventNotification).toHaveBeenCalledWith("{}", "t=1,v1=sig", "whsec_test");
  });

  it("marks onboarding complete when a capability update finishes it", async () => {
    notify("v2.core.account[configuration.recipient].capability_status_updated");
    mocks.retrieveAccount.mockResolvedValue(account());

    const res = await post();

    expect(res.status).toBe(200);
    expect(mocks.organiser.updateMany).toHaveBeenCalledWith({
      where: { stripeAccountId: "acct_v2", stripeOnboardingComplete: false },
      data:  { stripeOnboardingComplete: true },
    });
  });

  it("does nothing while onboarding is incomplete", async () => {
    notify("v2.core.account[configuration.merchant].capability_status_updated");
    mocks.retrieveAccount.mockResolvedValue(account({ transfers: "pending" }));

    const res = await post();

    expect(res.status).toBe(200);
    expect(mocks.organiser.updateMany).not.toHaveBeenCalled();
  });

  it("acknowledges a singleton related object without an account id", async () => {
    mocks.parseEventNotification.mockReturnValue({
      type: "v2.core.account[requirements].updated",
      related_object: { type: "v2.core.account", url: "" },
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(mocks.retrieveAccount).not.toHaveBeenCalled();
  });

  it("acknowledges event types it does not handle without calling Stripe", async () => {
    notify("v2.core.event_destination.ping");

    const res = await post();

    expect(res.status).toBe(200);
    expect(mocks.retrieveAccount).not.toHaveBeenCalled();
  });

  it("answers 500 so Stripe retries when the account cannot be read", async () => {
    notify("v2.core.account[requirements].updated");
    mocks.retrieveAccount.mockRejectedValue(new Error("Stripe down"));

    const res = await post();

    expect(res.status).toBe(500);
  });
});

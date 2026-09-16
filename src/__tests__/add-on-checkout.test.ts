import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Stage D checkout wiring: what happens between the athlete choosing extras and
 * the PaymentIntent being created.
 *
 * The rules being defended here are the ones that cost money when they break.
 * Checkout and the Stripe webhook price the same basket independently and must
 * land on the same cent, because the webhook cancels a paid order whose total it
 * cannot reproduce. So the basket is priced from the catalogue by id, the lines
 * travel as variant codes, and anything that cannot be priced or stocked is
 * refused here, before a card is touched.
 */

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  eventFindUnique: vi.fn(),
  registrationCount: vi.fn(),
  registrationGroupBy: vi.fn(),
  registrationFindMany: vi.fn(),
  registrationCreateMany: vi.fn(),
  userUpsert: vi.fn(),
  notificationCreate: vi.fn(),
  paymentIntentCreate: vi.fn(),
  variantFindMany: vi.fn(),
  addOnGroupBy: vi.fn(),
  addOnCreateMany: vi.fn(),
}));

const prismaMock = vi.hoisted(() => {
  const client = {
    event: { findUnique: mocks.eventFindUnique },
    registration: {
      count: mocks.registrationCount,
      groupBy: mocks.registrationGroupBy,
      findMany: mocks.registrationFindMany,
      createMany: mocks.registrationCreateMany,
    },
    user: { upsert: mocks.userUpsert },
    notification: { create: mocks.notificationCreate },
    eventAddOnVariant: { findMany: mocks.variantFindMany },
    registrationAddOn: { groupBy: mocks.addOnGroupBy, createMany: mocks.addOnCreateMany },
    $transaction: (fn: (tx: unknown) => unknown) => fn(client),
  };
  return client;
});

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/turnstile", () => ({ assertTurnstile: async () => null }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => null }));
vi.mock("@/lib/amplify-server", () => ({ getUserSession: async () => mocks.session() }));
vi.mock("@/lib/guest-email-verification", () => ({
  assertGuestEmailsVerifiedForCheckout: async () => null,
}));
vi.mock("@/lib/athlete-accounts", () => ({
  ensureAthleteCognitoUser: async () => "cognito-sub-1",
}));
vi.mock("@/lib/email", () => ({
  sendRegistrationConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ paymentIntents: { create: mocks.paymentIntentCreate } }),
}));

import { POST as checkout } from "@/app/api/checkout/route";
import { POST as registerFree } from "@/app/api/registrations/free/route";

const participant = (over: Record<string, unknown> = {}) => ({
  firstName: "Jordan",
  lastName: "Clarke",
  dateOfBirth: "1990-01-01",
  gender: "female",
  email: "jordan@example.com",
  mobile: "0400000000",
  emergencyContactName: "Sam Reed",
  emergencyContactPhone: "0400000001",
  medicalNotes: "",
  estimatedFinish: "",
  waiverAccepted: true,
  waveLabel: "General",
  ...over,
});

// $100.00 ticket. Athlete-pays, so the fee is 395 + 145 = 540 → 10540 charged.
const TICKET_CHARGED = 10540;
// $25.00 tee, percentage only: round(2500 * 0.0395) = 99 → 2599 charged.
const TEE_CHARGED = 2599;

const paidEvent = (over: Record<string, unknown> = {}) => ({
  id: "evt-1",
  title: "Apex Throwdown",
  status: "APPROVED",
  feeStructure: "athlete",
  registrationType: "startline",
  waves: [{ label: "General", price: "100.00" }],
  cap: null,
  eventDate: "2026-12-01",
  startTime: "07:00",
  venue: "MSAC",
  city: "Melbourne",
  state: "VIC",
  organiser: { id: "org-1", stripeAccountId: "acct_1", stripeOnboardingComplete: true },
  ...over,
});

/** The catalogue row shape catalogueVariantsForEvent reads. */
const teeVariant = {
  id: "v-tee-m",
  addOnId: "a-tee",
  code: "teem01",
  label: "M",
  addOn: { name: "Event tee", optionLabel: "Size", priceCents: 2500, imageUrl: null },
};

/** stockByVariant reads id + stock off the same table. */
const teeStock = (stock: number) => ({ id: "v-tee-m", stock });

/**
 * eventAddOnVariant.findMany serves three different reads in one request:
 * the catalogue, the buyable (active) check, and declared stock. They are
 * distinguished by the fields each selects.
 */
function serveCatalogue(opts: { stock: number; buyable?: boolean }) {
  mocks.variantFindMany.mockImplementation(async (args: Record<string, never>) => {
    const select = (args as { select?: Record<string, boolean> }).select ?? {};
    if (select.addOnId) return [teeVariant];
    if (select.stock) return [teeStock(opts.stock)];
    // The active/buyable probe selects id alone.
    return opts.buyable === false ? [] : [{ id: "v-tee-m" }];
  });
}

const post = (handler: (req: NextRequest) => Promise<Response>, path: string, body: unknown) =>
  handler(new NextRequest(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body) }));

const postCheckout = (body: unknown) => post(checkout, "/api/checkout", body);
const postFree = (body: unknown) => post(registerFree, "/api/registrations/free", body);

const order = (over: Record<string, unknown> = {}) => ({
  eventId: "evt-1",
  participants: [participant()],
  ...over,
});

const teeLine = { participantIndex: 0, variantId: "v-tee-m", quantity: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockReturnValue(null);
  mocks.registrationCount.mockResolvedValue(0);
  mocks.registrationGroupBy.mockResolvedValue([]);
  mocks.registrationFindMany.mockResolvedValue([]);
  mocks.registrationCreateMany.mockResolvedValue({ count: 1 });
  mocks.userUpsert.mockResolvedValue({ id: "user-1" });
  mocks.notificationCreate.mockResolvedValue({});
  mocks.addOnCreateMany.mockResolvedValue({ count: 1 });
  mocks.paymentIntentCreate.mockResolvedValue({ id: "pi_1", client_secret: "cs_1" });
  mocks.eventFindUnique.mockResolvedValue(paidEvent());
  // Nothing sold yet.
  mocks.addOnGroupBy.mockResolvedValue([]);
  serveCatalogue({ stock: 10 });
});

afterEach(() => {
  delete process.env.ADDONS_ENABLED;
});

describe("POST /api/checkout — paid add-ons", () => {
  it("charges the ticket plus the priced basket", async () => {
    const res = await postCheckout(order({ addOns: [teeLine] }));
    expect(res.status).toBe(200);

    const intent = mocks.paymentIntentCreate.mock.calls[0][0];
    expect(intent.amount).toBe(TICKET_CHARGED + TEE_CHARGED);
    // Startline's cut is the ticket fee plus the percentage-only add-on fee.
    expect(intent.application_fee_amount).toBe(540 + 99);

    const body = await res.json();
    expect(body.amount).toBe((TICKET_CHARGED + TEE_CHARGED) / 100);
    expect(body.addOnAmount).toBe(TEE_CHARGED / 100);
  });

  // Codes, not ids or positions: the organiser may reorder or retire the
  // catalogue while this payment is in flight.
  it("encodes the basket into metadata by variant code", async () => {
    await postCheckout(order({ addOns: [teeLine] }));

    const { metadata } = mocks.paymentIntentCreate.mock.calls[0][0];
    expect(metadata.addOnCount).toBe("1");
    expect(metadata.addOns0).toBe("0:teem01:1");
  });

  it("writes no add-on metadata for an order without extras", async () => {
    await postCheckout(order());

    const { metadata } = mocks.paymentIntentCreate.mock.calls[0][0];
    expect(metadata.addOnCount).toBeUndefined();
    expect(metadata.addOns0).toBeUndefined();
  });

  it("refuses a quantity beyond the per-line cap", async () => {
    // The schema caps a single line at MAX_ADDON_QUANTITY, so an over-cap
    // request is refused outright rather than silently clamped into a charge.
    const res = await postCheckout(
      order({ addOns: [{ ...teeLine, quantity: 99 }] }),
    );
    expect(res.status).toBe(400);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  // Duplicate lines are merged before the per-line cap is applied, or a client
  // could send the same line ten times and walk past the limit.
  it("merges duplicate lines and charges them once, at the merged quantity", async () => {
    await postCheckout(order({ addOns: [teeLine, teeLine, teeLine] }));

    const { metadata, amount } = mocks.paymentIntentCreate.mock.calls[0][0];
    expect(metadata.addOns0).toBe("0:teem01:3");
    // 3 x $25 = 7500, fee rounded once over the line: round(7500 * 0.0395) = 296.
    expect(amount).toBe(TICKET_CHARGED + 7500 + 296);
  });

  it("refuses a variant that is not in the catalogue", async () => {
    const res = await postCheckout(
      order({ addOns: [{ participantIndex: 0, variantId: "v-gone", quantity: 1 }] }),
    );

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/no longer available/i);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  // A retired product still prices a payment already in flight, but it cannot be
  // newly bought.
  it("refuses a variant the organiser has retired", async () => {
    serveCatalogue({ stock: 10, buyable: false });

    const res = await postCheckout(order({ addOns: [teeLine] }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/no longer on sale/i);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("refuses a basket that wants more than the remaining stock", async () => {
    serveCatalogue({ stock: 3 });
    mocks.addOnGroupBy.mockResolvedValue([{ variantId: "v-tee-m", _sum: { quantity: 2 } }]);

    const res = await postCheckout(order({ addOns: [{ ...teeLine, quantity: 2 }] }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Only 1 "Event tee - M" left/);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("refuses a sold-out variant by name", async () => {
    serveCatalogue({ stock: 1 });
    mocks.addOnGroupBy.mockResolvedValue([{ variantId: "v-tee-m", _sum: { quantity: 1 } }]);

    const res = await postCheckout(order({ addOns: [teeLine] }));

    expect((await res.json()).error).toMatch(/"Event tee - M" is sold out/);
  });

  // Stock is counted per variant, so a family buying the last two shirts twice
  // over has to be caught even though no single line exceeds the remainder.
  it("rolls a group basket up per variant before checking stock", async () => {
    serveCatalogue({ stock: 2 });

    const res = await postCheckout(
      order({
        participants: [participant(), participant({ email: "sam@example.com" })],
        addOns: [teeLine, { ...teeLine, participantIndex: 1, quantity: 2 }],
      }),
    );

    expect(res.status).toBe(409);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("refuses a line addressed to a participant the order does not have", async () => {
    const res = await postCheckout(order({ addOns: [{ ...teeLine, participantIndex: 4 }] }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid extras/i);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  // The kill switch stops new baskets being sold without disturbing anything
  // already bought.
  it("refuses a basket when add-ons are switched off", async () => {
    process.env.ADDONS_ENABLED = "false";

    const res = await postCheckout(order({ addOns: [teeLine] }));

    expect(res.status).toBe(503);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("still sells a plain ticket when add-ons are switched off", async () => {
    process.env.ADDONS_ENABLED = "false";

    const res = await postCheckout(order());

    expect(res.status).toBe(200);
    expect(mocks.paymentIntentCreate).toHaveBeenCalled();
  });
});

// Add-on money is part of the order total, which is what decides whether an
// order is free. That one fact routes these cases correctly with no special
// casing in either endpoint.
describe("free events carrying merchandise", () => {
  const freeEvent = () =>
    paidEvent({
      id: "evt-free",
      waves: [{ label: "General", price: "0" }],
      organiser: { id: "org-1", stripeAccountId: null, stripeOnboardingComplete: false },
    });

  it("turns a free entry with a paid extra into a payable order", async () => {
    mocks.eventFindUnique.mockResolvedValue(
      paidEvent({ id: "evt-free", waves: [{ label: "General", price: "0" }] }),
    );

    const res = await postCheckout(order({ eventId: "evt-free", addOns: [teeLine] }));

    expect(res.status).toBe(200);
    // The ticket is free, so the charge is the tee alone.
    expect(mocks.paymentIntentCreate.mock.calls[0][0].amount).toBe(TEE_CHARGED);
  });

  it("refuses to write that order through the free path", async () => {
    mocks.eventFindUnique.mockResolvedValue(
      paidEvent({ id: "evt-free", waves: [{ label: "General", price: "0" }] }),
    );

    const res = await postFree(order({ eventId: "evt-free", addOns: [teeLine] }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not free/i);
    expect(mocks.registrationCreateMany).not.toHaveBeenCalled();
  });

  // An extra priced at nothing keeps the order free, so it is honoured rather
  // than silently dropped.
  it("writes a free extra on a free entry", async () => {
    mocks.eventFindUnique.mockResolvedValue(freeEvent());
    mocks.variantFindMany.mockImplementation(async (args: Record<string, never>) => {
      const select = (args as { select?: Record<string, boolean> }).select ?? {};
      if (select.addOnId) {
        return [{ ...teeVariant, addOn: { ...teeVariant.addOn, priceCents: 0 } }];
      }
      if (select.stock) return [teeStock(10)];
      return [{ id: "v-tee-m" }];
    });

    const res = await postFree(order({ eventId: "evt-free", addOns: [teeLine] }));

    expect(res.status).toBe(200);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();

    expect(mocks.addOnCreateMany).toHaveBeenCalledTimes(1);
    expect(mocks.addOnCreateMany.mock.calls[0][0].data[0]).toMatchObject({
      variantId: "v-tee-m",
      quantity: 1,
      amountCents: 0,
      platformFeeCents: 0,
      status: "PURCHASED",
    });
  });
});

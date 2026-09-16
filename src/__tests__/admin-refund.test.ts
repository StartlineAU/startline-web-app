import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Covers the wiring, not just the helper: the unit tests in stripe-refunds.test.ts
// prove buildRefundParams produces the right object, and these prove the route
// hands that object to Stripe with facts read off the real charge. A regression
// to `stripe.refunds.create({ charge })` would pass the former and fail these.

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  registration: { findUnique: vi.fn(), update: vi.fn() },
  userNotification: { create: vi.fn() },
  retrievePaymentIntent: vi.fn(),
  createRefund: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({ getAdminSession: mocks.getAdminSession }));

vi.mock("@/lib/prisma", () => ({
  default: {
    registration: mocks.registration,
    userNotification: mocks.userNotification,
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    paymentIntents: { retrieve: mocks.retrievePaymentIntent },
    refunds: { create: mocks.createRefund },
  }),
}));

vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { POST } from "@/app/api/admin/registrations/[id]/refund/route";

// $100.00 ticket + athlete-borne fee (395 + 145 = 540) → charged 10540.
const confirmedRegistration = {
  id: "reg-1",
  status: "REFUND_REQUESTED",
  amountCents: 10000,
  platformFeeCents: 540,
  feeStructure: "athlete",
  refundAmountCents: 10540,
  refundPercent: 100,
  stripePaymentIntentId: "pi_1",
  athleteName: "Jordan Clarke",
  userId: "user-1",
  event: { id: "event-1", title: "Apex Throwdown" },
};

/** A destination charge: money already transferred to the organiser. */
const destinationCharge = {
  id: "ch_1",
  transfer: "tr_1",
  application_fee: "fee_1",
};

function refund(): Promise<Response> {
  const req = new NextRequest("http://localhost/api/admin/registrations/reg-1/refund", {
    method: "POST",
  });
  return POST(req, { params: Promise.resolve({ id: "reg-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminSession.mockResolvedValue({ sub: "admin-1" });
  mocks.registration.findUnique.mockResolvedValue(confirmedRegistration);
  mocks.registration.update.mockResolvedValue({});
  mocks.userNotification.create.mockResolvedValue({});
  mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: destinationCharge });
  mocks.createRefund.mockResolvedValue({ id: "re_1" });
});

describe("admin refund route", () => {
  it("expands the charge so the transfer and application fee can be read", async () => {
    await refund();
    expect(mocks.retrievePaymentIntent).toHaveBeenCalledWith("pi_1", {
      expand: ["latest_charge"],
    });
  });

  // The two money bugs, asserted at the boundary that actually moves funds.
  it("reverses the transfer and sends an explicit amount on a destination charge", async () => {
    const res = await refund();
    expect(res.status).toBe(200);

    const [params, options] = mocks.createRefund.mock.calls[0];
    expect(params).toMatchObject({
      charge: "ch_1",
      amount: 10540,
      reverse_transfer: true,
      refund_application_fee: false,
    });
    expect(options).toEqual({ idempotencyKey: "entry-refund-reg-1" });
  });

  // Checkout omits transfer_data when STRIPE_DEV_DIRECT_CHARGE is set or the
  // organiser has no connected account. Reversing a transfer that is not there
  // fails the whole refund, so a working refund must not become a broken one.
  it("omits both Connect flags on a charge that has neither", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({
      latest_charge: { id: "ch_2", transfer: null, application_fee: null },
    });

    const res = await refund();
    expect(res.status).toBe(200);

    const [params] = mocks.createRefund.mock.calls[0];
    expect(params).not.toHaveProperty("reverse_transfer");
    expect(params).not.toHaveProperty("refund_application_fee");
    expect(params.amount).toBe(10540);
  });

  // The fee is stored on every registration, but only the athlete-pays structure
  // actually charged it. Refunding it back under organiser-pays would hand over
  // money the charge never collected.
  it("refunds the ticket price only when the organiser absorbed the fee", async () => {
    mocks.registration.findUnique.mockResolvedValue({
      ...confirmedRegistration,
      feeStructure: "organiser",
    });

    await refund();

    const [params] = mocks.createRefund.mock.calls[0];
    expect(params.amount).toBe(10000);
  });

  it("refuses without touching Stripe when the policy owes nothing", async () => {
    mocks.registration.findUnique.mockResolvedValue({
      ...confirmedRegistration,
      refundAmountCents: 0,
    });

    const res = await refund();
    expect(res.status).toBe(409);
    expect(mocks.createRefund).not.toHaveBeenCalled();
    expect(mocks.registration.update).not.toHaveBeenCalled();
  });

  it("refuses rather than guessing when the charge could not be expanded", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: "ch_unexpanded" });

    const res = await refund();
    expect(res.status).toBe(502);
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("returns 422 when the payment intent has no charge at all", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: null });

    const res = await refund();
    expect(res.status).toBe(422);
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  // A free or externally-registered entry has no payment to reverse.
  it("flips the status without calling Stripe when there is no payment intent", async () => {
    mocks.registration.findUnique.mockResolvedValue({
      ...confirmedRegistration,
      stripePaymentIntentId: null,
    });

    const res = await refund();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ method: "free" });
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("rejects a registration that is not refundable", async () => {
    mocks.registration.findUnique.mockResolvedValue({
      ...confirmedRegistration,
      status: "REFUNDED",
    });

    const res = await refund();
    expect(res.status).toBe(409);
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("requires an admin session", async () => {
    mocks.getAdminSession.mockResolvedValue(null);

    const res = await refund();
    expect(res.status).toBe(401);
    expect(mocks.registration.findUnique).not.toHaveBeenCalled();
  });
});

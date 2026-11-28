import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  registration: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  paymentAdjustment: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  userNotification: { create: vi.fn() },
  refundsList: vi.fn(),
  chargesRetrieve: vi.fn(),
  sendAlert: vi.fn(),
  recipients: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    registration: mocks.registration,
    paymentAdjustment: mocks.paymentAdjustment,
    $executeRaw: vi.fn(async () => 0),
  };
  return {
    default: {
      registration: mocks.registration,
      paymentAdjustment: mocks.paymentAdjustment,
      userNotification: mocks.userNotification,
      $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
    },
  };
});

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    refunds: { list: mocks.refundsList },
    charges: { retrieve: mocks.chargesRetrieve },
  }),
}));

vi.mock("@/lib/email", () => ({ sendPaymentAdjustmentEmails: mocks.sendAlert }));
vi.mock("@/lib/admin-notification-recipients", () => ({ listAdminReviewRecipients: mocks.recipients }));

import { allocateRefund, syncChargeRefunds, syncDispute, type AllocatableEntry } from "@/lib/payment-adjustments";

// $100 ticket + $5.40 booking fee paid by the athlete = 10540.
const entry = (id: string, overrides: Partial<AllocatableEntry & { userId: string | null }> = {}) => ({
  id,
  status: "CONFIRMED",
  amountCents: 10000,
  platformFeeCents: 540,
  feeStructure: "athlete",
  refundAmountCents: null,
  userId: `user-${id}`,
  ...overrides,
});

const event = (overrides: Record<string, unknown> = {}) => ({
  id: "event-1",
  title: "Apex Throwdown",
  payoutTriggered: false,
  payoutOperation: null,
  organiser: { orgName: "Apex" },
  ...overrides,
});

const charge = (overrides: Partial<Stripe.Charge> = {}) =>
  ({ id: "ch_1", payment_intent: "pi_1", refunded: false, ...overrides }) as Stripe.Charge;

const refund = (id: string, amount: number, metadata: Record<string, string> = {}) =>
  ({ id, amount, status: "succeeded", created: 1, metadata }) as unknown as Stripe.Refund;

const dispute = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "du_1",
    amount: 10540,
    status: "needs_response",
    reason: "fraudulent",
    payment_intent: "pi_1",
    charge: "ch_1",
    balance_transactions: [{ fee: 2500 }],
    ...overrides,
  }) as unknown as Stripe.Dispute;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.registration.findFirst.mockImplementation(async (args: { where: Record<string, unknown> }) =>
    "stripePaymentIntentId" in args.where ? { event: event() } : null,
  );
  mocks.registration.updateMany.mockResolvedValue({ count: 1 });
  mocks.paymentAdjustment.findUnique.mockResolvedValue(null);
  mocks.recipients.mockResolvedValue(["admin@startline.test"]);
});

describe("allocateRefund", () => {
  it("takes every open entry when the whole charge is refunded", () => {
    const result = allocateRefund([entry("a"), entry("b")], 5000, { wholeCharge: true });
    expect([...result.entries]).toEqual([["a", 10540], ["b", 10540]]);
    expect(result.unallocatedCents).toBe(0);
  });

  it("takes every open entry when the amount is what they paid together", () => {
    const result = allocateRefund([entry("a"), entry("b")], 21080, { wholeCharge: false });
    expect(result.entries.size).toBe(2);
  });

  it("gives a part refund on a single-entry payment to that entry", () => {
    const result = allocateRefund([entry("a")], 5000, { wholeCharge: false });
    expect([...result.entries]).toEqual([["a", 5000]]);
  });

  it("matches the entry whose quoted refund was paid by hand", () => {
    const result = allocateRefund(
      [entry("a"), entry("b", { status: "REFUND_REQUESTED", refundAmountCents: 5000 })],
      5000,
      { wholeCharge: false },
    );
    expect([...result.entries]).toEqual([["b", 5000]]);
  });

  it("matches the one entry whose price is the refunded amount", () => {
    const result = allocateRefund(
      [entry("a"), entry("b", { amountCents: 5000, platformFeeCents: 340 })],
      5340,
      { wholeCharge: false },
    );
    expect([...result.entries]).toEqual([["b", 5340]]);
  });

  it("does not guess between identical tickets", () => {
    const result = allocateRefund([entry("a"), entry("b"), entry("c")], 10540, { wholeCharge: false });
    expect(result.entries.size).toBe(0);
    expect(result.unallocatedCents).toBe(10540);
  });

  it("ignores entries that are already refunded or cancelled", () => {
    const result = allocateRefund(
      [entry("a", { status: "REFUNDED" }), entry("b", { status: "CANCELLED" }), entry("c")],
      10540,
      { wholeCharge: false },
    );
    expect([...result.entries]).toEqual([["c", 10540]]);
  });
});

describe("syncChargeRefunds", () => {
  it("records a dashboard refund and takes the entry out of the payout", async () => {
    mocks.refundsList.mockResolvedValue({ data: [refund("re_dash", 5000)] });
    mocks.registration.findMany.mockResolvedValue([entry("a")]);

    await syncChargeRefunds(charge());

    expect(mocks.registration.updateMany).toHaveBeenCalledWith({
      where: { id: "a", status: { in: ["CONFIRMED", "REFUND_REQUESTED"] } },
      data: { status: "REFUNDED", refundAmountCents: 5000, stripeRefundId: "re_dash" },
    });
    expect(mocks.paymentAdjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stripeObjectId: "re_dash", kind: "REFUND", eventId: "event-1", amountCents: 5000, unallocatedCents: 0,
      }),
    });
    expect(mocks.userNotification.create).toHaveBeenCalledTimes(1);
    // Matched cleanly before payout: nothing for an admin to do.
    expect(mocks.sendAlert).not.toHaveBeenCalled();
  });

  it("skips refunds Startline issued itself", async () => {
    mocks.refundsList.mockResolvedValue({
      data: [
        refund("re_1", 5000, { reason: "entry_refund" }),
        refund("re_2", 10540, { reason: "event_cancelled" }),
        refund("re_3", 10540, { reason: "registration_refused" }),
      ],
    });

    await syncChargeRefunds(charge());

    expect(mocks.paymentAdjustment.create).not.toHaveBeenCalled();
    expect(mocks.registration.updateMany).not.toHaveBeenCalled();
  });

  it("skips an older Startline refund it finds recorded on an entry", async () => {
    mocks.refundsList.mockResolvedValue({ data: [refund("re_old", 5000)] });
    mocks.registration.findFirst.mockImplementation(async (args: { where: Record<string, unknown> }) =>
      "stripePaymentIntentId" in args.where ? { event: event() } : { id: "a" },
    );

    await syncChargeRefunds(charge());

    expect(mocks.paymentAdjustment.create).not.toHaveBeenCalled();
  });

  it("is a no-op for a refund it has already recorded", async () => {
    mocks.refundsList.mockResolvedValue({ data: [refund("re_dash", 5000)] });
    mocks.paymentAdjustment.findUnique.mockResolvedValue({ id: "adj-1" });

    await syncChargeRefunds(charge());

    expect(mocks.paymentAdjustment.create).not.toHaveBeenCalled();
    expect(mocks.registration.updateMany).not.toHaveBeenCalled();
  });

  it("ignores a charge that is not a registration payment", async () => {
    mocks.registration.findFirst.mockResolvedValue(null);

    await syncChargeRefunds(charge());

    expect(mocks.refundsList).not.toHaveBeenCalled();
  });

  it("keeps an unmatched amount off the payout and tells the admins", async () => {
    mocks.refundsList.mockResolvedValue({ data: [refund("re_dash", 10540)] });
    mocks.registration.findMany.mockResolvedValue([entry("a"), entry("b"), entry("c")]);

    await syncChargeRefunds(charge());

    expect(mocks.registration.updateMany).not.toHaveBeenCalled();
    expect(mocks.paymentAdjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ unallocatedCents: 10540 }),
    });
    expect(mocks.sendAlert).toHaveBeenCalledWith(
      ["admin@startline.test"],
      expect.objectContaining({ heading: "Refund issued in Stripe" }),
    );
  });

  it("clears earlier unmatched amounts once the whole charge is refunded", async () => {
    mocks.refundsList.mockResolvedValue({ data: [refund("re_last", 21080)] });
    mocks.registration.findMany.mockResolvedValue([entry("a"), entry("b")]);

    await syncChargeRefunds(charge({ refunded: true }));

    expect(mocks.paymentAdjustment.updateMany).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: "pi_1", kind: "REFUND" },
      data: { unallocatedCents: 0 },
    });
    expect(mocks.registration.updateMany).toHaveBeenCalledTimes(2);
  });

  it("flags a refund that arrives after the payout", async () => {
    mocks.registration.findFirst.mockImplementation(async (args: { where: Record<string, unknown> }) =>
      "stripePaymentIntentId" in args.where ? { event: event({ payoutTriggered: true }) } : null,
    );
    mocks.refundsList.mockResolvedValue({ data: [refund("re_dash", 5000)] });
    mocks.registration.findMany.mockResolvedValue([entry("a")]);

    await syncChargeRefunds(charge());

    expect(mocks.paymentAdjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ afterPayout: true }),
    });
    expect(mocks.sendAlert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: "Refund after payout." }),
    );
  });
});

describe("syncDispute", () => {
  it("records an open dispute, which holds the payout, and alerts the admins", async () => {
    await syncDispute(dispute());

    expect(mocks.paymentAdjustment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeObjectId: "du_1" },
        create: expect.objectContaining({ kind: "DISPUTE", disputeStatus: "OPEN", eventId: "event-1" }),
      }),
    );
    expect(mocks.registration.updateMany).not.toHaveBeenCalled();
    expect(mocks.sendAlert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ heading: "Card dispute opened" }),
    );
  });

  it("on a lost dispute removes the entries and records the fee", async () => {
    mocks.paymentAdjustment.findUnique.mockResolvedValue({ disputeStatus: "OPEN" });
    mocks.registration.findMany.mockResolvedValue([entry("a")]);

    await syncDispute(dispute({ status: "lost" }));

    expect(mocks.registration.updateMany).toHaveBeenCalledWith({
      where: { id: "a", status: { in: ["CONFIRMED", "REFUND_REQUESTED"] } },
      data: { status: "REFUNDED", refundAmountCents: 10540 },
    });
    expect(mocks.paymentAdjustment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ disputeStatus: "LOST", feeCents: 2500, unallocatedCents: 0 }),
      }),
    );
  });

  it("on a won dispute lifts the hold and keeps the entry", async () => {
    mocks.paymentAdjustment.findUnique.mockResolvedValue({ disputeStatus: "OPEN" });

    await syncDispute(dispute({ status: "won", balance_transactions: [{ fee: 2500 }, { fee: -2500 }] }));

    expect(mocks.registration.updateMany).not.toHaveBeenCalled();
    expect(mocks.paymentAdjustment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ disputeStatus: "WON", feeCents: 0 }) }),
    );
  });

  it("changes nothing when a closed dispute is delivered again", async () => {
    mocks.paymentAdjustment.findUnique.mockResolvedValue({ disputeStatus: "LOST" });

    await syncDispute(dispute({ status: "lost" }));

    expect(mocks.paymentAdjustment.upsert).not.toHaveBeenCalled();
    expect(mocks.sendAlert).not.toHaveBeenCalled();
  });

  it("finds the payment through the charge when the dispute does not name it", async () => {
    mocks.chargesRetrieve.mockResolvedValue({ payment_intent: "pi_1" });

    await syncDispute(dispute({ payment_intent: null }));

    expect(mocks.chargesRetrieve).toHaveBeenCalledWith("ch_1");
    expect(mocks.paymentAdjustment.upsert).toHaveBeenCalled();
  });

  it("does not fail the delivery when the admin alert fails", async () => {
    mocks.sendAlert.mockRejectedValue(new Error("Resend down"));

    await expect(syncDispute(dispute())).resolves.toBeUndefined();
  });
});

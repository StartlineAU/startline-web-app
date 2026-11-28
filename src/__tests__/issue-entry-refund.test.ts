import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  registrationUpdate: vi.fn(),
  notificationCreate: vi.fn(),
  retrievePaymentIntent: vi.fn(),
  createRefund: vi.fn(),
  listRefunds: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    registration: { updateMany: mocks.registrationUpdate },
    userNotification: { create: mocks.notificationCreate },
  },
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    paymentIntents: { retrieve: mocks.retrievePaymentIntent },
    refunds: { create: mocks.createRefund, list: mocks.listRefunds },
  }),
}));

import { issueEntryRefund, RefundError } from "@/lib/issue-entry-refund";
import { eventPayoutCents } from "@/lib/payout";

// $100 ticket, $5.40 booking fee paid by the athlete on top.
const entry = {
  id: "reg-1",
  status: "REFUND_REQUESTED",
  amountCents: 10000,
  platformFeeCents: 540,
  feeStructure: "athlete",
  refundAmountCents: 10540,
  stripePaymentIntentId: "pi_1",
  athleteName: "Harper Jones",
  userId: "user-1",
  eventId: "evt-1",
  event: { id: "evt-1", title: "Harbour 10K" },
};

const charge = (hasTransfer: boolean) => ({
  id: "ch_1",
  transfer: hasTransfer ? "tr_1" : null,
  application_fee: hasTransfer ? "fee_1" : null,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.createRefund.mockResolvedValue({ id: "re_1" });
  mocks.listRefunds.mockResolvedValue({ data: [] });
  mocks.notificationCreate.mockResolvedValue({});
  mocks.registrationUpdate.mockResolvedValue({ count: 1 });
});

describe("issueEntryRefund — the reviewed policy refund", () => {
  it("reuses a refund an earlier attempt already made, at the amount Stripe holds", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: charge(true) });
    // A $50 refund reached Stripe, then the process died before recording it.
    // The entry has since been re-approved as a full refund.
    mocks.listRefunds.mockResolvedValue({
      data: [
        { id: "re_other", amount: 999, status: "succeeded", metadata: { registrationId: "reg-9", reason: "entry_refund" } },
        { id: "re_failed", amount: 5000, status: "failed", metadata: { registrationId: "reg-1", reason: "entry_refund" } },
        { id: "re_early", amount: 5000, status: "succeeded", metadata: { registrationId: "reg-1", reason: "entry_refund" } },
      ],
    });

    const result = await issueEntryRefund(entry);

    expect(mocks.listRefunds).toHaveBeenCalledWith({ payment_intent: "pi_1", limit: 100 });
    expect(mocks.createRefund).not.toHaveBeenCalled();
    expect(result).toEqual({ method: "stripe", refundId: "re_early", refundCents: 5000 });
    expect(mocks.registrationUpdate.mock.calls[0][0].data).toMatchObject({
      status: "REFUNDED",
      stripeRefundId: "re_early",
      refundAmountCents: 5000,
    });
  });

  it("refunds the frozen amount, reverses the transfer and keeps the booking fee", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: charge(true) });

    const result = await issueEntryRefund(entry);

    expect(mocks.createRefund.mock.calls[0][0]).toEqual({
      charge: "ch_1", amount: 10540, reverse_transfer: true, refund_application_fee: false,
      metadata: { registrationId: "reg-1", reason: "entry_refund" },
    });
    expect(mocks.createRefund.mock.calls[0][1]).toEqual({ idempotencyKey: "entry-refund-reg-1-10540" });
    expect(mocks.registrationUpdate.mock.calls[0][0].data).toMatchObject({
      status: "REFUNDED", stripeRefundId: "re_1", refundAmountCents: 10540,
    });
    expect(result).toEqual({ method: "stripe", refundId: "re_1", refundCents: 10540 });
  });

  it("writes the caller's final status and extra columns with the refund, without its own notice (#571)", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: charge(true) });

    await issueEntryRefund(entry, {
      finalStatus: "REMOVED",
      extraData: { bibNumber: null, startWaveId: null, startWaveLabel: null },
      notify: false,
    });

    expect(mocks.registrationUpdate.mock.calls[0][0].data).toEqual({
      bibNumber: null, startWaveId: null, startWaveLabel: null,
      status: "REMOVED", stripeRefundId: "re_1", refundAmountCents: 10540,
    });
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });

  it("omits both transfer flags on a direct charge", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: charge(false) });

    await issueEntryRefund(entry);

    expect(mocks.createRefund.mock.calls[0][0]).toEqual({
      charge: "ch_1", amount: 10540,
      metadata: { registrationId: "reg-1", reason: "entry_refund" },
    });
  });

  it("refuses an outside-policy request", async () => {
    await expect(issueEntryRefund({ ...entry, refundAmountCents: 0 })).rejects.toBeInstanceOf(RefundError);
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("releases a free entry without touching Stripe", async () => {
    const result = await issueEntryRefund({
      ...entry, stripePaymentIntentId: null, amountCents: 0, platformFeeCents: 0, refundAmountCents: 0,
    });

    expect(mocks.createRefund).not.toHaveBeenCalled();
    expect(mocks.registrationUpdate.mock.calls[0][0].data).toEqual({ status: "REFUNDED" });
    expect(result.method).toBe("free");
  });

  it("moves the row only from a refundable status", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: charge(true) });

    await issueEntryRefund(entry);

    expect(mocks.registrationUpdate.mock.calls[0][0].where).toEqual({
      id: "reg-1", status: { in: ["CONFIRMED", "REFUND_REQUESTED"] },
    });
  });

  it("does not notify twice when a concurrent refund already recorded the entry", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: charge(true) });
    mocks.registrationUpdate.mockResolvedValue({ count: 0 });

    const result = await issueEntryRefund(entry);

    expect(result).toEqual({ method: "stripe", refundId: "re_1", refundCents: 10540 });
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });

  it("refuses to release a free entry whose status changed meanwhile", async () => {
    mocks.registrationUpdate.mockResolvedValue({ count: 0 });

    await expect(issueEntryRefund({
      ...entry, stripePaymentIntentId: null, amountCents: 0, platformFeeCents: 0, refundAmountCents: 0,
    })).rejects.toMatchObject({ status: 409, code: "STALE" });
  });

  it("only refunds a confirmed or refund-requested entry", async () => {
    await expect(issueEntryRefund({ ...entry, status: "CANCELLED" })).rejects.toBeInstanceOf(RefundError);
  });
});

describe("payout", () => {
  const confirmed = {
    amountCents: 10000, platformFeeCents: 540, stripeFeeCents: 0, feeStructure: "athlete", status: "CONFIRMED",
  };

  it("pays out confirmed entries only", () => {
    expect(eventPayoutCents([confirmed])).toBe(10000);
  });

  it("leaves a refunded entry out of the payout", () => {
    expect(eventPayoutCents([confirmed, { ...confirmed, status: "REFUNDED" }])).toBe(10000);
  });
});

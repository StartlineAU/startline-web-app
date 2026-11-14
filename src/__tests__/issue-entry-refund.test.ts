import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  registrationUpdate: vi.fn(),
  notificationCreate: vi.fn(),
  retrievePaymentIntent: vi.fn(),
  createRefund: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    registration: { update: mocks.registrationUpdate },
    userNotification: { create: mocks.notificationCreate },
  },
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    paymentIntents: { retrieve: mocks.retrievePaymentIntent },
    refunds: { create: mocks.createRefund },
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
  mocks.notificationCreate.mockResolvedValue({});
  mocks.registrationUpdate.mockResolvedValue({});
});

describe("issueEntryRefund — the reviewed policy refund", () => {
  it("refunds the frozen amount, reverses the transfer and keeps the booking fee", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: charge(true) });

    const result = await issueEntryRefund(entry);

    expect(mocks.createRefund.mock.calls[0][0]).toEqual({
      charge: "ch_1", amount: 10540, reverse_transfer: true, refund_application_fee: false,
    });
    expect(mocks.createRefund.mock.calls[0][1]).toEqual({ idempotencyKey: "entry-refund-reg-1" });
    expect(mocks.registrationUpdate.mock.calls[0][0].data).toMatchObject({
      status: "REFUNDED", stripeRefundId: "re_1", refundAmountCents: 10540,
    });
    expect(result).toEqual({ method: "stripe", refundId: "re_1", refundCents: 10540 });
  });

  it("omits both transfer flags on a direct charge", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: charge(false) });

    await issueEntryRefund(entry);

    expect(mocks.createRefund.mock.calls[0][0]).toEqual({ charge: "ch_1", amount: 10540 });
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

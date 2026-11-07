import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  registrationUpdate: vi.fn(),
  registrationFindUnique: vi.fn(),
  registrationFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  retrievePaymentIntent: vi.fn(),
  createRefund: vi.fn(),
  createReversal: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    registration: {
      update: mocks.registrationUpdate,
      findUnique: mocks.registrationFindUnique,
      findMany: mocks.registrationFindMany,
    },
    userNotification: { create: mocks.notificationCreate },
  },
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    paymentIntents: { retrieve: mocks.retrievePaymentIntent },
    refunds: { create: mocks.createRefund },
    transfers: { createReversal: mocks.createReversal },
  }),
}));

import { issueEntryRefund, RefundError } from "@/lib/issue-entry-refund";
import {
  buildFullRefundParams,
  fullRefundPayoutDeductionCents,
} from "@/lib/stripe-refunds";
import { eventPayoutCents } from "@/lib/payout";

// $100 ticket, $5.40 booking fee paid by the athlete on top.
const entry = {
  id: "reg-1",
  status: "REFUND_REQUESTED",
  amountCents: 10000,
  platformFeeCents: 540,
  feeStructure: "athlete",
  refundAmountCents: 10540,
  refundType: "FULL" as const,
  stripePaymentIntentId: "pi_1",
  athleteName: "Harper Jones",
  userId: "user-1",
  eventId: "evt-1",
  event: { id: "evt-1", title: "Harbour 10K" },
};

const transfer = (id: string, amount: number, reversed = 0) => ({ id, amount, amount_reversed: reversed });
const charge = (t: ReturnType<typeof transfer> | null) => ({
  id: "ch_1",
  transfer: t,
  application_fee: t ? "fee_1" : null,
});

let owed = 0;
let recovered = 0;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  owed = 0;
  recovered = 0;
  mocks.createRefund.mockResolvedValue({ id: "re_1" });
  mocks.createReversal.mockResolvedValue({ id: "trr_1" });
  mocks.notificationCreate.mockResolvedValue({});
  mocks.registrationFindMany.mockResolvedValue([]);
  // A tiny in-memory registration so recovery sees what the refund wrote.
  mocks.registrationUpdate.mockImplementation(async ({ data }: { data: Record<string, number> }) => {
    if (data.organiserRecoveryOwedCents !== undefined) owed = data.organiserRecoveryOwedCents;
    if (data.organiserRecoveredCents !== undefined) recovered = data.organiserRecoveredCents;
    return {};
  });
  mocks.registrationFindUnique.mockImplementation(async () => ({
    id: "reg-1", eventId: "evt-1", stripePaymentIntentId: "pi_1",
    organiserRecoveryOwedCents: owed, organiserRecoveredCents: recovered,
  }));
});

describe("buildFullRefundParams", () => {
  it("refunds the exact amount, keeps the application fee and moves no transfer", () => {
    const [params, options] = buildFullRefundParams({
      chargeId: "ch_1", amountCents: 10540, idempotencyKey: "k", hasApplicationFee: true,
    });
    expect(params).toEqual({
      charge: "ch_1", amount: 10540, refund_application_fee: false, metadata: { refund_type: "full" },
    });
    expect(params).not.toHaveProperty("reverse_transfer");
    expect(options).toEqual({ idempotencyKey: "k" });
  });

  it("refuses a zero or fractional amount rather than refunding the whole charge", () => {
    expect(() => buildFullRefundParams({ chargeId: "c", amountCents: 0, idempotencyKey: "k", hasApplicationFee: false })).toThrow();
    expect(() => buildFullRefundParams({ chargeId: "c", amountCents: 1.5, idempotencyKey: "k", hasApplicationFee: false })).toThrow();
  });
});

describe("issueEntryRefund — FULL", () => {
  it("returns everything the athlete paid and recovers it all from the organiser's transfer", async () => {
    // Group booking: the transfer covers two entries, so it has room for the fee too.
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: charge(transfer("tr_1", 20000)) });

    const result = await issueEntryRefund(entry, "FULL");

    expect(mocks.createRefund.mock.calls[0][0]).toMatchObject({ charge: "ch_1", amount: 10540, refund_application_fee: false });
    expect(mocks.createRefund.mock.calls[0][1]).toEqual({ idempotencyKey: "entry-full-refund-reg-1" });
    expect(mocks.createReversal).toHaveBeenCalledWith(
      "tr_1",
      expect.objectContaining({ amount: 10540 }),
      { idempotencyKey: "full-refund-recovery-reg-1-0" },
    );
    expect(mocks.registrationUpdate.mock.calls[0][0].data).toMatchObject({
      status: "REFUNDED", refundType: "FULL", stripeRefundId: "re_1", organiserRecoveryOwedCents: 10540,
    });
    expect(result).toMatchObject({ refundCents: 10540, recoveryOutstandingCents: 0 });
  });

  it("takes the fee from another of the event's transfers when the entry's own runs out", async () => {
    mocks.retrievePaymentIntent.mockImplementation(async (pi: string) =>
      pi === "pi_1"
        ? { latest_charge: charge(transfer("tr_1", 10000)) }
        : { latest_charge: charge(transfer("tr_2", 10000)) },
    );
    mocks.registrationFindMany.mockResolvedValue([{ stripePaymentIntentId: "pi_2" }]);

    const result = await issueEntryRefund(entry, "FULL");

    expect(mocks.createReversal.mock.calls.map((c) => [c[0], c[1].amount, c[2].idempotencyKey])).toEqual([
      ["tr_1", 10000, "full-refund-recovery-reg-1-0"],
      ["tr_2", 540, "full-refund-recovery-reg-1-10000"],
    ]);
    expect(result.recoveryOutstandingCents).toBe(0);
  });

  it("leaves what it cannot recover on record instead of failing the athlete's refund", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: charge(transfer("tr_1", 10000)) });

    const result = await issueEntryRefund(entry, "FULL");

    expect(mocks.createRefund).toHaveBeenCalled();
    expect(result.recoveryOutstandingCents).toBe(540);
  });

  it("owes nothing on a direct charge, where the organiser received nothing", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: charge(null) });

    const result = await issueEntryRefund(entry, "FULL");

    expect(mocks.createRefund.mock.calls[0][0]).not.toHaveProperty("refund_application_fee");
    expect(mocks.createReversal).not.toHaveBeenCalled();
    expect(result.recoveryOutstandingCents).toBe(0);
  });

  it("refunds only the ticket price when the organiser absorbed the fee", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: charge(transfer("tr_1", 9460)) });

    await issueEntryRefund({ ...entry, feeStructure: "organiser", refundAmountCents: 10000 }, "FULL");

    expect(mocks.createRefund.mock.calls[0][0].amount).toBe(10000);
  });
});

describe("issueEntryRefund — NORMAL is unchanged", () => {
  it("still reverses the transfer proportionally and keeps the fee", async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: charge(transfer("tr_1", 10000)) });

    await issueEntryRefund({ ...entry, refundType: "NORMAL", refundAmountCents: 5270 }, "NORMAL");

    expect(mocks.createRefund.mock.calls[0][0]).toEqual({
      charge: "ch_1", amount: 5270, reverse_transfer: true, refund_application_fee: false,
    });
    expect(mocks.createReversal).not.toHaveBeenCalled();
  });

  it("refuses an outside-policy request", async () => {
    await expect(
      issueEntryRefund({ ...entry, refundType: "NORMAL", refundAmountCents: 0 }, "NORMAL"),
    ).rejects.toBeInstanceOf(RefundError);
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });
});

describe("payout after a FULL refund", () => {
  const confirmed = { amountCents: 10000, platformFeeCents: 540, feeStructure: "athlete", status: "CONFIRMED" };

  it("takes the booking fee the organiser bears off the payout", () => {
    expect(fullRefundPayoutDeductionCents({
      organiserRecoveryOwedCents: 10540, amountCents: 10000, platformFeeCents: 540, feeStructure: "athlete",
    })).toBe(540);

    const net = eventPayoutCents([
      confirmed,
      { ...confirmed, status: "REFUNDED", refundType: "FULL", organiserRecoveryOwedCents: 10540 },
    ]);
    expect(net).toBe(10000 - 540);
  });

  it("deducts the same whether the organiser absorbed the fee or not", () => {
    const net = eventPayoutCents([
      confirmed,
      { amountCents: 10000, platformFeeCents: 540, feeStructure: "organiser", status: "REFUNDED", refundType: "FULL", organiserRecoveryOwedCents: 10000 },
    ]);
    expect(net).toBe(10000 - 540);
  });

  it("deducts nothing for a direct charge and never goes below zero", () => {
    expect(eventPayoutCents([
      confirmed,
      { ...confirmed, status: "REFUNDED", refundType: "FULL", organiserRecoveryOwedCents: 0 },
    ])).toBe(10000);
    expect(eventPayoutCents([
      { ...confirmed, status: "REFUNDED", refundType: "FULL", organiserRecoveryOwedCents: 10540 },
    ])).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  entryRefundAmountCents,
  entryPaidCents,
  isOutsidePolicyRefund,
  buildRefundParams,
  REFUND_APPLICATION_FEE,
} from "@/lib/stripe-refunds";

// Two pre-existing bugs on what are normally Connect destination charges: every
// refund omitted reverse_transfer, so Startline covered it out of its own
// balance, and a full refund sent no amount, which returns the whole charge.

const athletePays = {
  amountCents: 10000,
  platformFeeCents: 540,
  feeStructure: "athlete",
  refundAmountCents: null as number | null,
};

describe("entryPaidCents", () => {
  it("includes the booking fee when the athlete was charged it on top", () => {
    expect(entryPaidCents(athletePays)).toBe(10540);
  });

  // platformFeeCents is written onto every registration regardless of who bears
  // it, so reading it as "what the athlete paid" over-refunds by the fee on a
  // charge that never collected it.
  it("excludes the booking fee when the organiser absorbed it", () => {
    expect(entryPaidCents({ ...athletePays, feeStructure: "organiser" })).toBe(10000);
  });

  it("treats an unrecognised fee structure as organiser-absorbed, never over-refunding", () => {
    expect(entryPaidCents({ ...athletePays, feeStructure: "" })).toBe(10000);
  });
});

describe("entryRefundAmountCents", () => {
  it("is never undefined, whatever the snapshot holds", () => {
    for (const snapshot of [null, 0, 1, 5000, 10540, 999999]) {
      const result = entryRefundAmountCents({ ...athletePays, refundAmountCents: snapshot });
      expect(result).toBeTypeOf("number");
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
    }
  });

  it("honours a partial snapshot", () => {
    expect(entryRefundAmountCents({ ...athletePays, refundAmountCents: 5270 })).toBe(5270);
  });

  // The bug: a row predating the structured policy used to fall back to an
  // amountless refund, which returns the WHOLE charge, including every other
  // participant in a group booking.
  it("falls back to what this entry paid, not to the whole charge", () => {
    expect(entryRefundAmountCents(athletePays)).toBe(10540);
    expect(entryRefundAmountCents(athletePays)).toBe(entryPaidCents(athletePays));
  });

  it("never returns more than this entry paid", () => {
    expect(entryRefundAmountCents({ ...athletePays, refundAmountCents: 999999 })).toBe(10540);
  });

  // The snapshot is computed from amountCents + platformFeeCents by the athlete
  // request route, which over-states an organiser-pays entry. The clamp is what
  // stops that reaching Stripe.
  it("clamps an organiser-pays entry to the ticket price the athlete actually paid", () => {
    expect(
      entryRefundAmountCents({
        ...athletePays,
        feeStructure: "organiser",
        refundAmountCents: 10540,
      }),
    ).toBe(10000);
  });

  it("flags a zero snapshot as outside the policy rather than refunding nothing", () => {
    expect(isOutsidePolicyRefund({ ...athletePays, refundAmountCents: 0 })).toBe(true);
    expect(isOutsidePolicyRefund(athletePays)).toBe(false);
  });
});

describe("buildRefundParams", () => {
  const request = {
    chargeId: "ch_1",
    amountCents: 5000,
    idempotencyKey: "entry-refund-r1",
    hasTransfer: true,
    hasApplicationFee: true,
  };

  // Without this the connected account keeps its funds and the PLATFORM covers
  // the refund out of its own balance.
  it("reverses the transfer on a destination charge", () => {
    const [params] = buildRefundParams(request);
    expect(params.reverse_transfer).toBe(true);
  });

  // Checkout omits transfer_data for a direct charge. Asking Stripe to reverse a
  // transfer that does not exist fails the entire refund, so the flag is only
  // sent when the charge actually carries one.
  it("omits reverse_transfer on a charge with no transfer", () => {
    const [params] = buildRefundParams({ ...request, hasTransfer: false });
    expect(params).not.toHaveProperty("reverse_transfer");
  });

  it("omits refund_application_fee on a charge with no application fee", () => {
    const [params] = buildRefundParams({ ...request, hasApplicationFee: false });
    expect(params).not.toHaveProperty("refund_application_fee");
  });

  it("always sends an explicit amount, so a refund can never sweep the whole charge", () => {
    const [params] = buildRefundParams(request);
    expect(params.amount).toBe(5000);
    expect(params).toHaveProperty("amount");
  });

  it("carries the idempotency key so a retry cannot refund twice", () => {
    const [, options] = buildRefundParams(request);
    expect(options).toEqual({ idempotencyKey: "entry-refund-r1" });
  });

  // Signed-off commercial decision: Startline keeps its booking fee, which is
  // what covers the Stripe processing fee Stripe does not return.
  it("keeps the platform fee", () => {
    const [params] = buildRefundParams(request);
    expect(REFUND_APPLICATION_FEE).toBe(false);
    expect(params.refund_application_fee).toBe(false);
  });

  it("refuses an amount that is not a positive whole number of cents", () => {
    for (const bad of [0, -1, 12.5, NaN]) {
      expect(() => buildRefundParams({ ...request, amountCents: bad })).toThrow(
        /positive whole number/,
      );
    }
  });
});

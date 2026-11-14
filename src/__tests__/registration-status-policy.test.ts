import { describe, it, expect } from "vitest";
import { organiserStatusChange, isFreeEntry, PAID_STATUS_ERROR } from "@/lib/registration-status-policy";

const FREE = { amountCents: 0, platformFeeCents: 0, stripePaymentIntentId: null };
const PAID = { amountCents: 4500, platformFeeCents: 300, stripePaymentIntentId: "pi_123" };

describe("organiserStatusChange", () => {
  it("treats sending the current status back as no change, paid or free", () => {
    expect(organiserStatusChange({ ...PAID, status: "REFUND_REQUESTED" }, "REFUND_REQUESTED")).toEqual({ ok: true, change: false });
    expect(organiserStatusChange({ ...FREE, status: "CONFIRMED" }, "CONFIRMED")).toEqual({ ok: true, change: false });
  });

  it.each([
    ["REFUND_REQUESTED", "REFUNDED"],
    ["REFUNDED", "CONFIRMED"],
    ["CONFIRMED", "CANCELLED"],
    ["CANCELLED", "CONFIRMED"],
    ["CONFIRMED", "REFUND_REQUESTED"],
  ] as const)("refuses every change to a paid entry: %s -> %s", (from, to) => {
    expect(organiserStatusChange({ ...PAID, status: from }, to)).toEqual({ ok: false, error: PAID_STATUS_ERROR });
  });

  it("treats a zero-price entry with a payment intent as paid", () => {
    const entry = { ...FREE, stripePaymentIntentId: "pi_1", status: "CONFIRMED" as const };
    expect(organiserStatusChange(entry, "CANCELLED").ok).toBe(false);
  });

  it("lets a free entry be cancelled and reinstated", () => {
    expect(organiserStatusChange({ ...FREE, status: "CONFIRMED" }, "CANCELLED")).toEqual({ ok: true, change: true, reinstating: false });
    expect(organiserStatusChange({ ...FREE, status: "CANCELLED" }, "CONFIRMED")).toEqual({ ok: true, change: true, reinstating: true });
  });

  it("does not let a free entry be marked refunded or refund requested", () => {
    expect(organiserStatusChange({ ...FREE, status: "CONFIRMED" }, "REFUNDED").ok).toBe(false);
    expect(organiserStatusChange({ ...FREE, status: "CONFIRMED" }, "REFUND_REQUESTED").ok).toBe(false);
  });
});

describe("isFreeEntry", () => {
  it("needs no price, no fee and no payment intent", () => {
    expect(isFreeEntry(FREE)).toBe(true);
    expect(isFreeEntry({ ...FREE, platformFeeCents: 50 })).toBe(false);
    expect(isFreeEntry(PAID)).toBe(false);
  });
});

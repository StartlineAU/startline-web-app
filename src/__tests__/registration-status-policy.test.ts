import { describe, it, expect } from "vitest";
import {
  organiserStatusChange,
  isFreeEntry,
  PAID_STATUS_ERROR,
  REMOVED_STATUS_ERROR,
  USE_REMOVE_ERROR,
} from "@/lib/registration-status-policy";

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
    ["CANCELLED", "CONFIRMED"],
    ["CONFIRMED", "REFUND_REQUESTED"],
  ] as const)("refuses every change to a paid entry: %s -> %s", (from, to) => {
    expect(organiserStatusChange({ ...PAID, status: from }, to)).toEqual({ ok: false, error: PAID_STATUS_ERROR });
  });

  it("treats a zero-price entry with a payment intent as paid", () => {
    const entry = { ...FREE, stripePaymentIntentId: "pi_1", status: "CANCELLED" as const };
    expect(organiserStatusChange(entry, "CONFIRMED").ok).toBe(false);
  });

  // #571: taking someone out is Remove from event, never a quiet status edit.
  it.each([
    ["free", FREE],
    ["paid", PAID],
  ] as const)("refuses cancelling or removing a %s entry by status", (_kind, money) => {
    expect(organiserStatusChange({ ...money, status: "CONFIRMED" }, "CANCELLED")).toEqual({ ok: false, error: USE_REMOVE_ERROR });
    expect(organiserStatusChange({ ...money, status: "CONFIRMED" }, "REMOVED")).toEqual({ ok: false, error: USE_REMOVE_ERROR });
  });

  it("never changes a removed entry, whatever it is changed to", () => {
    for (const next of ["CONFIRMED", "CANCELLED", "REFUNDED"] as const) {
      expect(organiserStatusChange({ ...FREE, status: "REMOVED" }, next)).toEqual({ ok: false, error: REMOVED_STATUS_ERROR });
    }
    expect(organiserStatusChange({ ...FREE, status: "REMOVED" }, "REMOVED")).toEqual({ ok: true, change: false });
  });

  it("still lets a cancelled free entry be reinstated", () => {
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

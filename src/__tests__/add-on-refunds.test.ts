import { describe, it, expect } from "vitest";
import {
  addOnRefundAmountCents,
  canRequestAddOnRefund,
  canDecideAddOnRefund,
  ADDON_REFUND_NOTICE,
} from "@/lib/add-on-refunds";

// The entry-refund half of this module's original test file landed with #323 and
// lives in stripe-refunds.test.ts. What is here is the add-on side only.

const item = {
  status: "PURCHASED" as const,
  amountCents: 2500,
  platformFeeCents: 99,
  feeStructure: "athlete",
};

describe("addOnRefundAmountCents", () => {
  it("returns the item and the fee when the athlete paid the fee", () => {
    expect(addOnRefundAmountCents(item)).toBe(2599);
  });

  it("returns the item only when the organiser absorbed the fee", () => {
    // The athlete never paid that fee, so it is not theirs to receive back.
    expect(addOnRefundAmountCents({ ...item, feeStructure: "organiser" })).toBe(2500);
  });

  it("has no policy tiers: the amount does not shrink as the event approaches", () => {
    expect(addOnRefundAmountCents(item)).toBe(addOnRefundAmountCents(item));
  });

  it("is never negative", () => {
    expect(addOnRefundAmountCents({ ...item, amountCents: 0, platformFeeCents: 0 })).toBe(0);
  });
});

describe("canRequestAddOnRefund", () => {
  const base = { item, eventDate: "2026-09-30", today: "2026-08-31" };

  it("allows a purchased item before the event", () => {
    expect(canRequestAddOnRefund(base).ok).toBe(true);
  });

  it("allows a request on race day itself", () => {
    expect(canRequestAddOnRefund({ ...base, eventDate: "2026-08-31" }).ok).toBe(true);
  });

  it("refuses once the event has passed", () => {
    const result = canRequestAddOnRefund({ ...base, eventDate: "2026-08-30" });
    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses a second request while one is open", () => {
    const result = canRequestAddOnRefund({ ...base, item: { ...item, status: "REFUND_REQUESTED" } });
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(result.ok === false && result.reason).toMatch(/already asked/);
  });

  it("refuses an item that is already refunded", () => {
    const result = canRequestAddOnRefund({ ...base, item: { ...item, status: "REFUNDED" } });
    expect(result.ok === false && result.reason).toMatch(/already been refunded/);
  });

  it("refuses an item that was never fulfilled", () => {
    expect(canRequestAddOnRefund({ ...base, item: { ...item, status: "CANCELLED" } }).ok).toBe(false);
  });
});

describe("canDecideAddOnRefund", () => {
  it("allows the organiser to act on an open request", () => {
    expect(canDecideAddOnRefund({ ...item, status: "REFUND_REQUESTED" }).ok).toBe(true);
  });

  it("refuses when there is no open request", () => {
    expect(canDecideAddOnRefund(item).ok).toBe(false);
  });

  it("refuses to decide twice", () => {
    const result = canDecideAddOnRefund({ ...item, status: "REFUNDED" });
    expect(result.ok === false && result.reason).toMatch(/already been refunded/);
  });
});

describe("athlete-facing copy", () => {
  it("promises a decision without quoting a percentage or a policy", () => {
    expect(ADDON_REFUND_NOTICE).toBe("The organiser will approve or decline this request.");
    expect(ADDON_REFUND_NOTICE).not.toMatch(/%|policy|tier/i);
  });
});

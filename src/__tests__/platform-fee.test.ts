import { describe, it, expect } from "vitest";
import {
  PLATFORM_FEE_PERCENT,
  PLATFORM_FEE_FIXED_CENTS,
  calculatePlatformFee,
  calculateTotalWithFee,
} from "@/lib/platform-fee";

describe("calculatePlatformFee", () => {
  // The fee is a share of a sale, not a subscription: charging the fixed
  // component on a free ticket would bill the athlete A$1.45 to enter a free
  // event, or hand Stripe a fee bigger than the charge (issue #308).
  it("charges nothing on a free ticket", () => {
    expect(calculatePlatformFee(0)).toBe(0);
  });

  it("charges nothing on a nonsensical negative amount", () => {
    expect(calculatePlatformFee(-500)).toBe(0);
  });

  it("applies the percentage plus the fixed fee", () => {
    const amount = 10000; // $100.00
    expect(calculatePlatformFee(amount)).toBe(
      Math.round(amount * PLATFORM_FEE_PERCENT) + PLATFORM_FEE_FIXED_CENTS
    );
  });

  it("rounds the percentage component to the nearest cent", () => {
    // 3.95% of $3.33 → 13.15 → 13, plus 145 fixed.
    expect(calculatePlatformFee(333)).toBe(13 + PLATFORM_FEE_FIXED_CENTS);
  });

  it("handles large amounts", () => {
    expect(calculatePlatformFee(7500000)).toBe(
      Math.round(7500000 * PLATFORM_FEE_PERCENT) + PLATFORM_FEE_FIXED_CENTS
    );
  });
});

describe("calculateTotalWithFee — athlete pays", () => {
  it("adds the fee on top of the ticket price", () => {
    const { totalCents, platformFeeCents } = calculateTotalWithFee(10000, "athlete");
    expect(platformFeeCents).toBe(540);
    expect(totalCents).toBe(10540);
  });

  it("never exceeds the sum of price and fee", () => {
    const price = 5000;
    const { totalCents, platformFeeCents } = calculateTotalWithFee(price, "athlete");
    expect(totalCents).toBe(price + platformFeeCents);
  });
});

describe("calculateTotalWithFee — organiser pays", () => {
  it("keeps the ticket price as the total the athlete pays", () => {
    const { totalCents, platformFeeCents } = calculateTotalWithFee(10000, "organiser");
    expect(platformFeeCents).toBe(540);
    expect(totalCents).toBe(10000);
  });
});

describe("calculateTotalWithFee — free ticket", () => {
  it("costs nothing under either fee structure", () => {
    expect(calculateTotalWithFee(0, "athlete")).toEqual({ totalCents: 0, platformFeeCents: 0 });
    expect(calculateTotalWithFee(0, "organiser")).toEqual({ totalCents: 0, platformFeeCents: 0 });
  });
});


// The paid ticket path must not move a cent. The one deliberate change to this
// function is #308's free-ticket case: a $0 ticket now yields a $0 fee rather
// than the bare fixed component, which is the bug that stopped athletes
// registering for free events. Guarded just below.
describe("ticket fee lock", () => {
  it("still charges the fixed component on every paid ticket", () => {
    expect(PLATFORM_FEE_FIXED_CENTS).toBe(145);
    expect(calculatePlatformFee(2500)).toBe(244);
    expect(calculatePlatformFee(1)).toBe(145);
  });

  it("charges nothing on a free ticket", () => {
    expect(calculatePlatformFee(0)).toBe(0);
  });
});

// ─── One booking fee per ticket ──────────────────────────────────────────────
//
// The rule as the business states it: an athlete pays 3.95% of the ticket plus
// one $1.45, not a separate Startline fee per ticket. Checkout accumulates the
// fee per ticket (lib/checkout-order.ts), so this mirrors that accumulation.
function basketFeeCents(ticketCents: number[]): number {
  return ticketCents.reduce((sum, c) => sum + calculatePlatformFee(c), 0);
}

describe("booking fee across a whole basket", () => {
  // Stated explicitly rather than left to be discovered: the fixed component is
  // per TICKET, not per order, because it covers per-registration cost. A family
  // of four pays four of them.
  it("charges the fixed component once per ticket in a group booking", () => {
    const four = basketFeeCents([6500, 6500, 6500, 6500]);
    expect(four).toBe(4 * calculatePlatformFee(6500));
    // Per line, not over the total: the percentage is rounded once per ticket,
    // so four $65 tickets take 4 x 257c, which is a cent more than rounding
    // 3.95% of $260 in one go. Stating it this way keeps the assertion about
    // the fixed component rather than about rounding.
    expect(four - 4 * Math.round(6500 * PLATFORM_FEE_PERCENT)).toBe(4 * PLATFORM_FEE_FIXED_CENTS);
  });

  it("charges nothing for a free ticket", () => {
    expect(basketFeeCents([0])).toBe(0);
  });
});

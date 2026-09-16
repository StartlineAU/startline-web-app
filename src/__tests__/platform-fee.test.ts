import { describe, it, expect } from "vitest";
import {
  PLATFORM_FEE_PERCENT,
  PLATFORM_FEE_FIXED_CENTS,
  calculatePlatformFee,
  calculateTotalWithFee,
  calculateAddOnPlatformFee,
  calculateAddOnTotalWithFee,
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


// Add-ons are charged a percentage only. These lock the two fee schemes apart:
// the ticket fee must keep its fixed component, and the add-on fee must not
// acquire one.
describe("calculateAddOnPlatformFee", () => {
  it("charges no fixed component", () => {
    expect(calculateAddOnPlatformFee(0)).toBe(0);
  });

  it("applies the same percentage as a ticket, without the fixed fee", () => {
    const amount = 10000;
    expect(calculateAddOnPlatformFee(amount)).toBe(Math.round(amount * PLATFORM_FEE_PERCENT));
    expect(calculatePlatformFee(amount) - calculateAddOnPlatformFee(amount)).toBe(
      PLATFORM_FEE_FIXED_CENTS
    );
  });

  it("keeps the take on a $25 tee at the percentage, not 9.8%", () => {
    expect(calculateAddOnPlatformFee(2500)).toBe(99);
  });

  it("rounds to the nearest cent", () => {
    // 3.95% of $5.10 → 20.145 → 20.
    expect(calculateAddOnPlatformFee(510)).toBe(20);
  });
});

describe("calculateAddOnTotalWithFee", () => {
  it("adds the fee on top when the athlete pays it", () => {
    const { totalCents, platformFeeCents } = calculateAddOnTotalWithFee(2500, "athlete");
    expect(platformFeeCents).toBe(99);
    expect(totalCents).toBe(2599);
  });

  it("keeps the product price as the total when the organiser pays the fee", () => {
    const { totalCents, platformFeeCents } = calculateAddOnTotalWithFee(2500, "organiser");
    expect(platformFeeCents).toBe(99);
    expect(totalCents).toBe(2500);
  });
});

// The paid ticket path must not move a cent. The add-on work leaves
// calculatePlatformFee alone; this fails if the fixed component is ever folded
// away into the percentage.
//
// The one deliberate change to this function is #308's free-ticket case: a $0
// ticket now yields a $0 fee rather than the bare fixed component, which is the
// bug that stopped athletes registering for free events. Guarded just below.
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

// ─── One booking fee per ticket, never one per item ──────────────────────────
//
// The rule as the business states it: an athlete buying a ticket and a t-shirt
// pays 3.95% of the total plus ONE $1.45, not a separate Startline fee per item.
// The unit tests above prove each function in isolation; these prove the thing
// the athlete actually sees on the order summary, which is the sum of them.
//
// Checkout accumulates the fee per ticket and per add-on line
// (lib/checkout-order.ts), so this mirrors that accumulation rather than calling
// some single basket function, which does not exist.
function basketFeeCents(ticketCents: number[], addOnCents: number[]): number {
  return (
    ticketCents.reduce((sum, c) => sum + calculatePlatformFee(c), 0) +
    addOnCents.reduce((sum, c) => sum + calculateAddOnPlatformFee(c), 0)
  );
}

/** What "3.95% of the whole basket plus one $1.45" comes to. */
function oneFeeOnTotal(goodsCents: number): number {
  return Math.round(goodsCents * PLATFORM_FEE_PERCENT) + PLATFORM_FEE_FIXED_CENTS;
}

describe("booking fee across a whole basket", () => {
  it("charges one $1.45 for a ticket plus a tee, not one each", () => {
    // $65 entry + $25 tee. Were the fixed component charged per item this would
    // be $6.46 rather than $5.01.
    expect(basketFeeCents([6500], [2500])).toBe(501);
    expect(basketFeeCents([6500], [2500])).toBe(oneFeeOnTotal(6500 + 2500));
  });

  it("still charges one $1.45 however many add-ons ride along", () => {
    for (const addOns of [[2500], [2500, 1200], [2500, 1200, 999, 4500]]) {
      const goods = 6500 + addOns.reduce((a, b) => a + b, 0);
      expect(basketFeeCents([6500], addOns)).toBe(oneFeeOnTotal(goods));
    }
  });

  it("adds exactly the percentage when an add-on joins an existing ticket", () => {
    const ticketOnly = basketFeeCents([6500], []);
    const withTee = basketFeeCents([6500], [2500]);
    expect(withTee - ticketOnly).toBe(calculateAddOnPlatformFee(2500));
    expect(withTee - ticketOnly).toBe(99);
  });

  // Stated explicitly rather than left to be discovered: the fixed component is
  // per TICKET, not per order, because it covers per-registration cost. A family
  // of four pays four of them, exactly as they did before add-ons existed. Only
  // the merchandise is exempt.
  it("charges the fixed component once per ticket in a group booking", () => {
    const four = basketFeeCents([6500, 6500, 6500, 6500], []);
    expect(four).toBe(4 * calculatePlatformFee(6500));
    // Per line, not over the total: the percentage is rounded once per ticket,
    // so four $65 tickets take 4 x 257c, which is a cent more than rounding
    // 3.95% of $260 in one go. Stating it this way keeps the assertion about
    // the fixed component rather than about rounding.
    expect(four - 4 * Math.round(6500 * PLATFORM_FEE_PERCENT)).toBe(4 * PLATFORM_FEE_FIXED_CENTS);

    // Adding a tee per athlete adds only the percentage, never a fifth fixed fee.
    const withTees = basketFeeCents([6500, 6500, 6500, 6500], [2500, 2500, 2500, 2500]);
    expect(withTees - four).toBe(4 * calculateAddOnPlatformFee(2500));
  });

  // A free ticket carries no fee at all (#308), so merchandise bought alongside
  // one is charged the percentage and no fixed component. Startline takes less
  // here than the headline rule implies, which is the deliberate trade for
  // letting people register free events.
  it("charges no fixed component when the ticket is free", () => {
    expect(basketFeeCents([0], [2500])).toBe(99);
  });
});

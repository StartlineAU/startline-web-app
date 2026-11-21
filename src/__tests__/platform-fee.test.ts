import { describe, it, expect } from "vitest";
import {
  PLATFORM_FEE_PERCENT,
  PLATFORM_FEE_FIXED_CENTS,
  calculatePlatformFee,
  calculateTotalWithFee,
  estimateStripeFeeCents,
  applicationFeeCents,
  ticketFeeBreakdown,
  allocateStripeFeeCents,
  entryOrganiserNetCents,
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

// ─── Organisers absorb the Stripe processing fee (#470) ─────────────────────

describe("estimateStripeFeeCents", () => {
  it("charges the domestic rate on the amount charged", () => {
    // 1.75% of A$53.43 = 93.5c, rounded to 94c, plus 30c.
    expect(estimateStripeFeeCents(5343)).toBe(124);
    expect(estimateStripeFeeCents(5000)).toBe(118);
  });

  it("charges nothing on a free order", () => {
    expect(estimateStripeFeeCents(0)).toBe(0);
    expect(estimateStripeFeeCents(-1)).toBe(0);
  });
});

describe("applicationFeeCents", () => {
  it("adds the Stripe fee estimate to the booking fee", () => {
    expect(applicationFeeCents(5343, 343, 124)).toBe(467);
  });

  // Stripe rejects an application fee larger than the charge.
  it("never exceeds the amount charged", () => {
    expect(applicationFeeCents(100, 149, 32)).toBe(100);
  });
});

describe("ticketFeeBreakdown — the issue's A$50 example", () => {
  it("athlete pays: Startline keeps its whole fee, organiser absorbs Stripe's", () => {
    expect(ticketFeeBreakdown(5000, "athlete")).toEqual({
      athletePaysCents: 5343,
      platformFeeCents: 343,
      stripeFeeCents: 124,
      organiserReceivesCents: 4876,
    });
  });

  it("organiser pays: both fees come out of the ticket price", () => {
    expect(ticketFeeBreakdown(5000, "organiser")).toEqual({
      athletePaysCents: 5000,
      platformFeeCents: 343,
      stripeFeeCents: 118,
      organiserReceivesCents: 4539,
    });
  });

  it("matches what the organiser's payout reads back", () => {
    for (const feeStructure of ["athlete", "organiser"]) {
      const fees = ticketFeeBreakdown(12900, feeStructure);
      expect(entryOrganiserNetCents({
        amountCents: 12900,
        platformFeeCents: fees.platformFeeCents,
        stripeFeeCents: fees.stripeFeeCents,
        feeStructure,
      })).toBe(fees.organiserReceivesCents);
    }
  });

  it("is all zeros for a free ticket", () => {
    expect(ticketFeeBreakdown(0, "athlete")).toEqual({
      athletePaysCents: 0, platformFeeCents: 0, stripeFeeCents: 0, organiserReceivesCents: 0,
    });
  });
});

describe("ticketFeeBreakdown — a team ticket is one payment", () => {
  // A$40 per person, team of 4: four booking fees, but one Stripe fee on the
  // A$172.12 charge. Pricing one ticket and multiplying by four would count
  // Stripe's fixed 30c four times and show the organiser 89c too little.
  it("athlete pays: one Stripe fee on the whole team", () => {
    expect(ticketFeeBreakdown(4000, "athlete", 4)).toEqual({
      athletePaysCents: 17212,
      platformFeeCents: 1212,
      stripeFeeCents: 331,
      organiserReceivesCents: 15669,
    });
    expect(ticketFeeBreakdown(4000, "athlete").organiserReceivesCents * 4).toBe(15580);
  });

  it("organiser pays: one Stripe fee on the whole team", () => {
    expect(ticketFeeBreakdown(4000, "organiser", 4)).toEqual({
      athletePaysCents: 16000,
      platformFeeCents: 1212,
      stripeFeeCents: 310,
      organiserReceivesCents: 14478,
    });
  });

  it("splits back into member entries that sum to the payout", () => {
    for (const feeStructure of ["athlete", "organiser"]) {
      const team = ticketFeeBreakdown(4000, feeStructure, 4);
      const each = ticketFeeBreakdown(4000, feeStructure).athletePaysCents;
      const shares = allocateStripeFeeCents(team.stripeFeeCents, [each, each, each, each]);
      const nets = shares.map((stripeFeeCents) => entryOrganiserNetCents({
        amountCents: 4000,
        platformFeeCents: 303,
        stripeFeeCents,
        feeStructure,
      }));
      expect(nets.reduce((a, b) => a + b, 0)).toBe(team.organiserReceivesCents);
    }
    // The rounding remainder lands on the first member, the captain.
    expect(allocateStripeFeeCents(331, [4303, 4303, 4303, 4303])).toEqual([85, 82, 82, 82]);
  });
});

describe("allocateStripeFeeCents", () => {
  it("splits an order's fee so the parts sum to the whole", () => {
    const parts = allocateStripeFeeCents(101, [2000, 2000, 2000]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(101);
    expect(parts).toEqual([35, 33, 33]);
  });

  it("weights by what each entry charged and skips free entries", () => {
    expect(allocateStripeFeeCents(90, [0, 3000, 6000])).toEqual([0, 30, 60]);
  });

  it("gives nothing when there is no fee or nothing was charged", () => {
    expect(allocateStripeFeeCents(0, [5000])).toEqual([0]);
    expect(allocateStripeFeeCents(50, [0, 0])).toEqual([0, 0]);
  });
});

export const PLATFORM_FEE_PERCENT = 0.0395;
export const PLATFORM_FEE_FIXED_CENTS = 145;

/**
 * Stripe's domestic card rate, used to estimate its processing fee (#470).
 *
 * Checkout uses destination charges, so Stripe debits its fee from the
 * platform balance. The organiser absorbs it: checkout adds this estimate to
 * the application fee, which reimburses the platform out of the organiser's
 * share. International and Amex cards cost Stripe more than this; Startline
 * covers that gap rather than over-deducting from organisers on domestic cards.
 */
export const STRIPE_FEE_PERCENT = 0.0175;
export const STRIPE_FEE_FIXED_CENTS = 30;

/**
 * Startline's cut of a ticket: a percentage plus a fixed component.
 *
 * A free ticket carries no fee at all. The fixed component is not a
 * subscription — it is a share of a sale — so applying it to a $0 ticket would
 * either charge an athlete A$1.45 to enter a free event (athlete-pays) or hand
 * Stripe an application fee larger than the charge (organiser-pays). Both are
 * wrong, so a zero (or nonsensical negative) price yields a zero fee.
 */
export function calculatePlatformFee(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round(amountCents * PLATFORM_FEE_PERCENT) + PLATFORM_FEE_FIXED_CENTS;
}

export function calculateTotalWithFee(amountCents: number, feeStructure: string): {
  totalCents: number;
  platformFeeCents: number;
} {
  const fee = calculatePlatformFee(amountCents);
  if (feeStructure === "athlete") {
    return { totalCents: amountCents + fee, platformFeeCents: fee };
  }
  return { totalCents: amountCents, platformFeeCents: fee };
}

/**
 * Estimated Stripe processing fee on one charge. Stripe charges per
 * PaymentIntent, not per ticket, so pass the whole amount charged: ticket plus
 * booking fee when the athlete pays it, ticket only when the organiser does.
 * Nothing is charged on a free order, so there is no fee.
 */
export function estimateStripeFeeCents(chargedCents: number): number {
  if (chargedCents <= 0) return 0;
  return Math.round(chargedCents * STRIPE_FEE_PERCENT) + STRIPE_FEE_FIXED_CENTS;
}

/**
 * The application fee checkout asks Stripe for: Startline's booking fee plus
 * the Stripe fee estimate. Stripe rejects an application fee larger than the
 * charge, which a tiny organiser-pays ticket could otherwise produce.
 */
export function applicationFeeCents(
  totalCents: number,
  platformFeeCents: number,
  stripeFeeCents: number,
): number {
  return Math.max(0, Math.min(totalCents, platformFeeCents + stripeFeeCents));
}

export type TicketFeeBreakdown = {
  athletePaysCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  organiserReceivesCents: number;
};

/**
 * What `people` tickets bought together in one payment cost and pay the
 * organiser: one ticket on its own by default, or a whole team ticket. The
 * event form preview shows this, so it must match checkout.
 *
 * The booking fee is per person, as checkout charges it, but Stripe charges
 * one fee on the whole payment. Multiplying a single ticket's breakdown by the
 * team size would count Stripe's fixed 30c once per member.
 */
export function ticketFeeBreakdown(priceCents: number, feeStructure: string, people = 1): TicketFeeBreakdown {
  const each = calculateTotalWithFee(priceCents, feeStructure);
  const totalCents = each.totalCents * people;
  const platformFeeCents = each.platformFeeCents * people;
  const stripeFeeCents = estimateStripeFeeCents(totalCents);
  const appFee = applicationFeeCents(totalCents, platformFeeCents, stripeFeeCents);
  return {
    athletePaysCents: totalCents,
    platformFeeCents,
    stripeFeeCents,
    organiserReceivesCents: Math.max(0, totalCents - appFee),
  };
}

export interface FeeSnapshot {
  amountCents: number;
  platformFeeCents: number;
  /** Absent on rows read without it; treated as no Stripe fee. */
  stripeFeeCents?: number;
  feeStructure: string;
}

/**
 * What the organiser's connected account actually holds for one entry.
 *
 * Checkout takes the booking fee and the Stripe fee estimate as one
 * application fee, so the organiser's balance is the ticket price minus the
 * Stripe fee when the athlete paid the booking fee on top, and the ticket
 * price minus both when the organiser absorbed it. Reading platformFeeCents
 * as part of the organiser's share would pay out money the connected account
 * never received (issue #251). Entries paid before #470 carry no Stripe fee.
 *
 * An unrecognised structure is treated as organiser-absorbed, matching
 * calculateTotalWithFee: that is the safer direction when the snapshot is odd.
 */
export function entryOrganiserNetCents(entry: FeeSnapshot): number {
  const bookingFee = entry.feeStructure === "athlete" ? 0 : entry.platformFeeCents;
  return Math.max(0, entry.amountCents - bookingFee - (entry.stripeFeeCents ?? 0));
}

/**
 * Split an order's Stripe fee across its entries in proportion to what each
 * one charged, so the parts sum exactly to the whole. The rounding remainder
 * goes to the first charged entry.
 */
export function allocateStripeFeeCents(orderFeeCents: number, chargedCents: number[]): number[] {
  const total = chargedCents.reduce((sum, c) => sum + Math.max(0, c), 0);
  if (orderFeeCents <= 0 || total <= 0) return chargedCents.map(() => 0);
  const parts = chargedCents.map((c) => Math.floor((orderFeeCents * Math.max(0, c)) / total));
  const remainder = orderFeeCents - parts.reduce((sum, p) => sum + p, 0);
  const first = chargedCents.findIndex((c) => c > 0);
  parts[first] += remainder;
  return parts;
}

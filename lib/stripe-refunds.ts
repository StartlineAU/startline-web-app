/**
 * Refund parameters for Startline's Stripe charges, in one place.
 *
 * A registration payment is normally a DESTINATION CHARGE: the customer is
 * charged on the platform account, an application_fee_amount is retained, and
 * the remainder is transferred straight to the organiser's connected account.
 * Two properties of that arrangement have to be respected on every refund.
 *
 * 1. reverse_transfer
 *    Stripe's default is that the connected account KEEPS the funds already
 *    transferred to it, leaving the platform to cover the refund out of its own
 *    balance. Every refund Startline issued before this module was paid for by
 *    Startline rather than by the organiser whose event was refunded. Reversing
 *    the transfer pulls the organiser's share back, proportionally to the amount
 *    refunded.
 *
 * 2. An explicit amount, always.
 *    A refund created without an `amount` returns the ENTIRE charge. One
 *    PaymentIntent covers every participant in a group booking, so an amountless
 *    refund for one athlete in a family of ten refunds all ten entries. There is
 *    no case in this codebase where refunding the whole charge is correct, so
 *    the amount is a required argument here rather than an optional one.
 *
 * Neither flag is sent unconditionally, because not every charge is a
 * destination charge. `app/api/checkout/route.ts` omits `transfer_data` and
 * `application_fee_amount` entirely when STRIPE_DEV_DIRECT_CHARGE is set or the
 * organiser has no connected account, and Stripe rejects a refund that asks to
 * reverse a transfer the charge does not have. The caller reads both facts off
 * the retrieved Charge and passes them in, so a refund can never fail on a flag
 * describing something that is not there.
 *
 * refund_application_fee stays false where there is a fee to refund: Startline
 * retains its booking fee on a refund, which is what covers the Stripe
 * processing fee Stripe does not return. That is a commercial decision, signed
 * off, not a default left unexamined. It means the organiser bears the booking
 * fee on a sale that was refunded, and the organiser terms need to say so.
 */

import type Stripe from "stripe";

/**
 * Whether to hand the platform fee back to the connected account on a refund.
 * False means Startline keeps it. See the note above before changing this: it
 * moves real money.
 */
export const REFUND_APPLICATION_FEE = false;

export interface RefundRequest {
  chargeId: string;
  /** Exact cents to return. Never omit: an amountless refund returns the whole charge. */
  amountCents: number;
  /** Makes a retry of the same logical refund a no-op rather than a second refund. */
  idempotencyKey: string;
  /**
   * Whether the charge carries a transfer to a connected account. Read from the
   * Charge (`charge.transfer`), never assumed: a direct charge has none, and
   * asking to reverse one that does not exist fails the whole refund.
   */
  hasTransfer: boolean;
  /**
   * Whether the charge carries an application fee. Read from the Charge
   * (`charge.application_fee`). With no fee there is nothing for
   * refund_application_fee to describe, so the flag is left off.
   */
  hasApplicationFee: boolean;
}

/**
 * Build the params for a refund. Returns the tuple Stripe's SDK takes so the
 * idempotency key cannot be forgotten at the call site.
 */
export function buildRefundParams(
  request: RefundRequest,
): [Stripe.RefundCreateParams, Stripe.RequestOptions] {
  if (!Number.isInteger(request.amountCents) || request.amountCents <= 0) {
    throw new Error(
      `Refund amount must be a positive whole number of cents, got ${request.amountCents}.`,
    );
  }
  return [
    {
      charge: request.chargeId,
      amount: request.amountCents,
      ...(request.hasTransfer ? { reverse_transfer: true } : {}),
      ...(request.hasApplicationFee
        ? { refund_application_fee: REFUND_APPLICATION_FEE }
        : {}),
    },
    { idempotencyKey: request.idempotencyKey },
  ];
}

export interface EntryRefundInput {
  /** Ticket price on the registration. */
  amountCents: number;
  /** Startline fee on the registration, stored whoever ends up bearing it. */
  platformFeeCents: number;
  /** "athlete" when the athlete was charged the fee on top, "organiser" when it was absorbed. */
  feeStructure: string;
  /** Amount frozen when the athlete asked, or null for a row predating the policy. */
  refundAmountCents: number | null;
}

/**
 * What this ONE entry's payer actually handed over.
 *
 * platformFeeCents is recorded on every registration regardless of who bears
 * it, so it is only part of what the athlete paid under the "athlete" fee
 * structure. Under "organiser" the athlete was charged the ticket price alone
 * and the fee came out of the organiser's share, so including it here would
 * refund the athlete money they never paid, taken from a charge that never
 * collected it. Same rule as the confirmation email in
 * `app/api/stripe/webhook/route.ts`.
 */
export function entryPaidCents(input: EntryRefundInput): number {
  return input.feeStructure === "athlete"
    ? input.amountCents + input.platformFeeCents
    : input.amountCents;
}

/**
 * True when the frozen snapshot says the policy owes nothing. The caller refuses
 * the request rather than refunding zero, so a goodwill exception stays a
 * deliberate manual act in the Stripe dashboard.
 */
export function isOutsidePolicyRefund(input: EntryRefundInput): boolean {
  return input.refundAmountCents === 0;
}

/**
 * Cents to refund for one entry. Always a positive whole number, never
 * undefined, and never more than this entry paid.
 *
 * A null snapshot means the registration predates the structured policy. It
 * falls back to what this entry paid, NOT to the whole charge, which is the
 * difference between refunding one athlete and refunding their whole family.
 */
export function entryRefundAmountCents(input: EntryRefundInput): number {
  const paid = entryPaidCents(input);
  const snapshot = input.refundAmountCents;
  if (snapshot == null) return Math.max(0, paid);
  return Math.max(0, Math.min(snapshot, paid));
}

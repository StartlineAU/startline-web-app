/**
 * Why an organiser approved or declined a refund request (#492). Shared by the
 * organiser's refund queue, the API and the athlete's email, so the wording is
 * the same everywhere. Mirrors the RefundDecisionReason enum in
 * prisma/schema.prisma.
 *
 * The reason decides how much goes back:
 *
 * - WITHIN_POLICY returns the organisation's change-of-mind quote, taken when
 *   the athlete asked. The booking fee stays with Startline.
 * - EVENT_CHANGED and NOT_DELIVERED are the Australian Consumer Law cases: the
 *   athlete is owed everything they paid, booking fee included.
 * - GOODWILL is the organiser choosing to go further than their policy. It
 *   returns the whole ticket price, and the booking fee stays with Startline,
 *   as it does for any refund that is not owed (terms 3.4, 5.6).
 *
 * Startline keeps its application fee on every one of these refunds
 * (REFUND_APPLICATION_FEE in lib/stripe-refunds.ts), so the booking fee an ACL
 * refund returns comes out of the organiser's share. Only a cancelled event
 * hands the application fee back.
 */

import type { RefundDecisionReason, RefundType } from "@prisma/client";

export const APPROVE_REASONS = [
  "WITHIN_POLICY",
  "EVENT_CHANGED",
  "NOT_DELIVERED",
  "GOODWILL",
] as const satisfies readonly RefundDecisionReason[];

export const DECLINE_REASONS = [
  "OUTSIDE_POLICY",
  "OTHER",
] as const satisfies readonly RefundDecisionReason[];

export type ApproveReason = (typeof APPROVE_REASONS)[number];
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export const REFUND_REASON_LABEL: Record<RefundDecisionReason, string> = {
  WITHIN_POLICY: "Within our refund policy",
  EVENT_CHANGED: "We changed the event",
  NOT_DELIVERED: "We could not run the event as described",
  GOODWILL: "Goodwill, outside our policy",
  OUTSIDE_POLICY: "Outside our refund policy",
  OTHER: "Other",
};

/** What the organiser sees under each reason, so the money is never a surprise. */
export const REFUND_REASON_HINT: Record<RefundDecisionReason, string> = {
  WITHIN_POLICY: "Refunds the policy amount. The booking fee is not refunded.",
  EVENT_CHANGED:
    "The date, place or event changed. Refunds everything paid, booking fee included, from your account.",
  NOT_DELIVERED:
    "Refunds everything paid, booking fee included, from your account.",
  GOODWILL:
    "Refunds the whole ticket price from your account. The booking fee is not refunded.",
  OUTSIDE_POLICY: "No refund. Tell the athlete why in the note.",
  OTHER: "No refund. Tell the athlete why in the note.",
};

export function isApproveReason(reason: RefundDecisionReason): reason is ApproveReason {
  return (APPROVE_REASONS as readonly RefundDecisionReason[]).includes(reason);
}

export function isDeclineReason(reason: RefundDecisionReason): reason is DeclineReason {
  return (DECLINE_REASONS as readonly RefundDecisionReason[]).includes(reason);
}

/** How much an approval returns. */
export function refundTypeFor(reason: ApproveReason): RefundType {
  if (reason === "WITHIN_POLICY") return "POLICY";
  if (reason === "GOODWILL") return "TICKET";
  return "FULL";
}

/**
 * A decline always says why: the athlete gets the note in their email. Goodwill
 * says why too, so Startline can see why the policy was set aside.
 */
export function refundNoteRequired(reason: RefundDecisionReason): boolean {
  return isDeclineReason(reason) || reason === "GOODWILL";
}

export const REFUND_NOTE_MAX = 2000;

/**
 * Why an approved refund stopped: a Stripe dashboard refund on the payment
 * matched no entry (lib/refund-ticket-outcome.ts). The admin queue offers to
 * match it to the request when it sees this exact message.
 */
export const UNMATCHED_STRIPE_REFUND_MESSAGE =
  "A refund on this payment was made in Stripe and not matched to an entry. Startline checks it before refunding again.";

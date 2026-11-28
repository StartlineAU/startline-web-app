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
 * - GOODWILL is the organiser choosing to go further than their policy, and
 *   returns everything as well.
 *
 * A full refund comes out of the organiser's connected account in full,
 * booking fee included, because Startline keeps its application fee on a
 * refund (REFUND_APPLICATION_FEE in lib/stripe-refunds.ts). Only a cancelled
 * event returns the fee.
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
    "Refunds everything paid, booking fee included, from your account.",
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
  return reason === "WITHIN_POLICY" ? "POLICY" : "FULL";
}

/**
 * A decline always says why: the athlete gets the note in their email. Goodwill
 * says why too, so Startline can see why the policy was set aside.
 */
export function refundNoteRequired(reason: RefundDecisionReason): boolean {
  return isDeclineReason(reason) || reason === "GOODWILL";
}

export const REFUND_NOTE_MAX = 2000;

import type { RefundDecisionReason, RefundType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { RefundError, issueEntryRefund, refundEntrySelect } from "@/lib/issue-entry-refund";
import { entryPaidCents } from "@/lib/stripe-refunds";
import { refundTeammates } from "@/lib/team-refund";
import { REFUND_REASON_LABEL, UNMATCHED_STRIPE_REFUND_MESSAGE } from "@/lib/refund-decision-reasons";
import { sendRefundDecisionEmail, type RefundDecisionEmailData } from "@/lib/email";

/**
 * What a refund ticket's decision does to the entry and the money (#492).
 *
 * A ticket raised from the athlete's own entry carries `registrationId` and the
 * change-of-mind quote taken when they asked. Approving it issues the refund
 * straight away:
 *
 * - POLICY returns the quote: a share of the ticket price, booking fee kept.
 * - TICKET (goodwill) returns the whole ticket price, booking fee kept.
 * - FULL (the Australian Consumer Law cases) returns everything the entry paid,
 *   booking fee included. Startline keeps its application fee on the refund
 *   (REFUND_APPLICATION_FEE in lib/stripe-refunds.ts), so the fee comes out of
 *   the organiser's share. Only a cancelled event returns the application fee.
 *
 * Declining puts the entry back to CONFIRMED, so the athlete keeps their place.
 * A ticket with no registration predates this and is still matched and
 * refunded by hand from /admin/registrations.
 */

export const ticketOutcomeSelect = {
  id: true,
  status: true,
  email: true,
  name: true,
  eventName: true,
  registrationId: true,
  policyRefundPercent: true,
  policyRefundCents: true,
  organiserReason: true,
  organiserNote: true,
  adminDecisionKind: true,
  adminNote: true,
  refundType: true,
  refundCents: true,
  registration: {
    select: {
      ...refundEntrySelect,
      teamId: true,
      event: { select: { id: true, title: true, organiser: { select: { orgName: true } } } },
    },
  },
} as const;

type OutcomeTicket = {
  id: string;
  status: string;
  email: string;
  name: string;
  eventName: string | null;
  registrationId: string | null;
  policyRefundPercent: number | null;
  policyRefundCents: number | null;
  organiserReason: RefundDecisionReason | null;
  organiserNote: string | null;
  adminDecisionKind: string | null;
  adminNote: string | null;
  refundType: RefundType | null;
  refundCents: number | null;
  registration: {
    id: string;
    status: string;
    amountCents: number;
    platformFeeCents: number;
    feeStructure: string;
    refundAmountCents: number | null;
    refundPercent: number | null;
    stripePaymentIntentId: string | null;
    cancelRefundStatus: string | null;
    athleteName: string;
    userId: string | null;
    eventId: string;
    teamId: string | null;
    event: { id: string; title: string; organiser: { orgName: string | null } };
  } | null;
};

export const REFUNDABLE_ENTRY_STATUSES = ["CONFIRMED", "REFUND_REQUESTED"] as const;

/** Cents an approval of this type returns for this entry. */
export function ticketRefundCents(
  ticket: Pick<OutcomeTicket, "policyRefundCents">,
  entry: { amountCents: number; platformFeeCents: number; feeStructure: string },
  type: RefundType,
): number {
  if (type === "FULL") return entryPaidCents(entry);
  if (type === "TICKET") return Math.min(entry.amountCents, entryPaidCents(entry));
  return Math.max(0, Math.min(ticket.policyRefundCents ?? 0, entryPaidCents(entry)));
}

/**
 * Why an approval of this type cannot go ahead, or null when it can. A policy
 * that owes nothing is refused rather than refunding zero: the organiser picks
 * goodwill to refund anyway, and an admin approves it as a full refund.
 */
export function approvalBlocker(
  ticket: Pick<OutcomeTicket, "registrationId" | "policyRefundCents">,
  type: RefundType,
  audience: "organiser" | "admin" = "organiser",
): string | null {
  if (!ticket.registrationId) return null;
  if (type === "POLICY" && (ticket.policyRefundCents ?? 0) <= 0) {
    const instead =
      audience === "admin" ? "Approve it as a full refund instead" : "Choose goodwill to refund it anyway";
    return `The refund policy owes nothing on this entry. ${instead}, or decline.`;
  }
  return null;
}

export async function loadOutcomeTicket(id: string): Promise<OutcomeTicket | null> {
  return prisma.supportTicket.findUnique({ where: { id }, select: ticketOutcomeSelect });
}

export type IssueResult =
  | { ok: true; refundCents: number }
  | { ok: false; error: string };

/**
 * Issue the refund for an APPROVED ticket and mark it REFUNDED. Safe to retry:
 * each Stripe refund carries the entry's idempotency key, and an entry already
 * refunded some other way just closes the ticket.
 *
 * A failure leaves the ticket APPROVED with `refundError` set, so an admin can
 * see it and retry. The athlete is emailed once: "refunded" on success, or
 * "approved, being processed" on the first failure (`firstAttempt`).
 */
export async function issueTicketRefund(
  ticketId: string,
  { firstAttempt }: { firstAttempt: boolean },
): Promise<IssueResult> {
  const ticket = await loadOutcomeTicket(ticketId);
  if (!ticket || ticket.status !== "APPROVED" || !ticket.registration || !ticket.refundType) {
    return { ok: false, error: "This request has no approved entry to refund." };
  }
  const entry = ticket.registration;
  const type = ticket.refundType;

  const cents = ticketRefundCents(ticket, entry, type);
  try {
    let total: number;
    if (entry.status === "REFUNDED") {
      // Refunded already: by an earlier attempt that stopped part-way through a
      // team, or by an admin from the registration. Count what actually went
      // back and carry on with any teammates.
      total = entry.refundAmountCents ?? 0;
    } else {
      if (cents <= 0) {
        throw new RefundError("There is nothing to refund on this entry.", 409, "NOTHING_TO_REFUND");
      }
      // A refund made in the Stripe dashboard on this payment that matched no
      // entry (lib/payment-adjustments.ts) may already be this athlete's money.
      // Issuing another would pay them twice, so an admin matches it first.
      if (entry.stripePaymentIntentId) {
        const unmatched = await prisma.paymentAdjustment.aggregate({
          where: { stripePaymentIntentId: entry.stripePaymentIntentId, kind: "REFUND", unallocatedCents: { gt: 0 } },
          _sum: { unallocatedCents: true },
        });
        if ((unmatched._sum.unallocatedCents ?? 0) > 0) {
          throw new RefundError(UNMATCHED_STRIPE_REFUND_MESSAGE, 409, "UNMATCHED_STRIPE_REFUND");
        }
      }
      // The amount issueEntryRefund sends to Stripe is the one on the entry.
      const prepared = await prisma.registration.updateMany({
        where: { id: entry.id, status: { in: [...REFUNDABLE_ENTRY_STATUSES] } },
        data: {
          refundAmountCents: cents,
          refundPercent: type === "POLICY" ? ticket.policyRefundPercent : 100,
          refundOutsidePolicy: type !== "POLICY" && (ticket.policyRefundCents ?? 0) < cents,
        },
      });
      if (prepared.count !== 1) {
        throw new RefundError("This entry changed a moment ago. Refresh and try again.", 409, "STALE");
      }
      const result = await issueEntryRefund({ ...entry, refundAmountCents: cents });
      total = result.refundCents;
    }

    const failures: string[] = [];
    if (entry.teamId) {
      const team = await refundTeammates(
        entry.teamId,
        entry.id,
        type === "FULL"
          ? { kind: "full" }
          : type === "TICKET"
            ? { kind: "ticket" }
            : { kind: "percent", percent: ticket.policyRefundPercent },
      );
      for (const f of team.failed) failures.push(`${f.athleteName}: ${f.error}`);
      // What went back to this athlete's card: their own entry, plus any
      // teammates bought on the same payment. A teammate who paid for their
      // own place was refunded to their own card and is not counted here.
      if (entry.stripePaymentIntentId) {
        const samePayment = await prisma.registration.aggregate({
          where: {
            teamId: entry.teamId,
            id: { not: entry.id },
            status: "REFUNDED",
            stripePaymentIntentId: entry.stripePaymentIntentId,
          },
          _sum: { refundAmountCents: true },
        });
        total += samePayment._sum.refundAmountCents ?? 0;
      }
    }
    if (failures.length > 0) {
      // This entry is refunded; some teammates are not. Retrying picks them up.
      throw new RefundError(
        `Refunded this entry, but not ${failures.join("; ")}. Retry to finish the team.`,
        502,
        "TEAM_PARTIAL",
      );
    }

    await markTicketRefunded(ticket.id, total);
    await notifyAthlete(ticket, "refunded", total, type);
    return { ok: true, refundCents: total };
  } catch (err) {
    const message =
      err instanceof RefundError ? err.message : "Stripe did not accept the refund. Try again shortly.";
    if (!(err instanceof RefundError)) console.error("Refund ticket issue failed:", ticket.id, err);
    await prisma.supportTicket
      .update({ where: { id: ticket.id }, data: { refundError: message } })
      .catch(() => {});
    if (firstAttempt) await notifyAthlete(ticket, "approved", cents, type);
    return { ok: false, error: message };
  }
}

/**
 * An admin confirms that an unmatched Stripe dashboard refund on this entry's
 * payment was this request's money, so nothing more is sent. The entry is
 * marked REFUNDED with up to the approved amount, and that much comes off the
 * adjustment's unmatched total: the entry leaving the payout now accounts for
 * it, and leaving it unmatched as well would take it off the payout twice.
 * Then the ticket is finished as usual, teammates included.
 *
 * Returns null when there is no unmatched refund on the payment to match.
 */
export async function settleWithStripeRefund(ticketId: string): Promise<IssueResult | null> {
  const ticket = await loadOutcomeTicket(ticketId);
  const entry = ticket?.registration;
  if (!ticket || ticket.status !== "APPROVED" || !entry || !ticket.refundType || !entry.stripePaymentIntentId) {
    return null;
  }
  if (entry.status !== "REFUNDED") {
    const paymentIntentId = entry.stripePaymentIntentId;
    const wanted = ticketRefundCents(ticket, entry, ticket.refundType);
    const matched = await prisma.$transaction(async (tx) => {
      const adjustments = await tx.paymentAdjustment.findMany({
        where: { stripePaymentIntentId: paymentIntentId, kind: "REFUND", unallocatedCents: { gt: 0 } },
        orderBy: { createdAt: "asc" },
        select: { id: true, unallocatedCents: true },
      });
      const available = adjustments.reduce((sum, a) => sum + a.unallocatedCents, 0);
      const cents = Math.min(wanted, available);
      if (cents <= 0) return null;
      const moved = await tx.registration.updateMany({
        where: { id: entry.id, status: { in: [...REFUNDABLE_ENTRY_STATUSES] } },
        data: {
          status: "REFUNDED",
          refundAmountCents: cents,
          refundPercent: ticket.refundType === "POLICY" ? ticket.policyRefundPercent : 100,
          refundOutsidePolicy: ticket.refundType !== "POLICY" && (ticket.policyRefundCents ?? 0) < cents,
        },
      });
      if (moved.count !== 1) return null;
      let left = cents;
      for (const a of adjustments) {
        if (left <= 0) break;
        const take = Math.min(left, a.unallocatedCents);
        await tx.paymentAdjustment.update({
          where: { id: a.id },
          data: { unallocatedCents: a.unallocatedCents - take },
        });
        left -= take;
      }
      return cents;
    });
    if (matched == null) return null;
  }
  // The entry is REFUNDED now, so this closes the ticket on what went back
  // and refunds any teammates still holding places.
  return issueTicketRefund(ticketId, { firstAttempt: false });
}

async function markTicketRefunded(ticketId: string, cents: number) {
  await prisma.supportTicket.updateMany({
    where: { id: ticketId, status: "APPROVED" },
    data: { status: "REFUNDED", refundCents: cents, refundIssuedAt: new Date(), refundError: null },
  });
}

/**
 * A declined request gives the athlete their entry back as it was. Only an
 * entry still waiting on this request is touched.
 */
export async function restoreDeclinedEntry(ticketId: string): Promise<void> {
  const ticket = await loadOutcomeTicket(ticketId);
  if (!ticket) return;
  if (ticket.registration) {
    await prisma.registration.updateMany({
      where: { id: ticket.registration.id, status: "REFUND_REQUESTED" },
      data: {
        status: "CONFIRMED",
        refundRequestedAt: null,
        refundPercent: null,
        refundAmountCents: null,
        refundOutsidePolicy: false,
      },
    });
  }
  await notifyAthlete(ticket, "declined", null, null);
}

/** Approved with no entry linked: Startline still issues it by hand. */
export async function notifyApprovedWithoutEntry(ticketId: string): Promise<void> {
  const ticket = await loadOutcomeTicket(ticketId);
  if (ticket) await notifyAthlete(ticket, "approved", null, ticket.refundType);
}

/**
 * Email the athlete, and tell them in-app when they have an account. Best
 * effort: the decision is what matters, so a failed message never fails it.
 * A completed refund's in-app notice comes from issueEntryRefund.
 */
async function notifyAthlete(
  ticket: OutcomeTicket,
  outcome: "refunded" | "approved" | "declined",
  cents: number | null,
  type: RefundType | null,
) {
  const eventTitle = ticket.registration?.event.title ?? ticket.eventName ?? "your event";
  const organiserName = ticket.registration?.event.organiser.orgName ?? "The organiser";
  // An admin decision (no response, or an override) is Startline's, with its
  // own note. The organiser's earlier reason and note no longer apply.
  const byStartline = ticket.adminDecisionKind != null;
  const decider = byStartline ? "Startline" : organiserName;
  const reasonLabel =
    !byStartline && ticket.organiserReason ? REFUND_REASON_LABEL[ticket.organiserReason] : null;
  const note = outcome === "declined" ? (byStartline ? ticket.adminNote : ticket.organiserNote) : null;
  const data: RefundDecisionEmailData = {
    outcome,
    athleteName: ticket.registration?.athleteName ?? ticket.name,
    eventTitle,
    organiserName,
    amountCents: cents,
    full: type === "FULL",
    reasonLabel,
    note,
    decidedBy: byStartline ? "startline" : "organiser",
    ticketId: ticket.id,
  };
  try {
    await sendRefundDecisionEmail(ticket.email, data);
  } catch (err) {
    console.error("Refund decision email failed:", ticket.id, err);
  }

  const userId = ticket.registration?.userId;
  if (!userId || outcome === "refunded") return;
  try {
    await prisma.userNotification.create({
      data: {
        userId,
        type: outcome === "declined" ? "REFUND_DECLINED" : "REFUND_APPROVED",
        title: outcome === "declined" ? "Refund declined" : "Refund approved",
        body:
          outcome === "declined"
            ? `${decider} declined your refund request for ${eventTitle}. Your entry still stands.` +
              (note ? ` Note: ${note}` : "")
            : `${decider} approved your refund for ${eventTitle}. Startline is issuing it now.`,
        eventId: ticket.registration?.event.id ?? null,
      },
    });
  } catch {
    // Swallowed on purpose — see above.
  }
}

import type Stripe from "stripe";
import { PayoutStatus, type Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { lockEventEntries } from "@/lib/event-entry-lock";
import { entryPaidCents } from "@/lib/stripe-refunds";
import { listAdminReviewRecipients } from "@/lib/admin-notification-recipients";
import { sendPaymentAdjustmentEmails, type PaymentAdjustmentEmailData } from "@/lib/email";

/**
 * Refunds and disputes that happen in Stripe rather than through Startline
 * (#550). Before this, a refund issued from the Stripe dashboard or a lost card
 * dispute left the entry CONFIRMED: the athlete kept their place and the
 * organiser was still paid out for money that had gone back.
 *
 * Each Stripe object is recorded once as a PaymentAdjustment. Where the money
 * can be matched to particular entries, those entries become REFUNDED, which
 * takes them out of the payout and frees their places. Where it cannot, the
 * cents are recorded as unallocated and lib/payout.ts takes them off the
 * event's payout instead, and an admin is told to sort out which entry it was.
 */

/** metadata.reason on the refunds Startline issues itself. */
export const STARTLINE_REFUND_REASONS: ReadonlySet<string> = new Set([
  "entry_refund", // lib/issue-entry-refund.ts
  "event_cancelled", // lib/event-cancellation.ts
  "registration_refused", // lib/refund-refused-payment.ts
]);

const REFUNDABLE = ["CONFIRMED", "REFUND_REQUESTED"] as const;

export interface AllocatableEntry {
  id: string;
  status: string;
  amountCents: number;
  platformFeeCents: number;
  feeStructure: string;
  refundAmountCents: number | null;
}

export interface Allocation {
  /** Entry id → cents that went back for it. */
  entries: Map<string, number>;
  /** Cents that matched no particular entry. */
  unallocatedCents: number;
}

/**
 * Decide which entries a refund (or lost dispute) of `amountCents` covers.
 *
 * One payment can pay for a whole group, so a partial amount is only matched
 * when exactly one entry fits it. Guessing between two identical tickets would
 * take the place off the wrong athlete, so an ambiguous amount stays
 * unallocated for an admin to resolve.
 */
export function allocateRefund(
  entries: AllocatableEntry[],
  amountCents: number,
  opts: { wholeCharge: boolean },
): Allocation {
  const open = entries.filter((e) => (REFUNDABLE as readonly string[]).includes(e.status));
  const paid = (e: AllocatableEntry) => entryPaidCents(e);
  const all = (): Allocation => ({
    entries: new Map(open.map((e) => [e.id, paid(e)])),
    unallocatedCents: 0,
  });

  if (open.length === 0) return { entries: new Map(), unallocatedCents: opts.wholeCharge ? 0 : amountCents };
  if (opts.wholeCharge) return all();
  if (open.reduce((sum, e) => sum + paid(e), 0) === amountCents) return all();

  // One entry on the payment: any refund on it is that entry's, including a
  // part refund under a policy tier.
  if (open.length === 1 && amountCents <= paid(open[0])) {
    return { entries: new Map([[open[0].id, amountCents]]), unallocatedCents: 0 };
  }

  // An athlete asked, an admin refunded the quoted amount by hand.
  const quoted = open.filter((e) => e.status === "REFUND_REQUESTED" && e.refundAmountCents === amountCents);
  if (quoted.length === 1) return { entries: new Map([[quoted[0].id, amountCents]]), unallocatedCents: 0 };

  const exact = open.filter((e) => paid(e) === amountCents);
  if (exact.length === 1) return { entries: new Map([[exact[0].id, amountCents]]), unallocatedCents: 0 };

  return { entries: new Map(), unallocatedCents: amountCents };
}

type EventFacts = {
  id: string;
  title: string;
  payoutTriggered: boolean;
  payoutOperation: { status: PayoutStatus } | null;
  organiser: { orgName: string | null };
};

const eventFactsSelect = {
  id: true,
  title: true,
  payoutTriggered: true,
  payoutOperation: { select: { status: true } },
  organiser: { select: { orgName: true } },
} as const;

/** True once money may already have left for the organiser's bank. */
function alreadyPaidOut(event: EventFacts): boolean {
  const status = event.payoutOperation?.status;
  return event.payoutTriggered || (status != null && status !== PayoutStatus.PENDING && status !== PayoutStatus.FAILED);
}

const entrySelect = {
  id: true,
  status: true,
  amountCents: true,
  platformFeeCents: true,
  feeStructure: true,
  refundAmountCents: true,
  userId: true,
} as const;

type Entry = AllocatableEntry & { userId: string | null };

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** The event a payment belongs to, or null when it is not a registration payment. */
async function eventForPayment(paymentIntentId: string): Promise<EventFacts | null> {
  const row = await prisma.registration.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { event: { select: eventFactsSelect } },
  });
  return row?.event ?? null;
}

async function markEntriesRefunded(
  tx: Prisma.TransactionClient,
  allocation: Allocation,
  stripeRefundId: string | null,
): Promise<string[]> {
  const moved: string[] = [];
  for (const [id, cents] of allocation.entries) {
    const result = await tx.registration.updateMany({
      where: { id, status: { in: [...REFUNDABLE] } },
      data: { status: "REFUNDED", refundAmountCents: cents, ...(stripeRefundId ? { stripeRefundId } : {}) },
    });
    if (result.count === 1) moved.push(id);
  }
  return moved;
}

const formatAud = (cents: number) => `$${(cents / 100).toFixed(2)}`;

async function alertAdmins(data: PaymentAdjustmentEmailData): Promise<void> {
  // Best-effort: the database is already right, and a failed email must not
  // make Stripe redeliver an event that has been recorded.
  try {
    await sendPaymentAdjustmentEmails(await listAdminReviewRecipients(), data);
  } catch (err) {
    console.error("Payment adjustment alert failed:", err);
  }
}

async function notifyRefunded(entries: Entry[], ids: string[], eventId: string, eventTitle: string) {
  for (const entry of entries) {
    if (!entry.userId || !ids.includes(entry.id)) continue;
    try {
      await prisma.userNotification.create({
        data: {
          userId: entry.userId,
          type: "REFUND_PROCESSED",
          title: "Refund processed",
          body:
            `Your refund for ${eventTitle} is on its way back to your original payment method. ` +
            `Allow 5 to 10 business days.`,
          eventId,
        },
      });
    } catch {
      // Best-effort, as in lib/issue-entry-refund.ts.
    }
  }
}

// ─── charge.refunded ─────────────────────────────────────────────────────────

/**
 * Record every refund on this charge that Startline did not issue itself.
 * Stripe sends charge.refunded for our own refunds too, so those are skipped
 * by their metadata, and by their id for refunds made before it was set.
 */
export async function syncChargeRefunds(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId = idOf(charge.payment_intent);
  if (!paymentIntentId) return;
  const event = await eventForPayment(paymentIntentId);
  if (!event) return;

  const refunds = await getStripe().refunds.list({ charge: charge.id, limit: 100 });
  const external = refunds.data
    .filter((r) => r.status === "succeeded" || r.status === "pending")
    .filter((r) => !STARTLINE_REFUND_REASONS.has(r.metadata?.reason ?? ""))
    .sort((a, b) => a.created - b.created);

  for (const [index, refund] of external.entries()) {
    // Only the newest refund can be the one that emptied the charge.
    const wholeCharge = charge.refunded && index === external.length - 1;
    await recordExternalRefund(refund, paymentIntentId, event, wholeCharge);
  }
}

async function recordExternalRefund(
  refund: Stripe.Refund,
  paymentIntentId: string,
  event: EventFacts,
  wholeCharge: boolean,
): Promise<void> {
  const outcome = await prisma.$transaction(async (tx) => {
    await lockEventEntries(tx, event.id);
    const seen = await tx.paymentAdjustment.findUnique({ where: { stripeObjectId: refund.id }, select: { id: true } });
    if (seen) return null;
    const ours = await tx.registration.findFirst({
      where: { OR: [{ stripeRefundId: refund.id }, { cancelRefundId: refund.id }] },
      select: { id: true },
    });
    if (ours) return null;

    const entries: Entry[] = await tx.registration.findMany({
      where: { stripePaymentIntentId: paymentIntentId },
      select: entrySelect,
    });
    const allocation = allocateRefund(entries, refund.amount, { wholeCharge });
    const moved = await markEntriesRefunded(tx, allocation, refund.id);

    // Every entry is refunded now, so earlier refunds that matched no entry are
    // already accounted for by those entries leaving the payout.
    if (wholeCharge) {
      await tx.paymentAdjustment.updateMany({
        where: { stripePaymentIntentId: paymentIntentId, kind: "REFUND" },
        data: { unallocatedCents: 0 },
      });
    }

    const afterPayout = alreadyPaidOut(event);
    await tx.paymentAdjustment.create({
      data: {
        stripeObjectId: refund.id,
        kind: "REFUND",
        eventId: event.id,
        stripePaymentIntentId: paymentIntentId,
        amountCents: refund.amount,
        unallocatedCents: allocation.unallocatedCents,
        afterPayout,
      },
    });
    return { entries, moved, unallocatedCents: allocation.unallocatedCents, afterPayout };
  });
  if (!outcome) return;

  await notifyRefunded(outcome.entries, outcome.moved, event.id, event.title);

  if (outcome.unallocatedCents > 0 || outcome.afterPayout) {
    await alertAdmins({
      heading: "Refund issued in Stripe",
      tone: "warning",
      title: outcome.afterPayout ? "Refund after payout." : "Refund needs matching.",
      sub: outcome.afterPayout
        ? "This event was already paid out. Recover the refunded amount from the organiser."
        : "This refund did not match one entry, so the amount was taken off the payout and every entry still holds its place. Do not refund it again from the admin portal.",
      eventTitle: event.title,
      organiserName: event.organiser.orgName ?? "Organiser",
      items: [
        { label: "Refund", value: `${formatAud(refund.amount)} (${refund.id})` },
        { label: "Payment", value: paymentIntentId },
        { label: "Entries matched", value: String(outcome.moved.length) },
      ],
    });
  }
}

// ─── charge.dispute.created / charge.dispute.closed ──────────────────────────

function disputeStatusOf(dispute: Stripe.Dispute): "OPEN" | "WON" | "LOST" {
  if (dispute.status === "lost") return "LOST";
  if (dispute.status === "won" || dispute.status === "warning_closed") return "WON";
  return "OPEN";
}

/** Stripe's dispute fee, net of any it gave back. */
function disputeFeeCents(dispute: Stripe.Dispute): number {
  return Math.max(0, (dispute.balance_transactions ?? []).reduce((sum, txn) => sum + (txn.fee ?? 0), 0));
}

async function disputePaymentIntentId(dispute: Stripe.Dispute): Promise<string | null> {
  const direct = idOf(dispute.payment_intent);
  if (direct) return direct;
  const chargeId = idOf(dispute.charge);
  if (!chargeId) return null;
  const charge = await getStripe().charges.retrieve(chargeId);
  return idOf(charge.payment_intent);
}

/**
 * Record a dispute, or its outcome. An open dispute holds the event's payout
 * (lib/payout.ts). Lost, the disputed entries are treated as refunded and
 * Stripe's dispute fee comes off the payout; won, the hold lifts.
 */
export async function syncDispute(dispute: Stripe.Dispute): Promise<void> {
  const paymentIntentId = await disputePaymentIntentId(dispute);
  if (!paymentIntentId) return;
  const event = await eventForPayment(paymentIntentId);
  if (!event) return;

  const status = disputeStatusOf(dispute);
  const feeCents = disputeFeeCents(dispute);

  const outcome = await prisma.$transaction(async (tx) => {
    await lockEventEntries(tx, event.id);
    const existing = await tx.paymentAdjustment.findUnique({
      where: { stripeObjectId: dispute.id },
      select: { disputeStatus: true },
    });
    // A closed dispute stays closed; a late or repeated delivery changes nothing.
    if (existing && (existing.disputeStatus !== "OPEN" || status === "OPEN")) return null;

    let moved: string[] = [];
    let unallocatedCents = 0;
    if (status === "LOST") {
      const entries: Entry[] = await tx.registration.findMany({
        where: { stripePaymentIntentId: paymentIntentId },
        select: entrySelect,
      });
      const allocation = allocateRefund(entries, dispute.amount, { wholeCharge: false });
      moved = await markEntriesRefunded(tx, allocation, null);
      unallocatedCents = allocation.unallocatedCents;
    }

    const afterPayout = alreadyPaidOut(event);
    const data = {
      amountCents: dispute.amount,
      disputeStatus: status,
      feeCents,
      unallocatedCents,
      afterPayout,
    };
    await tx.paymentAdjustment.upsert({
      where: { stripeObjectId: dispute.id },
      create: {
        stripeObjectId: dispute.id,
        kind: "DISPUTE",
        eventId: event.id,
        stripePaymentIntentId: paymentIntentId,
        ...data,
      },
      update: data,
    });
    return { moved, afterPayout };
  });
  if (!outcome) return;

  const copy = {
    OPEN: {
      heading: "Card dispute opened",
      tone: "danger" as const,
      title: "Payout on hold.",
      sub: outcome.afterPayout
        ? "An athlete disputed this charge after the event was paid out. Respond to it in Stripe."
        : "An athlete disputed this charge. The event's payout is held until Stripe closes the dispute. Respond to it in Stripe.",
    },
    WON: {
      heading: "Card dispute won",
      tone: "success" as const,
      title: "Payout released.",
      sub: "Stripe closed the dispute in Startline's favour. The entry stands and the payout can run.",
    },
    LOST: {
      heading: "Card dispute lost",
      tone: "danger" as const,
      title: "Dispute lost.",
      sub: outcome.afterPayout
        ? "The event was already paid out. Recover the disputed amount and fee from the organiser."
        : "The disputed entries are no longer confirmed, and the dispute fee has been taken off the payout.",
    },
  }[status];

  await alertAdmins({
    ...copy,
    eventTitle: event.title,
    organiserName: event.organiser.orgName ?? "Organiser",
    items: [
      { label: "Amount", value: `${formatAud(dispute.amount)} (${dispute.id})` },
      { label: "Reason", value: dispute.reason ?? "Not given" },
      { label: "Payment", value: paymentIntentId },
      ...(status === "LOST"
        ? [
            { label: "Dispute fee", value: formatAud(feeCents) },
            { label: "Entries removed", value: String(outcome.moved.length) },
          ]
        : []),
    ],
  });
}

import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { lockEventEntries } from "@/lib/event-entry-lock";
import { cancelEventSchedules } from "@/lib/event-scheduler";
import { refundEntryCharge } from "@/lib/issue-entry-refund";
import { entryCancellationOwedCents, entryPaidCents } from "@/lib/stripe-refunds";
import { sendEventCancelledEmails } from "@/lib/email";

/**
 * Cancelling an event (the replacement for deleting one that has entries).
 *
 * The rule is absolute: when an event is cancelled, every athlete gets back
 * everything they paid at checkout, the ticket price and the Startline booking
 * fee (Terms 3.5, 5.6, 8.2). There is no policy tier, cut-off or review step in
 * the way, and no state in which a paid entry is left unrefunded:
 *
 * - The event flips to CANCELLED under the same per-event lock checkout
 *   confirmations take, so a payment either landed before (and is flagged here)
 *   or lands after and is refused and refunded in full by the Stripe webhook.
 * - Each paid entry is flagged PENDING in the same transaction, then refunded:
 *   the first CANCEL_REFUNDS_PER_RUN straight away, the rest by the lifecycle
 *   worker's one-minute sweep (`app/api/internal/events/lifecycle`). A refund
 *   that fails is recorded FAILED with its reason and retried every
 *   CANCEL_REFUND_RETRY_GAP_MS until it succeeds.
 * - Startline returns its booking fee (refund_application_fee), so the
 *   organiser's transfer is reversed in full and it is not left paying a fee on
 *   sales it had to give back.
 */

export type CancelActor = { role: "organiser" | "admin"; id: string };

export class CancelError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "CancelError";
  }
}

/** Statuses an event can be cancelled from. A finished event already happened. */
export const CANCELLABLE_EVENT_STATUSES = ["DRAFT", "PENDING", "APPROVED", "IN_PROGRESS"] as const;

export function canCancelEventStatus(status: string): boolean {
  return (CANCELLABLE_EVENT_STATUSES as readonly string[]).includes(status);
}

/** Entry statuses that still hold money or a place when the event is called off. */
const HELD_STATUSES = ["CONFIRMED", "REFUND_REQUESTED"] as const;

const CANCEL_REFUND_OPEN = ["PENDING", "FAILED"];

/**
 * A failed refund waits this long before the sweep (every minute) tries it
 * again, so an entry that keeps failing is not sent to Stripe 60 times an hour.
 */
export const CANCEL_REFUND_RETRY_GAP_MS = 15 * 60 * 1000;

/**
 * Refunds attempted in one request. The cancel itself runs inside an HTTP
 * request with a platform timeout; whatever is past the cap stays PENDING
 * and the one-minute sweep carries on with it.
 */
export const CANCEL_REFUNDS_PER_RUN = 10;

export interface CancellationSummary {
  /** Entries refunded in this run. */
  refunded: number;
  /** Entries whose refund failed this run; the worker retries them. */
  failed: number;
  /** Free or external entries released (nothing to refund). */
  released: number;
  /** Cents refunded in this run. */
  refundedCents: number;
  /** Entries still waiting for their refund after this run. */
  outstanding: number;
}

/** Rows a run may attempt now: never tried, or failed long enough ago. */
function dueForRefund(eventId: string | undefined, now: Date, includeRecentFailures: boolean) {
  return {
    ...(eventId ? { eventId } : {}),
    OR: [
      { cancelRefundStatus: "PENDING" },
      includeRecentFailures
        ? { cancelRefundStatus: "FAILED" }
        : {
            cancelRefundStatus: "FAILED",
            OR: [
              { cancelRefundAttemptAt: null },
              { cancelRefundAttemptAt: { lt: new Date(now.getTime() - CANCEL_REFUND_RETRY_GAP_MS) } },
            ],
          },
    ],
  };
}

const owedSelect = {
  id: true,
  status: true,
  amountCents: true,
  platformFeeCents: true,
  feeStructure: true,
  refundAmountCents: true,
  stripePaymentIntentId: true,
  athleteEmail: true,
  userId: true,
} as const;

/**
 * Cancel an event and refund everyone. Idempotent: cancelling an event that is
 * already cancelled just retries whatever refunds are still outstanding.
 */
export async function cancelEvent(opts: {
  eventId: string;
  actor: CancelActor;
  reason: string | null;
}): Promise<CancellationSummary & { alreadyCancelled: boolean }> {
  const event = await prisma.event.findUnique({
    where: { id: opts.eventId },
    select: { id: true, status: true, title: true, eventDate: true, organiserId: true },
  });
  if (!event) throw new CancelError("Event not found.", 404, "NOT_FOUND");

  if (event.status === "CANCELLED") {
    // Asked for by a person ("Retry now"), so failures go again straight away.
    const retry = await processCancellationRefunds(event.id, { includeRecentFailures: true });
    return { ...retry, released: 0, alreadyCancelled: true };
  }
  if (!canCancelEventStatus(event.status)) {
    throw new CancelError(
      event.status === "ARCHIVED"
        ? "A finished event can't be cancelled."
        : "This event can't be cancelled.",
      409,
      "NOT_CANCELLABLE",
    );
  }

  const reason = opts.reason?.trim() || null;

  // Who is owed what, worked out at the moment of cancelling, before any
  // refund moves the rows. Used for the emails below.
  const owedByEntry = new Map<string, { email: string; userId: string | null; cents: number }>();

  const released = await prisma.$transaction(async (tx) => {
    await lockEventEntries(tx, event.id);

    const flipped = await tx.event.updateMany({
      where: { id: event.id, status: event.status },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: opts.actor.id,
        cancelledByRole: opts.actor.role,
        cancellationReason: reason,
      },
    });
    if (flipped.count !== 1) {
      throw new CancelError("This event changed a moment ago. Refresh and try again.", 409, "STALE");
    }

    // A paid entry is owed whatever it has not had back. That includes one
    // already partly refunded under the change-of-mind policy.
    const paidEntries = await tx.registration.findMany({
      where: {
        eventId: event.id,
        stripePaymentIntentId: { not: null },
        status: { in: [...HELD_STATUSES, "REFUNDED"] },
        cancelRefundStatus: null,
      },
      select: owedSelect,
    });
    const owing = paidEntries.filter((e) => entryCancellationOwedCents(e) > 0);
    for (const e of owing) {
      owedByEntry.set(e.id, { email: e.athleteEmail, userId: e.userId, cents: entryCancellationOwedCents(e) });
    }
    if (owing.length > 0) {
      await tx.registration.updateMany({
        where: { id: { in: owing.map((e) => e.id) } },
        data: { cancelRefundStatus: "PENDING", cancelRefundError: null },
      });
    }

    // Free and external entries have nothing to refund. Their places go.
    const freeEntries = await tx.registration.findMany({
      where: { eventId: event.id, stripePaymentIntentId: null, status: { in: [...HELD_STATUSES] } },
      select: { id: true, athleteEmail: true, userId: true },
    });
    for (const e of freeEntries) owedByEntry.set(e.id, { email: e.athleteEmail, userId: e.userId, cents: 0 });
    if (freeEntries.length > 0) {
      await tx.registration.updateMany({
        where: { id: { in: freeEntries.map((e) => e.id) } },
        data: { status: "CANCELLED" },
      });
    }

    // Refund tickets for this event are settled by the cancellation.
    await tx.supportTicket.updateMany({
      where: { eventId: event.id, requestType: "refund", status: { in: ["OPEN", "APPROVED"] } },
      data: {
        status: "REFUNDED",
        adminNote: "Event cancelled. Everything paid is refunded in full, booking fee included.",
      },
    });

    return freeEntries.length;
  });

  await cancelEventSchedules(event.id).catch((err) =>
    console.error("Event schedule cleanup failed:", err),
  );

  const summary = await processCancellationRefunds(event.id);

  await notifyCancellation({
    eventId: event.id,
    eventTitle: event.title,
    eventDate: event.eventDate,
    organiserId: event.organiserId,
    reason,
    cancelledBy: opts.actor.role,
    owed: [...owedByEntry.values()],
  }).catch((err) => console.error("Cancellation notify failed:", err));

  return { ...summary, released, alreadyCancelled: false };
}

/**
 * Refund every entry of a cancelled event that is still owed. Safe to run
 * any number of times, concurrently or not: each refund carries an
 * idempotency key and metadata naming the entry, and the row only moves once.
 * Never throws for a single entry; its failure is recorded for the next run.
 */
export async function processCancellationRefunds(
  eventId: string,
  opts: {
    /** Retry failures now, ignoring the retry gap. "Retry now" sets this. */
    includeRecentFailures?: boolean;
    limit?: number;
    now?: Date;
  } = {},
): Promise<CancellationSummary> {
  const now = opts.now ?? new Date();
  const entries = await prisma.registration.findMany({
    where: dueForRefund(eventId, now, opts.includeRecentFailures ?? false),
    select: { ...owedSelect, cancelRefundStatus: true },
    // Never-tried rows first, then the longest-waiting failures.
    orderBy: [{ cancelRefundAttemptAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: opts.limit ?? CANCEL_REFUNDS_PER_RUN,
  });

  const summary: CancellationSummary = { refunded: 0, failed: 0, released: 0, refundedCents: 0, outstanding: 0 };

  for (const entry of entries) {
    const owed = entryCancellationOwedCents(entry);
    const paid = entryPaidCents(entry);
    if (owed <= 0 || !entry.stripePaymentIntentId) {
      await prisma.registration.updateMany({
        where: { id: entry.id, cancelRefundStatus: { in: CANCEL_REFUND_OPEN } },
        data: { cancelRefundStatus: "DONE", cancelRefundError: null, cancelRefundAttemptAt: now, status: "REFUNDED" },
      });
      continue;
    }

    try {
      const refundId =
        (await findCancellationRefund(entry.stripePaymentIntentId, entry.id)) ??
        (await refundEntryCharge({
          paymentIntentId: entry.stripePaymentIntentId,
          amountCents: owed,
          // Distinct from the reviewed refund's key, so a top-up after a policy
          // refund is not mistaken for that refund.
          idempotencyKey: `event-cancel-refund-${entry.id}`,
          refundApplicationFee: true,
          metadata: { registrationId: entry.id, reason: "event_cancelled" },
        })).id;

      const recorded = await prisma.registration.updateMany({
        where: { id: entry.id, cancelRefundStatus: { in: CANCEL_REFUND_OPEN } },
        data: {
          status: "REFUNDED",
          refundAmountCents: paid,
          cancelRefundStatus: "DONE",
          cancelRefundId: refundId,
          cancelRefundError: null,
          cancelRefundAttemptAt: now,
        },
      });
      if (recorded.count === 1) {
        summary.refunded++;
        summary.refundedCents += owed;
      }
    } catch (err) {
      summary.failed++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Cancellation refund failed for registration ${entry.id}:`, message);
      await prisma.registration.updateMany({
        where: { id: entry.id, cancelRefundStatus: { in: CANCEL_REFUND_OPEN } },
        data: { cancelRefundStatus: "FAILED", cancelRefundError: message.slice(0, 500), cancelRefundAttemptAt: now },
      });
    }
  }

  summary.outstanding = await prisma.registration.count({
    where: { eventId, cancelRefundStatus: { in: CANCEL_REFUND_OPEN } },
  });
  return summary;
}

/**
 * A refund this entry already got for the cancellation, if one exists. Stripe
 * forgets an idempotency key after 24 hours, so a refund that succeeded at
 * Stripe but was never recorded here (the process died in between) would be
 * made a second time by a later retry. The metadata finds it instead.
 */
async function findCancellationRefund(paymentIntentId: string, registrationId: string): Promise<string | null> {
  const refunds = await getStripe().refunds.list({ payment_intent: paymentIntentId, limit: 100 });
  const match = refunds.data.find(
    (r) =>
      r.metadata?.registrationId === registrationId &&
      r.metadata?.reason === "event_cancelled" &&
      r.status !== "failed" &&
      r.status !== "canceled",
  );
  return match?.id ?? null;
}

/**
 * Cancelled events with a refund due now, for the worker's one-minute sweep.
 * A failure inside its retry gap does not count, so a stuck refund is retried
 * every CANCEL_REFUND_RETRY_GAP_MS, not every minute.
 */
export async function eventsOwingCancellationRefunds(limit = 5, now: Date = new Date()): Promise<string[]> {
  const rows = await prisma.registration.findMany({
    where: dueForRefund(undefined, now, false),
    select: { eventId: true },
    distinct: ["eventId"],
    take: limit,
  });
  return rows.map((r) => r.eventId);
}

async function notifyCancellation(input: {
  eventId: string;
  eventTitle: string;
  eventDate: string | null;
  organiserId: string;
  reason: string | null;
  cancelledBy: "organiser" | "admin";
  owed: { email: string; userId: string | null; cents: number }[];
}) {
  // One email per address: a group booking's rows often share the buyer's.
  const byEmail = new Map<string, { to: string; cents: number }>();
  const byUser = new Map<string, number>();
  for (const o of input.owed) {
    const to = o.email?.trim();
    if (to && to.includes("@")) {
      const key = to.toLowerCase();
      const existing = byEmail.get(key);
      byEmail.set(key, { to: existing?.to ?? to, cents: (existing?.cents ?? 0) + o.cents });
    }
    if (o.userId) byUser.set(o.userId, (byUser.get(o.userId) ?? 0) + o.cents);
  }

  if (byUser.size > 0) {
    await prisma.userNotification.createMany({
      data: [...byUser.entries()].map(([userId, cents]) => ({
        userId,
        type: "EVENT_CANCELLED" as const,
        title: "Event cancelled",
        body:
          cents > 0
            ? `${input.eventTitle} has been cancelled. You are being refunded $${(cents / 100).toFixed(2)}, everything you paid including the booking fee. Allow 5 to 10 business days.`
            : `${input.eventTitle} has been cancelled and your entry released.`,
        eventId: input.eventId,
      })),
    });
  }

  await prisma.notification.create({
    data: {
      organiserId: input.organiserId,
      eventId: input.eventId,
      type: "EVENT_CANCELLED",
      title: "Event cancelled",
      body:
        input.cancelledBy === "admin"
          ? `Startline cancelled "${input.eventTitle}". Every entrant is being refunded in full.`
          : `"${input.eventTitle}" is cancelled. Every entrant is being refunded in full.`,
    },
  });

  await sendEventCancelledEmails(
    [...byEmail.values()].map(({ to, cents }) => ({
      to,
      data: {
        eventTitle: input.eventTitle,
        eventDate: input.eventDate,
        refundCents: cents,
        reason: input.reason,
      },
    })),
  );
}

/** What a cancellation would refund, for the confirm dialog. */
export async function cancellationPreview(eventId: string): Promise<{ entries: number; paidEntries: number; refundCents: number }> {
  const rows = await prisma.registration.findMany({
    where: { eventId, status: { in: [...HELD_STATUSES, "REFUNDED"] } },
    select: owedSelect,
  });
  let paidEntries = 0;
  let refundCents = 0;
  let entries = 0;
  for (const r of rows) {
    if (r.status !== "REFUNDED") entries++;
    if (!r.stripePaymentIntentId) continue;
    const owed = entryCancellationOwedCents(r);
    if (owed > 0) {
      paidEntries++;
      refundCents += owed;
    }
  }
  return { entries, paidEntries, refundCents };
}

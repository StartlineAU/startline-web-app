import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import {
  buildRefundParams,
  entryRefundAmountCents,
  isOutsidePolicyRefund,
} from "@/lib/stripe-refunds";

/**
 * Issue the Stripe refund for one registration and mark it REFUNDED.
 *
 * The amount follows the organisation's refund policy, frozen onto the entry
 * when the request was raised, and keeps Startline's booking fee. The organiser
 * decides on the support ticket first and Startline issues the refund (#570).
 * A cancelled event is different: lib/event-cancellation.ts refunds everything.
 */

const REFUNDABLE_STATUSES: ("CONFIRMED" | "REFUND_REQUESTED")[] = ["CONFIRMED", "REFUND_REQUESTED"];

export class RefundError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "RefundError";
  }
}

export const refundEntrySelect = {
  id: true,
  status: true,
  amountCents: true,
  platformFeeCents: true,
  feeStructure: true,
  refundAmountCents: true,
  refundPercent: true,
  stripePaymentIntentId: true,
  cancelRefundStatus: true,
  athleteName: true,
  userId: true,
  eventId: true,
  event: { select: { id: true, title: true } },
} as const;

export interface RefundEntry {
  id: string;
  status: string;
  amountCents: number;
  platformFeeCents: number;
  feeStructure: string;
  refundAmountCents: number | null;
  stripePaymentIntentId: string | null;
  /** Set once the event is cancelled: the full refund is handled there. */
  cancelRefundStatus?: string | null;
  athleteName: string;
  userId: string | null;
  eventId: string;
  event: { id: string; title: string };
}

export interface RefundOptions {
  /**
   * Status written once the money has moved. REMOVED when an organiser takes
   * the athlete out of the event (lib/remove-registration.ts, #571).
   */
  finalStatus?: "REFUNDED" | "REMOVED";
  /** Further columns written in the same update, such as releasing the bib. */
  extraData?: Prisma.RegistrationUncheckedUpdateManyInput;
  /** False when the caller sends its own message instead of "Refund processed". */
  notify?: boolean;
}

export interface RefundResult {
  method: "free" | "stripe";
  refundId: string | null;
  refundCents: number;
}

/**
 * Refund part of a registration payment's charge on Stripe. Shared by a single
 * reviewed refund (below) and a cancelled event (lib/event-cancellation.ts).
 *
 * The charge (and its transfer) are expanded because the refund needs facts
 * only they carry: whether there is a transfer to reverse and an application
 * fee to keep or return. Checkout omits both for a direct charge, and Stripe
 * rejects a refund that claims either one is there when it is not.
 */
export async function refundEntryCharge(opts: {
  paymentIntentId: string;
  amountCents: number;
  idempotencyKey: string;
  refundApplicationFee?: boolean;
  metadata?: Record<string, string>;
}): Promise<{ id: string }> {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(opts.paymentIntentId, {
    expand: ["latest_charge", "latest_charge.transfer"],
  });
  const charge = paymentIntent.latest_charge;
  if (!charge) throw new RefundError("No charge found on this payment intent.", 422, "NO_CHARGE");
  // A bare id means the expansion did not come back and we cannot prove what
  // the charge carries. Guessing moves real money the wrong way either way.
  if (typeof charge === "string") {
    throw new RefundError("Could not read the charge for this payment. Try again in a moment.", 502, "CHARGE_UNREADABLE");
  }

  return stripe.refunds.create(
    ...buildRefundParams({
      chargeId: charge.id,
      amountCents: opts.amountCents,
      idempotencyKey: opts.idempotencyKey,
      hasTransfer: Boolean(charge.transfer),
      hasApplicationFee: Boolean(charge.application_fee),
      refundApplicationFee: opts.refundApplicationFee,
      metadata: opts.metadata,
    }),
  );
}

export async function issueEntryRefund(
  entry: RefundEntry,
  options: RefundOptions = {},
): Promise<RefundResult> {
  const finalStatus = options.finalStatus ?? "REFUNDED";
  const notify = options.notify ?? true;
  // A cancelled event refunds this entry in full by itself. A reviewed partial
  // refund issued alongside would race it and leave the totals wrong.
  if (entry.cancelRefundStatus) {
    throw new RefundError(
      "This event was cancelled, so this entry is being refunded in full automatically. Retry it from the event page if it failed.",
      409,
      "EVENT_CANCELLED",
    );
  }
  if (entry.status !== "CONFIRMED" && entry.status !== "REFUND_REQUESTED") {
    throw new RefundError(
      "Only confirmed or refund-requested registrations can be refunded.",
      409,
      "NOT_REFUNDABLE",
    );
  }

  // Free or external registration: nothing to send back, just release the spot.
  if (!entry.stripePaymentIntentId) {
    const released = await prisma.registration.updateMany({
      where: { id: entry.id, status: { in: REFUNDABLE_STATUSES } },
      data: { ...options.extraData, status: finalStatus },
    });
    if (released.count !== 1) {
      throw new RefundError("This registration changed a moment ago. Refresh and try again.", 409, "STALE");
    }
    if (notify) await notifyAthlete(entry, 0);
    return { method: "free", refundId: null, refundCents: 0 };
  }

  if (isOutsidePolicyRefund(entry)) {
    throw new RefundError(
      "This request is outside the organisation's refund policy. Refund a different amount manually in Stripe if it is being granted as a goodwill exception.",
      409,
      "OUTSIDE_POLICY",
    );
  }
  // The amount is explicit: an amountless refund returns the whole charge, which
  // on a group booking is every participant's entry.
  const refundCents = entryRefundAmountCents(entry);

  const refund = await refundEntryCharge({
    paymentIntentId: entry.stripePaymentIntentId,
    amountCents: refundCents,
    // Retrying a failed request must not refund the athlete twice. Stripe
    // expires an idempotency key after 24 hours, so a refund that failed
    // for a transient reason can still be retried tomorrow.
    idempotencyKey: `entry-refund-${entry.id}`,
  });

  // The refund is idempotent per entry, so a concurrent second attempt gets the
  // same refund back. Only one of them moves the row; the other finds it
  // already REFUNDED and reports the same result without notifying twice.
  const recorded = await prisma.registration.updateMany({
    where: { id: entry.id, status: { in: REFUNDABLE_STATUSES } },
    data: {
      ...options.extraData,
      status: finalStatus,
      stripeRefundId: refund.id,
      refundAmountCents: refundCents,
    },
  });
  if (recorded.count !== 1) {
    return { method: "stripe", refundId: refund.id, refundCents };
  }

  if (notify) await notifyAthlete(entry, refundCents);

  return { method: "stripe", refundId: refund.id, refundCents };
}

// Tell the athlete their refund went through. Best-effort: the status change is
// what matters, so a notification failure must never fail a completed refund.
async function notifyAthlete(entry: RefundEntry, cents: number): Promise<void> {
  if (!entry.userId) return;
  try {
    await prisma.userNotification.create({
      data: {
        userId: entry.userId,
        type: "REFUND_PROCESSED",
        title: "Refund processed",
        body:
          cents > 0
            ? `Your refund of $${(cents / 100).toFixed(2)} for ${entry.event.title} is on its way ` +
              `back to your original payment method. Allow 5 to 10 business days.`
            : `Your entry to ${entry.event.title} has been cancelled and released.`,
        eventId: entry.event.id,
      },
    });
  } catch {
    // Swallowed on purpose — see above.
  }
}

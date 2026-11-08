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
 * when the request was raised, and keeps Startline's booking fee. Every refund
 * is reviewed first — by the organiser and by Startline — from a support ticket.
 * Nothing here is automatic.
 */

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
  athleteName: string;
  userId: string | null;
  eventId: string;
  event: { id: string; title: string };
}

export interface RefundResult {
  method: "free" | "stripe";
  refundId: string | null;
  refundCents: number;
}

export async function issueEntryRefund(entry: RefundEntry): Promise<RefundResult> {
  if (entry.status !== "CONFIRMED" && entry.status !== "REFUND_REQUESTED") {
    throw new RefundError(
      "Only confirmed or refund-requested registrations can be refunded.",
      409,
      "NOT_REFUNDABLE",
    );
  }

  // Free or external registration: nothing to send back, just release the spot.
  if (!entry.stripePaymentIntentId) {
    await prisma.registration.update({
      where: { id: entry.id },
      data: { status: "REFUNDED" },
    });
    await notifyAthlete(entry, 0);
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

  const stripe = getStripe();
  // The charge (and its transfer) are expanded because the refund needs facts
  // only they carry: whether there is a transfer to reverse and an application
  // fee to keep. Checkout omits both for a direct charge, and Stripe rejects a
  // refund that claims either one is there when it is not.
  const paymentIntent = await stripe.paymentIntents.retrieve(entry.stripePaymentIntentId, {
    expand: ["latest_charge", "latest_charge.transfer"],
  });
  const charge = paymentIntent.latest_charge;
  if (!charge) throw new RefundError("No charge found on this payment intent.", 422, "NO_CHARGE");
  // A bare id means the expansion did not come back and we cannot prove what
  // the charge carries. Guessing moves real money the wrong way either way.
  if (typeof charge === "string") {
    throw new RefundError("Could not read the charge for this payment. Try again in a moment.", 502, "CHARGE_UNREADABLE");
  }

  const refund = await stripe.refunds.create(
    ...buildRefundParams({
      chargeId: charge.id,
      amountCents: refundCents,
      // Retrying a failed request must not refund the athlete twice. Stripe
      // expires an idempotency key after 24 hours, so a refund that failed
      // for a transient reason can still be retried tomorrow.
      idempotencyKey: `entry-refund-${entry.id}`,
      hasTransfer: Boolean(charge.transfer),
      hasApplicationFee: Boolean(charge.application_fee),
    }),
  );

  await prisma.registration.update({
    where: { id: entry.id },
    data: {
      status: "REFUNDED",
      stripeRefundId: refund.id,
      refundAmountCents: refundCents,
    },
  });

  await notifyAthlete(entry, refundCents);

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

import type Stripe from "stripe";
import type { RefundType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import {
  buildFullRefundParams,
  buildRefundParams,
  entryPaidCents,
  entryRefundAmountCents,
  isOutsidePolicyRefund,
} from "@/lib/stripe-refunds";

/**
 * Issue the Stripe refund for one registration and mark it REFUNDED.
 *
 * NORMAL follows the event's refund tiers (the snapshot frozen when the athlete
 * asked) and keeps Startline's booking fee, exactly as the admin refund always
 * has. FULL returns everything the athlete paid and recovers the whole amount
 * from the organiser: it is only ever issued because the organiser changed the
 * event after the athlete entered (#490).
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
  refundType: true,
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
  refundType: RefundType | null;
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
  type: RefundType;
  /** FULL only: what is still to be recovered from the organiser. */
  recoveryOutstandingCents: number;
}

export async function issueEntryRefund(entry: RefundEntry, type: RefundType): Promise<RefundResult> {
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
      data: { status: "REFUNDED", refundType: type },
    });
    await notifyAthlete(entry, 0);
    return { method: "free", refundId: null, refundCents: 0, type, recoveryOutstandingCents: 0 };
  }

  // NORMAL honours the snapshot taken when the athlete asked, clamped to what
  // THIS entry's payer actually handed over. FULL is everything they paid.
  // Either way the amount is explicit: an amountless refund returns the whole
  // charge, which on a group booking is every participant's entry.
  if (type === "NORMAL" && isOutsidePolicyRefund(entry)) {
    throw new RefundError(
      "This request is outside the event's refund policy. Refund a different amount manually in Stripe if it is being granted as a goodwill exception.",
      409,
      "OUTSIDE_POLICY",
    );
  }
  const refundCents = type === "FULL" ? entryPaidCents(entry) : entryRefundAmountCents(entry);

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

  const hasTransfer = Boolean(charge.transfer);
  const hasApplicationFee = Boolean(charge.application_fee);

  const refund = type === "FULL"
    ? await stripe.refunds.create(
        ...buildFullRefundParams({
          chargeId: charge.id,
          amountCents: refundCents,
          idempotencyKey: `entry-full-refund-${entry.id}`,
          hasApplicationFee,
        }),
      )
    : await stripe.refunds.create(
        ...buildRefundParams({
          chargeId: charge.id,
          amountCents: refundCents,
          // Retrying a failed request must not refund the athlete twice. Stripe
          // expires an idempotency key after 24 hours, so a refund that failed
          // for a transient reason can still be retried tomorrow.
          idempotencyKey: `entry-refund-${entry.id}`,
          hasTransfer,
          hasApplicationFee,
        }),
      );

  // The athlete has their money from here on, so the row is REFUNDED whatever
  // happens to the recovery below. The organiser owes what the athlete got back
  // only when the charge actually transferred funds to them.
  const owed = type === "FULL" && hasTransfer ? refundCents : 0;
  await prisma.registration.update({
    where: { id: entry.id },
    data: {
      status: "REFUNDED",
      refundType: type,
      stripeRefundId: refund.id,
      ...(type === "FULL" ? { refundAmountCents: refundCents, refundPercent: 100 } : {}),
      organiserRecoveryOwedCents: owed,
    },
  });

  const recoveryOutstandingCents = owed > 0
    ? await recoverOrganiserCost(entry.id, charge).catch((err) => {
        console.error("Organiser cost recovery failed:", err);
        return owed;
      })
    : 0;

  await notifyAthlete(entry, refundCents);

  return { method: "stripe", refundId: refund.id, refundCents, type, recoveryOutstandingCents };
}

/**
 * Reverse what a FULL refund cost from the organiser's transfers for the same
 * event: this entry's own transfer first, then the event's other confirmed
 * payments, until the amount owed is recovered. Returns what is still owed.
 *
 * Each reversal's idempotency key carries the amount recovered before it, so a
 * retry after a crash between Stripe and the database replays the same
 * reversal rather than taking a second one. Anything still owed stays on the
 * registration for an admin to see; the payout is reduced regardless
 * (lib/payout.ts), so the organiser is never overpaid.
 */
export async function recoverOrganiserCost(
  registrationId: string,
  ownCharge?: Stripe.Charge,
): Promise<number> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true, eventId: true, stripePaymentIntentId: true,
      organiserRecoveryOwedCents: true, organiserRecoveredCents: true,
    },
  });
  if (!reg) return 0;

  let recovered = reg.organiserRecoveredCents;
  let need = reg.organiserRecoveryOwedCents - recovered;
  if (need <= 0) return 0;

  const stripe = getStripe();
  const others = await prisma.registration.findMany({
    where: {
      eventId: reg.eventId,
      status: "CONFIRMED",
      stripePaymentIntentId: { not: null },
      NOT: { stripePaymentIntentId: reg.stripePaymentIntentId },
    },
    select: { stripePaymentIntentId: true },
    distinct: ["stripePaymentIntentId"],
    take: 25,
  });
  const candidates = [
    reg.stripePaymentIntentId,
    ...others.map((o) => o.stripePaymentIntentId),
  ].filter((pi): pi is string => !!pi);

  for (const pi of candidates) {
    if (need <= 0) break;
    let charge: Stripe.Charge | null = null;
    if (ownCharge && pi === reg.stripePaymentIntentId) {
      charge = ownCharge;
    } else {
      const intent = await stripe.paymentIntents.retrieve(pi, { expand: ["latest_charge.transfer"] });
      charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    }
    const transfer = charge?.transfer;
    if (!transfer || typeof transfer === "string") continue;

    const headroom = transfer.amount - transfer.amount_reversed;
    const amount = Math.min(need, headroom);
    if (amount <= 0) continue;

    await stripe.transfers.createReversal(
      transfer.id,
      {
        amount,
        metadata: { registrationId: reg.id, reason: "full_refund_event_change" },
      },
      { idempotencyKey: `full-refund-recovery-${reg.id}-${recovered}` },
    );
    recovered += amount;
    need -= amount;
    await prisma.registration.update({
      where: { id: reg.id },
      data: { organiserRecoveredCents: recovered },
    });
  }

  return need;
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

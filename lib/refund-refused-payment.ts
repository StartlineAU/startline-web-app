import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

/**
 * Give back a payment we will not turn into entries.
 *
 * A PaymentIntent can succeed after the order stopped being acceptable: the
 * event filled while the athlete was paying, the price or event changed, or the
 * organisation was suspended. Recording the entry as CANCELLED is not enough on
 * its own, because the money has already been charged (and, for a Connect
 * charge, transferred to the organiser). Nothing else refunds a CANCELLED row,
 * so this does, in full.
 *
 * The transfer to the connected account is reversed. The application fee is not
 * handed to the organiser (refund_application_fee stays off): the platform
 * returns its own share from the fee it collected, so neither side keeps any of
 * the athlete's money.
 *
 * The idempotency key makes a webhook retry safe: Stripe returns the first
 * refund instead of making a second one. The caller records the refusal only
 * after this succeeds, so a failed refund leaves nothing behind that would stop
 * the retry from refunding.
 */
export async function refundRefusedPayment(paymentIntent: Stripe.PaymentIntent): Promise<string | null> {
  if (!paymentIntent.amount_received || paymentIntent.amount_received <= 0) return null;

  const refund = await getStripe().refunds.create(
    {
      payment_intent: paymentIntent.id,
      ...(paymentIntent.transfer_data?.destination ? { reverse_transfer: true } : {}),
      metadata: { reason: "registration_refused" },
    },
    { idempotencyKey: `refused-payment-refund-${paymentIntent.id}` },
  );
  return refund.id;
}

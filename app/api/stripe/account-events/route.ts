import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { ACCOUNT_EVENT_TYPES, isOnboardingComplete, retrieveConnectStatus } from "@/lib/stripe-connect";

/**
 * Event destination for Accounts v2 (issue #379).
 *
 * v2 account events are thin events: they arrive through a Stripe event
 * destination, not the v1 webhook endpoint at /api/stripe/webhook, are signed
 * with that destination's own secret, and carry only the account id. The
 * account is read back from Stripe so the capability check is the same one the
 * status route makes.
 *
 * The destination subscribes to ACCOUNT_EVENT_TYPES.
 */
const HANDLED = new Set<string>(ACCOUNT_EVENT_TYPES);

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_ACCOUNT_EVENTS_SECRET?.trim();
  if (!secret || !isStripeConfigured()) {
    console.error("Stripe account events: STRIPE_ACCOUNT_EVENTS_SECRET or STRIPE_SECRET_KEY is not set.");
    return NextResponse.json({ error: "Account events are not configured." }, { status: 503 });
  }

  const stripe = getStripe();
  const body = await req.text();

  let notification;
  try {
    notification = stripe.parseEventNotification(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  // Every account event names the account; a few other event types in the
  // SDK's union have no related object at all.
  const accountId = "related_object" in notification ? notification.related_object?.id : undefined;
  if (!HANDLED.has(notification.type) || !accountId) {
    return NextResponse.json({ received: true });
  }

  try {
    const status = await retrieveConnectStatus(stripe, accountId);
    if (isOnboardingComplete(status)) {
      await prisma.organiser.updateMany({
        where: { stripeAccountId: accountId, stripeOnboardingComplete: false },
        data:  { stripeOnboardingComplete: true },
      });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    // Non-2xx so Stripe retries the delivery.
    console.error("Stripe account events error:", { type: notification.type, accountId, err });
    return NextResponse.json({ error: "Account event handler failed." }, { status: 500 });
  }
}

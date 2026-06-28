import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { awardRegistrationPoints } from "@/lib/user-points";

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return secret;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") ?? "";

    const stripe = getStripe();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret());
    } catch {
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const meta = paymentIntent.metadata;
  const eventId = meta.eventId;
  const organiserId = meta.organiserId;

  if (!eventId || !organiserId) {
    console.error("Missing metadata on PaymentIntent:", paymentIntent.id);
    return;
  }

  const existing = await prisma.registration.findUnique({
    where: { stripePaymentIntentId: paymentIntent.id },
  });
  if (existing) return;

  let userId = meta.userId || null;
  if (!userId && meta.userEmail) {
    const user = await prisma.user.findUnique({
      where: { email: meta.userEmail.trim().toLowerCase() },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  const registration = await prisma.registration.create({
    data: {
      eventId,
      organiserId,
      userId,
      athleteName: meta.userName ?? "Unknown",
      athleteEmail: meta.userEmail ?? "",
      category: meta.category || null,
      waveLabel: meta.waveLabel || null,
      amountCents: parseInt(meta.ticketPriceCents ?? "0", 10),
      platformFeeCents: parseInt(meta.platformFeeCents ?? "0", 10),
      feeStructure: meta.feeStructure ?? "athlete",
      status: "CONFIRMED",
      stripePaymentIntentId: paymentIntent.id,
    },
  });

  if (userId) {
    await awardRegistrationPoints(userId, registration.id).catch((err) =>
      console.error("Failed to award registration points:", err),
    );
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true },
  });

  await prisma.notification.create({
    data: {
      organiserId,
      eventId,
      type: "NEW_REGISTRATION",
      title: "New registration",
      body: `${meta.userName} registered for ${event?.title ?? "your event"}`,
    },
  }).catch(err => console.error("Failed to create notification:", err));
}

async function handleAccountUpdated(account: Stripe.Account) {
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;

  if (chargesEnabled && payoutsEnabled) {
    await prisma.organiser.updateMany({
      where: { stripeAccountId: account.id, stripeOnboardingComplete: false },
      data: { stripeOnboardingComplete: true },
    });
  }
}

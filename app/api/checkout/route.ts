import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { calculateTotalWithFee } from "@/lib/platform-fee";
import { getUserSession } from "@/lib/amplify-server";

function isDevDirectChargeEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.STRIPE_DEV_DIRECT_CHARGE === "true"
  );
}

function checkoutError(message: string, status: number, detail?: string) {
  return NextResponse.json(
    {
      error: message,
      ...(process.env.NODE_ENV === "development" && detail ? { detail } : {}),
    },
    { status },
  );
}

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
    if (!secretKey.startsWith("sk_")) {
      return checkoutError(
        "Invalid Stripe secret key.",
        503,
        "STRIPE_SECRET_KEY must be a standard secret key (sk_test_...). Restricted keys (rk_...) cannot create payments.",
      );
    }

    const body = await req.json() as {
      eventId: string;
      waveLabel: string;
      userName: string;
      userEmail: string;
      category: string;
    };
    const { eventId, waveLabel, userName, userEmail, category } = body;

    if (!eventId || !waveLabel || !userName || !userEmail) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const devDirectCharge = isDevDirectChargeEnabled();

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true, title: true, status: true, feeStructure: true, registrationType: true,
        waves: true,
        organiser: { select: { id: true, stripeAccountId: true, stripeOnboardingComplete: true } },
      },
    });

    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (event.status !== "APPROVED") {
      return NextResponse.json({ error: "This event is not currently accepting registrations." }, { status: 409 });
    }
    if (event.registrationType !== "startline") {
      return NextResponse.json({ error: "This event uses external registration." }, { status: 400 });
    }
    if (
      !devDirectCharge &&
      (!event.organiser.stripeOnboardingComplete || !event.organiser.stripeAccountId)
    ) {
      return NextResponse.json({ error: "This event is not ready to accept payments." }, { status: 409 });
    }

    const waves = event.waves as { label: string; price: string; qty?: number }[] | null;
    if (!Array.isArray(waves)) return NextResponse.json({ error: "No ticket tiers configured." }, { status: 400 });

    const wave = waves.find((w) => w.label === waveLabel);
    if (!wave) return NextResponse.json({ error: "Selected ticket tier not found." }, { status: 400 });

    const ticketPriceCents = Math.round(parseFloat(wave.price || "0") * 100);
    if (ticketPriceCents <= 0) return NextResponse.json({ error: "Invalid ticket price." }, { status: 400 });

    const { totalCents, platformFeeCents } = calculateTotalWithFee(
      ticketPriceCents,
      event.feeStructure,
    );

    const stripe = getStripe();
    const session = await getUserSession();

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: totalCents,
      currency: "aud",
      metadata: {
        eventId,
        waveLabel,
        userName,
        userEmail,
        category: category || "",
        organiserId: event.organiser.id,
        ticketPriceCents: String(ticketPriceCents),
        platformFeeCents: String(platformFeeCents),
        feeStructure: event.feeStructure,
        ...(devDirectCharge ? { devDirectCharge: "true" } : {}),
        ...(session ? { userId: session.sub } : {}),
      },
    };

    if (devDirectCharge) {
      // Local dev: charge the platform account directly (no Connect destination).
      paymentIntentParams.automatic_payment_methods = { enabled: true };
    } else {
      paymentIntentParams.application_fee_amount = platformFeeCents;
      paymentIntentParams.transfer_data = {
        destination: event.organiser.stripeAccountId!,
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalCents / 100,
      platformFee: platformFeeCents / 100,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Checkout error:", err);
    return checkoutError("Failed to create payment.", 503, message);
  }
}

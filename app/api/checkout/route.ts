import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { calculateTotalWithFee } from "@/lib/platform-fee";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      eventId: string;
      waveLabel: string;
      customerName: string;
      customerEmail: string;
      category: string;
    };
    const { eventId, waveLabel, customerName, customerEmail, category } = body;

    if (!eventId || !waveLabel || !customerName || !customerEmail) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true, title: true, status: true, feeStructure: true, registrationType: true,
        waves: true,
        organiser: { select: { id: true, stripeAccountId: true, stripeOnboardingComplete: true } },
      },
    });

    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (event.status !== "APPROVED") return NextResponse.json({ error: "This event is not currently accepting registrations." }, { status: 409 });
    if (event.registrationType !== "startline") return NextResponse.json({ error: "This event uses external registration." }, { status: 400 });
    if (!event.organiser.stripeOnboardingComplete || !event.organiser.stripeAccountId) {
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
      event.feeStructure
    );

    const stripe = getStripe();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "aud",
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: event.organiser.stripeAccountId,
      },
      metadata: {
        eventId,
        waveLabel,
        customerName,
        customerEmail,
        category: category || "",
        organiserId: event.organiser.id,
        ticketPriceCents: String(ticketPriceCents),
        platformFeeCents: String(platformFeeCents),
        feeStructure: event.feeStructure,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalCents / 100,
      platformFee: platformFeeCents / 100,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Failed to create payment." }, { status: 503 });
  }
}

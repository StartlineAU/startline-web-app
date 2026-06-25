import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { sendRegistrationConfirmationEmail } from "@/lib/email";
import {
  expandCompactParticipant,
  athleteNameFromParticipant,
  type CompactParticipant,
} from "@/lib/registration-form";

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return secret;
}

function parseParticipantsFromMetadata(meta: Stripe.Metadata): CompactParticipant[] {
  const participantCount = parseInt(meta.participantCount ?? "0", 10);
  if (participantCount > 0) {
    const participants: CompactParticipant[] = [];
    for (let i = 0; i < participantCount; i++) {
      const raw = meta[`participant${i}`];
      if (!raw) continue;
      participants.push(JSON.parse(raw) as CompactParticipant);
    }
    if (participants.length > 0) return participants;
  }

  if (meta.firstName || meta.userName) {
    return [{
      fn: meta.firstName ?? meta.userName?.split(" ")[0] ?? "",
      ln: meta.lastName ?? meta.userName?.split(" ").slice(1).join(" ") ?? "",
      dob: meta.dateOfBirth ?? "",
      em: (meta.userEmail ?? "").toLowerCase(),
      mob: meta.mobile ?? "",
      ecn: meta.emergencyContactName ?? "",
      ecp: meta.emergencyContactPhone ?? "",
    }];
  }

  return [];
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

  const existingCount = await prisma.registration.count({
    where: { stripePaymentIntentId: paymentIntent.id },
  });
  if (existingCount > 0) return;

  const participants = parseParticipantsFromMetadata(meta);
  if (participants.length === 0) {
    console.error("No participant data on PaymentIntent:", paymentIntent.id);
    return;
  }

  const ticketPriceCents = parseInt(meta.ticketPriceCents ?? "0", 10);
  const platformFeePerTicket = parseInt(
    meta.platformFeeCentsPerTicket ?? meta.platformFeeCents ?? "0",
    10
  );

  await prisma.registration.createMany({
    data: participants.map((participant) => {
      const expanded = expandCompactParticipant(participant);
      return {
        eventId,
        organiserId,
        userId: meta.userId || null,
        athleteName: athleteNameFromParticipant(participant),
        athleteEmail: participant.em,
        firstName: expanded.firstName,
        lastName: expanded.lastName,
        dateOfBirth: expanded.dateOfBirth,
        mobile: expanded.mobile,
        emergencyContactName: expanded.emergencyContactName,
        emergencyContactPhone: expanded.emergencyContactPhone,
        waiverAccepted: true,
        waveLabel: meta.waveLabel || null,
        amountCents: ticketPriceCents,
        platformFeeCents: platformFeePerTicket,
        feeStructure: meta.feeStructure ?? "athlete",
        status: "CONFIRMED" as const,
        stripePaymentIntentId: paymentIntent.id,
      };
    }),
  });

  const dbEvent = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      title: true,
      eventDate: true,
      startTime: true,
      venue: true,
      city: true,
    },
  });

  const participantNames = participants.map((p) => athleteNameFromParticipant(p));
  const notificationBody = participants.length === 1
    ? `${participantNames[0]} registered for ${dbEvent?.title ?? "your event"}`
    : `${participants.length} participants registered for ${dbEvent?.title ?? "your event"}: ${participantNames.join(", ")}`;

  await prisma.notification.create({
    data: {
      organiserId,
      eventId,
      type: "NEW_REGISTRATION",
      title: participants.length === 1 ? "New registration" : "New group registration",
      body: notificationBody,
    },
  }).catch(err => console.error("Failed to create notification:", err));

  if (dbEvent) {
    for (const participant of participants) {
      if (!participant.em) continue;
      await sendRegistrationConfirmationEmail({
        athleteEmail: participant.em,
        athleteName: athleteNameFromParticipant(participant),
        eventTitle: dbEvent.title,
        eventDate: dbEvent.eventDate,
        startTime: dbEvent.startTime,
        venue: dbEvent.venue,
        city: dbEvent.city,
        waveLabel: meta.waveLabel || null,
        amountCents: ticketPriceCents,
        eventId,
        idempotencyKey: `${paymentIntent.id}:${participant.em}`,
      }).catch((err) => console.error("Failed to send registration confirmation email:", err));
    }
  }
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

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { parseParticipantsFromMetadata } from "@/lib/stripe-webhook";
import { calculateTotalWithFee } from "@/lib/platform-fee";
import {
  announceRegistrations,
  ensureParticipantUsers,
  insertConfirmedRegistrations,
  type PricedEntry,
} from "@/lib/registration-confirm";
import { athleteNameFromParticipant, type CompactParticipant } from "@/lib/registration-form";
import { refundRefusedPayment } from "@/lib/refund-refused-payment";
import { lockEventEntries } from "@/lib/event-entry-lock";

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

    // Events from a connected account describe that account's own payments,
    // not a checkout on the platform. This endpoint only handles the platform's.
    if (event.account) return NextResponse.json({ received: true });

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

  // Every checkout PaymentIntent carries both. One without them was not made by
  // checkout, so it is not ours to confirm or to refund.
  if (!eventId || !organiserId) {
    console.error("Missing metadata on PaymentIntent:", paymentIntent.id);
    return;
  }

  // Fast path for a redelivery. The authoritative check runs again under the
  // event lock, inside the transaction that writes the rows.
  const recorded = await prisma.registration.count({
    where: { stripePaymentIntentId: paymentIntent.id },
  });
  if (recorded > 0) return;

  const participants = parseParticipantsFromMetadata(meta);

  // Re-derive everything from the DB. Pricing and identity never come from
  // PaymentIntent metadata.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true, title: true, status: true, feeStructure: true, registrationType: true,
      waves: true, cap: true, eventDate: true, startTime: true,
      startsAtUtc: true, endsAtUtc: true,
      venue: true, city: true, state: true,
      organiserId: true,
      organiser: { select: { status: true } },
    },
  });

  // Every refusal gives the money back first. Recording comes second, so a
  // failed refund throws, Stripe retries the webhook, and the retry is not
  // stopped by a row this attempt already wrote.
  const refuse = async (reason: string, detail?: Record<string, unknown>) => {
    console.error(`PaymentIntent refused (${reason}), refunding:`, paymentIntent.id, detail ?? "");
    const refundId = await refundRefusedPayment(paymentIntent);
    if (!event || event.organiserId !== organiserId) return;
    await recordRefused({
      eventId: event.id,
      organiserId,
      feeStructure: event.feeStructure,
      paymentIntentId: paymentIntent.id,
      refundId,
      people: participants.length > 0
        ? participants.map((participant) => ({
            name: athleteNameFromParticipant(participant),
            email: participant.em,
          }))
        : [{ name: meta.userName || "Unknown", email: meta.userEmail || "" }],
    });
  };

  // Refuse intents that don't match a real, approved, self-hosted event.
  if (!event || event.organiserId !== organiserId) {
    await refuse("unknown or mismatched event");
    return;
  }
  // A payment started before the event began can settle while the event is in
  // progress. New registrations are already blocked at the start by checkout;
  // this exception is only for money that was legitimately taken beforehand.
  if (
    (event.status !== "APPROVED" && event.status !== "IN_PROGRESS") ||
    event.registrationType !== "startline"
  ) {
    await refuse("event not bookable", { status: event.status });
    return;
  }
  if (event.organiser.status !== "APPROVED") {
    await refuse("organisation suspended");
    return;
  }
  if (paymentIntent.currency !== "aud") {
    await refuse("unexpected currency", { currency: paymentIntent.currency });
    return;
  }
  if (participants.length === 0) {
    await refuse("no participant data");
    return;
  }

  // Price every ticket from the DB wave definitions, never from metadata. A
  // free tier is priced at zero rather than rejected, so a mixed cart (a free
  // tier alongside a paid one) confirms with the right amount on each entry.
  const waves = Array.isArray(event.waves)
    ? event.waves as { label: string; price: string; qty?: number }[]
    : [];
  const waveOf = (participant: CompactParticipant) => participant.wav || meta.waveLabel || null;
  const priceEntry = (participant: CompactParticipant): PricedEntry | null => {
    const label = waveOf(participant);
    const wave = label ? waves.find((w) => w.label === label) : undefined;
    if (!wave) return null;
    const priceCents = Math.round(parseFloat(wave.price || "0") * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) return null;
    const { platformFeeCents } = calculateTotalWithFee(priceCents, event.feeStructure);
    return { participant, waveLabel: label, priceCents, platformFeeCents };
  };

  const priced = participants.map(priceEntry);

  // The charged amount must match what the DB pricing implies: a price or tier
  // can change while the athlete is paying. Stripe reports amount_received in
  // the minor currency unit, same as our cents.
  const expectedTotalCents = priced.reduce((sum, entry) => {
    if (!entry) return sum;
    return sum + (event.feeStructure === "athlete"
      ? entry.priceCents + entry.platformFeeCents
      : entry.priceCents);
  }, 0);

  if (paymentIntent.amount_received !== expectedTotalCents || priced.some((entry) => !entry)) {
    await refuse("amount does not match pricing", {
      expectedTotalCents,
      amountReceived: paymentIntent.amount_received,
    });
    return;
  }

  const entries = priced as PricedEntry[];

  // For guest participants (no userId in metadata), create Cognito accounts +
  // Prisma Users up front so the confirmations below can link them.
  const buyerUserId = meta.userId || "";
  const userIdByEmail = buyerUserId ? {} : await ensureParticipantUsers(entries);

  const outcome = await insertConfirmedRegistrations({
    event,
    organiserId,
    entries,
    buyerUserId,
    userIdByEmail,
    stripePaymentIntentId: paymentIntent.id,
  });

  if (!outcome.ok) {
    await refuse("confirmation refused", { error: outcome.error });
    return;
  }
  // Another delivery of this payment got there first.
  if (outcome.alreadyRecorded) return;

  await announceRegistrations(event, organiserId, entries);
}

/**
 * Keep a record of a refused, refunded payment: one CANCELLED row per person,
 * carrying the refund id. Written under the same event lock as confirmations
 * and skipped if rows for this PaymentIntent already exist, so a redelivery
 * does not duplicate them.
 */
async function recordRefused(opts: {
  eventId: string;
  organiserId: string;
  feeStructure: string;
  paymentIntentId: string;
  refundId: string | null;
  people: { name: string; email: string }[];
}) {
  await prisma.$transaction(async (tx) => {
    await lockEventEntries(tx, opts.eventId);
    const existing = await tx.registration.count({
      where: { stripePaymentIntentId: opts.paymentIntentId },
    });
    if (existing > 0) return;
    await tx.registration.createMany({
      data: opts.people.map((person) => ({
        eventId: opts.eventId,
        organiserId: opts.organiserId,
        athleteName: person.name,
        athleteEmail: person.email,
        amountCents: 0,
        platformFeeCents: 0,
        feeStructure: opts.feeStructure,
        status: "CANCELLED" as const,
        stripePaymentIntentId: opts.paymentIntentId,
        stripeRefundId: opts.refundId,
      })),
    });
  });
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

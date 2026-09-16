import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { parseParticipantsFromMetadata, parseAddOnsFromMetadata } from "@/lib/stripe-webhook";
import {
  priceAddOnSelection,
  selectionFromCodeLines,
  sumAddOnLines,
  type PricedAddOnLine,
} from "@/lib/add-on-pricing";
import { catalogueVariantsForEvent } from "@/lib/add-on-catalogue";
import { buildRefundParams } from "@/lib/stripe-refunds";
import { addOnSummaryLabel } from "@/lib/add-ons";
import { calculateTotalWithFee } from "@/lib/platform-fee";
import {
  announceRegistrations,
  ensureParticipantUsers,
  insertConfirmedRegistrations,
  type PricedEntry,
} from "@/lib/registration-confirm";
import { athleteNameFromParticipant, type CompactParticipant } from "@/lib/registration-form";

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

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

/**
 * Refund add-on lines that lost the last-unit race, and tell both parties.
 *
 * Called after the confirming transaction has committed, so the entries are
 * already safe. Everything here is best-effort by design: a failed refund or a
 * failed notification must never turn a confirmed entry back into a problem. A
 * failure is logged loudly instead, because it leaves money that needs a human.
 */
async function refundOversoldAddOns(input: {
  paymentIntent: Stripe.PaymentIntent;
  dropped: PricedAddOnLine[];
  eventId: string;
  organiserId: string;
  eventTitle: string;
  buyerUserId: string;
}): Promise<void> {
  const { paymentIntent, dropped, eventId, organiserId, eventTitle, buyerUserId } = input;
  if (dropped.length === 0) return;

  const droppedCents = sumAddOnLines(dropped).chargedCents;
  const droppedLabels = dropped
    .map((line) =>
      addOnSummaryLabel({
        participantIndex: line.participantIndex,
        name: line.name,
        variantLabel: line.variantLabel,
        quantity: line.quantity,
      }),
    )
    .join(", ");

  console.error("Add-on lines oversold, refunding:", paymentIntent.id, {
    droppedCents,
    droppedLabels,
  });

  if (droppedCents > 0) {
    try {
      // A webhook payload carries latest_charge as a bare id, so the two flags
      // that decide whether the organiser's share comes back with the refund
      // have to be read off the Charge itself. A destination charge must reverse
      // its transfer or Startline funds the refund; a direct charge has no
      // transfer to reverse and Stripe rejects the attempt. Guessing moves real
      // money in the wrong direction either way.
      const chargeRef = paymentIntent.latest_charge;
      const charge =
        typeof chargeRef === "string"
          ? await getStripe().charges.retrieve(chargeRef)
          : chargeRef;
      if (!charge) {
        console.error("No charge to refund oversold add-ons against:", paymentIntent.id);
      } else {
        await getStripe().refunds.create(
          ...buildRefundParams({
            chargeId: charge.id,
            amountCents: droppedCents,
            // Keyed on the intent so a webhook redelivery cannot refund twice.
            idempotencyKey: `addon-oversold-${paymentIntent.id}`,
            hasTransfer: Boolean(charge.transfer),
            hasApplicationFee: Boolean(charge.application_fee),
          }),
        );
      }
    } catch (err) {
      console.error("Failed to refund oversold add-ons:", paymentIntent.id, err);
    }
  }

  // The organiser needs this so their picking list and their books agree.
  await prisma.notification
    .create({
      data: {
        organiserId,
        eventId,
        type: "NEW_REGISTRATION",
        title: "Add-on sold out during checkout",
        body:
          `${droppedLabels} could not be fulfilled on a paid order because stock ran out. ` +
          `${formatCents(droppedCents)} has been refunded automatically. The entry is confirmed.`,
      },
    })
    .catch((err: unknown) => console.error("Failed to notify organiser of dropped add-ons:", err));

  // The athlete needs it so they are not waiting for a parcel that is not coming.
  if (buyerUserId) {
    await prisma.userNotification
      .create({
        data: {
          userId: buyerUserId,
          type: "REFUND_PROCESSED",
          title: "An extra sold out",
          body:
            `${droppedLabels} sold out while your payment was going through, so we could not ` +
            `include it. ${formatCents(droppedCents)} is on its way back to your card. ` +
            `Your entry to ${eventTitle} is confirmed.`,
          eventId,
        },
      })
      .catch((err: unknown) => console.error("Failed to notify athlete of dropped add-ons:", err));
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

  // Re-derive everything from the DB — metadata on a PaymentIntent is
  // client-influenced (the publishable key can create intents with arbitrary
  // metadata), so it must never be trusted for pricing or identity.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true, title: true, status: true, feeStructure: true, registrationType: true,
      waves: true, cap: true, eventDate: true, startTime: true, venue: true, city: true, state: true,
      organiserId: true,
    },
  });

  // Reject intents that don't match a real, approved, self-hosted event.
  if (!event || event.organiserId !== organiserId) {
    console.error("PaymentIntent references an unknown/mismatched event:", paymentIntent.id);
    return;
  }
  if (event.status !== "APPROVED" || event.registrationType !== "startline") {
    console.error("PaymentIntent references a non-bookable event:", paymentIntent.id);
    return;
  }

  if (participants.length === 0) {
    console.error("No participant data on PaymentIntent:", paymentIntent.id);
    await prisma.registration.create({
      data: {
        eventId,
        organiserId,
        athleteName: meta.userName ?? "Unknown",
        athleteEmail: meta.userEmail ?? "",
        amountCents: 0,
        platformFeeCents: 0,
        feeStructure: event.feeStructure,
        status: "CANCELLED",
        stripePaymentIntentId: paymentIntent.id,
      },
    });
    return;
  }

  // Price every ticket from the DB wave definitions — never from metadata. A
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

  // Price the add-ons the same way, from the DB, through the same pure module
  // checkout used. The catalogue is fetched UNFILTERED by `active`: a product the
  // organiser retired between the payment and this webhook must still price the
  // purchase in flight, or the total check below cancels an order that was paid
  // for correctly.
  const addOnMetadataLines = parseAddOnsFromMetadata(meta);
  const addOnCatalogue =
    addOnMetadataLines.length > 0 ? await catalogueVariantsForEvent(eventId) : [];
  const addOnPricing = priceAddOnSelection(
    selectionFromCodeLines(addOnMetadataLines, addOnCatalogue),
    addOnCatalogue,
    event.feeStructure,
  );

  const recordCancelled = () =>
    prisma.registration.createMany({
      data: participants.map((participant) => ({
        eventId,
        organiserId,
        athleteName: athleteNameFromParticipant(participant),
        athleteEmail: participant.em,
        amountCents: 0,
        platformFeeCents: 0,
        feeStructure: event.feeStructure,
        status: "CANCELLED" as const,
        stripePaymentIntentId: paymentIntent.id,
      })),
    });

  // The charged amount must match what the DB pricing implies. Stripe reports
  // amount_received in the minor currency unit, same as our cents.
  //
  // This comparison is the most dangerous line in the product: a mismatch writes
  // CANCELLED registrations with amountCents 0 and returns, keeping the athlete's
  // money with no refund. Add-on cents MUST be part of the expected total, and an
  // add-on line that could not be priced MUST fail the check rather than being
  // quietly dropped, because the athlete was charged for it.
  const expectedTicketCents = priced.reduce((sum, entry) => {
    if (!entry) return sum;
    return sum + (event.feeStructure === "athlete"
      ? entry.priceCents + entry.platformFeeCents
      : entry.priceCents);
  }, 0);
  const expectedTotalCents = expectedTicketCents + sumAddOnLines(addOnPricing.lines).chargedCents;

  // An add-on line pointing at a participant this order does not have is
  // malformed metadata. It is treated as a pricing failure rather than dropped,
  // because there is no registration to hang the purchase on and the athlete may
  // have been charged for it. PaymentIntent metadata is client-influenced, so
  // this has to be checked rather than assumed.
  const addOnsAddressRealParticipants = addOnPricing.lines.every(
    (line) => line.participantIndex < participants.length,
  );

  if (
    paymentIntent.amount_received !== expectedTotalCents ||
    priced.some((entry) => !entry) ||
    addOnPricing.unresolved.length > 0 ||
    !addOnsAddressRealParticipants
  ) {
    console.error("PaymentIntent amount does not match DB pricing:", paymentIntent.id, {
      expectedTotalCents,
      expectedTicketCents,
      amountReceived: paymentIntent.amount_received,
      unresolvedAddOns: addOnPricing.unresolved.length,
      addOnsAddressRealParticipants,
    });
    await recordCancelled();
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
    addOnLines: addOnPricing.lines,
  });

  if (!outcome.ok) {
    console.error("Confirmation refused:", paymentIntent.id, outcome.error);
    await recordCancelled();
    return;
  }

  await refundOversoldAddOns({
    paymentIntent,
    dropped: outcome.droppedAddOns,
    eventId,
    organiserId,
    eventTitle: event.title,
    buyerUserId:
      buyerUserId || userIdByEmail[(participants[0]?.em ?? "").trim().toLowerCase()] || "",
  });

  // Only lines that actually made it into the order: anything dropped for stock
  // was refunded above and must not appear on a receipt as though it shipped.
  const droppedKeys = new Set(
    outcome.droppedAddOns.map((line) => `${line.participantIndex}:${line.variantId}`),
  );
  const confirmedAddOns = addOnPricing.lines.filter(
    (line) => !droppedKeys.has(`${line.participantIndex}:${line.variantId}`),
  );

  await announceRegistrations(event, organiserId, entries, confirmedAddOns);
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

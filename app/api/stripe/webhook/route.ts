import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { parseParticipantsFromMetadata, parseTeamNamesFromMetadata, SELF_FLAGS_METADATA_KEY } from "@/lib/stripe-webhook";
import { groupOrderTeams } from "@/lib/team-tickets";
import { allocateStripeFeeCents, calculateTotalWithFee } from "@/lib/platform-fee";
import {
  announceRegistrations,
  ensureParticipantUsers,
  legacySelfIndex,
  insertConfirmedRegistrations,
  type PricedEntry,
} from "@/lib/registration-confirm";
import { athleteNameFromParticipant, type CompactParticipant } from "@/lib/registration-form";
import { refundRefusedPayment } from "@/lib/refund-refused-payment";
import { lockEventEntries } from "@/lib/event-entry-lock";
import { syncChargeRefunds, syncDispute } from "@/lib/payment-adjustments";
import { isBlockedByOrganiser } from "@/lib/organiser-blocks";

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return secret;
}

/**
 * Verifies a delivery from either of the two endpoints that share this URL.
 *
 * Stripe sends a connected account's events (a v1 organiser's account.updated)
 * only to a Connect-scope endpoint, never to the platform's own endpoint, and
 * each endpoint signs with its own secret. STRIPE_CONNECT_WEBHOOK_SECRET is
 * that second endpoint's secret (#607). Without it only platform events verify.
 */
function constructWebhookEvent(stripe: Stripe, body: string, signature: string): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(body, signature, getWebhookSecret());
  } catch (err) {
    const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    if (!connectSecret) throw err;
    const event = stripe.webhooks.constructEvent(body, signature, connectSecret);
    // A Connect endpoint only ever delivers connected accounts' events.
    if (!event.account) throw new Error("Connect endpoint delivered a platform event.");
    return event;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") ?? "";

    const stripe = getStripe();
    let event: Stripe.Event;

    try {
      event = constructWebhookEvent(stripe, body, signature);
    } catch {
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }

    // A v1 organiser's account.updated is a Connect event, so Stripe always
    // sets event.account on it. It has to run before the guard below, or a
    // v1 organiser who closes the tab mid-onboarding is never marked ready
    // (#607). Only trust it for the account that sent it.
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      if (!event.account || account.id === event.account) {
        await handleAccountUpdated(account);
      }
      return NextResponse.json({ received: true });
    }

    // Any other event from a connected account describes that account's own
    // payments, not a checkout on the platform. This endpoint only handles the
    // platform's.
    if (event.account) return NextResponse.json({ received: true });

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      // Refunds and disputes made in Stripe rather than through Startline (#550).
      case "charge.refunded":
        await syncChargeRefunds(event.data.object as Stripe.Charge);
        break;
      case "charge.dispute.created":
      case "charge.dispute.closed":
        await syncDispute(event.data.object as Stripe.Dispute);
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

  // Fast path for a redelivery. A claim that was written and then failed to
  // refund still owes the athlete their money; a confirmed payment does not.
  const existing = await prisma.registration.findMany({
    where: { stripePaymentIntentId: paymentIntent.id },
    select: { status: true, stripeRefundId: true },
  });
  if (existing.length > 0) {
    if (refusalStillOwed(existing)) await finishRefusedRefund(paymentIntent);
    return;
  }

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

  // Claim the refusal under the event lock before refunding. A concurrent
  // delivery may already be confirming this payment; refunding first would
  // give the athlete the money back and the entries. A failed refund leaves
  // the claim without a refund id, so the retry finishes the refund instead
  // of confirming.
  const refuse = async (reason: string, detail?: Record<string, unknown>) => {
    console.error(`PaymentIntent refused (${reason}), refunding:`, paymentIntent.id, detail ?? "");
    if (!event || event.organiserId !== organiserId) {
      await refundRefusedPayment(paymentIntent);
      return;
    }
    const claim = await claimRefusal({
      eventId: event.id,
      organiserId,
      feeStructure: event.feeStructure,
      paymentIntentId: paymentIntent.id,
      people: participants.length > 0
        ? participants.map((participant) => ({
            name: athleteNameFromParticipant(participant),
            email: participant.em,
          }))
        : [{ name: meta.userName || "Unknown", email: meta.userEmail || "" }],
    });
    if (claim === "skip") return;
    await finishRefusedRefund(paymentIntent);
  };

  // Fail fast, before guest-account creation. The same check runs again under
  // the event lock (beforeInsert) because the event can change during that wait.
  // A payment started before the event began can settle while it is in progress;
  // new registrations are already blocked at the start by checkout.
  const earlyRefusal = paymentRefusalReason(event, organiserId, paymentIntent, participants);
  if (earlyRefusal) {
    await refuse(earlyRefusal);
    return;
  }
  if (!event) return;

  // A person the organisation has blocked (#571) is refunded, not entered.
  // Checkout refuses them first; this catches a block added while they paid.
  // insertConfirmedRegistrations checks again under the lock.
  if (
    await isBlockedByOrganiser(organiserId, {
      userIds: [meta.userId],
      emails: [meta.userEmail, ...participants.filter((p) => !p.pnd).map((p) => p.em)],
    })
  ) {
    await refuse("blocked by organiser");
    return;
  }

  // Price every ticket from the DB wave definitions, never from metadata. A
  // free tier is priced at zero rather than rejected, so a mixed cart (a free
  // tier alongside a paid one) confirms with the right amount on each entry.
  const waves = Array.isArray(event.waves)
    ? event.waves as { label: string; price: string; qty?: number; teamSize?: number }[]
    : [];
  const waveOf = (participant: CompactParticipant) => participant.wav || meta.waveLabel || null;
  const priceEntry = (participant: CompactParticipant): PricedEntry | null => {
    const label = waveOf(participant);
    const wave = label ? waves.find((w) => w.label === label) : undefined;
    if (!wave) return null;
    const priceCents = Math.round(parseFloat(wave.price || "0") * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) return null;
    const { platformFeeCents } = calculateTotalWithFee(priceCents, event.feeStructure);
    return {
      participant,
      waveLabel: label,
      priceCents,
      platformFeeCents,
      ...(participant.tm != null ? { team: participant.tm } : {}),
    };
  };

  const priced = participants.map(priceEntry);

  // Team structure is re-checked against the DB tiers too: the grouping came
  // from metadata.
  const grouped = groupOrderTeams(
    participants.map((p) => ({ waveLabel: waveOf(p), team: p.tm, pending: p.pnd === 1 })),
    waves,
    parseTeamNamesFromMetadata(meta),
  );
  if ("error" in grouped) {
    await refuse("invalid team structure", { error: grouped.error });
    return;
  }

  if (priced.some((entry) => !entry)) {
    await refuse("amount does not match pricing");
    return;
  }
  const pricedEntries = priced as PricedEntry[];

  // The Stripe fee the organiser absorbs is whatever the application fee took
  // beyond the booking fee (#470). Read it off the intent itself rather than
  // its metadata. An intent created before the uplift, or in dev direct-charge
  // mode with no application fee, comes out as zero, so its payout is unchanged.
  const bookingFeeCents = pricedEntries.reduce((sum, entry) => sum + entry.platformFeeCents, 0);
  const orderStripeFeeCents = Math.max(0, (paymentIntent.application_fee_amount ?? 0) - bookingFeeCents);
  const stripeFeeShares = allocateStripeFeeCents(
    orderStripeFeeCents,
    pricedEntries.map((entry) => event.feeStructure === "athlete"
      ? entry.priceCents + entry.platformFeeCents
      : entry.priceCents),
  );
  const entries = pricedEntries.map((entry, index) => ({
    ...entry,
    stripeFeeCents: stripeFeeShares[index],
  }));

  // For guest participants (no userId in metadata), create Cognito accounts +
  // Prisma Users up front so the confirmations below can link them.
  const buyerUserId = meta.userId || "";
  const userIdByEmail = buyerUserId ? {} : await ensureParticipantUsers(entries);

  // Paid for after #592 deployed but set up before it: there is no "Me" flag,
  // so pick the buyer's own ticket the way the backfill did (#598).
  if (buyerUserId && !meta[SELF_FLAGS_METADATA_KEY] && !entries.some((e) => e.participant.me === 1)) {
    const buyer = await prisma.user.findUnique({ where: { id: buyerUserId }, select: { email: true, name: true } });
    const own = buyer ? legacySelfIndex(entries.map((e) => e.participant), buyer) : null;
    if (own !== null) entries[own] = { ...entries[own], participant: { ...entries[own].participant, me: 1 } };
  }

  const outcome = await insertConfirmedRegistrations({
    event,
    organiserId,
    entries,
    buyerUserId,
    userIdByEmail,
    stripePaymentIntentId: paymentIntent.id,
    teams: grouped.teams,
    // Written by /api/checkout/accept-terms just before the card is charged.
    termsAccepted: Boolean(meta.termsAcceptedAt),
    // Guest account creation sits outside the lock and can outlast a webhook
    // retry. Re-read the event before inserting, or a price or status change
    // in that window confirms an order the other delivery is refunding.
    beforeInsert: async (tx) => {
      const fresh = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          status: true,
          registrationType: true,
          feeStructure: true,
          waves: true,
          organiserId: true,
          organiser: { select: { status: true } },
        },
      });
      return paymentRefusalReason(fresh, organiserId, paymentIntent, participants);
    },
  });

  if (!outcome.ok) {
    await refuse("confirmation refused", { error: outcome.error });
    return;
  }
  // Another delivery of this payment got there first.
  if (outcome.alreadyRecorded) return;

  await announceRegistrations(event, organiserId, entries, grouped.teams, outcome.registrationIds);
}

type PaymentRow = { status: string; stripeRefundId: string | null };

/** A refused payment still needs its refund. A confirmed one must not be refunded. */
function refusalStillOwed(rows: PaymentRow[]): boolean {
  if (rows.some((row) => row.status === "CONFIRMED")) return false;
  return rows.some((row) => !row.stripeRefundId);
}

/**
 * Reserve this PaymentIntent under the same lock confirmations take.
 * "refund" means this delivery should refund (it wrote the claim, or an
 * earlier claim never got its refund id). "skip" means another delivery
 * already confirmed, or the refund is already recorded.
 */
async function claimRefusal(opts: {
  eventId: string;
  organiserId: string;
  feeStructure: string;
  paymentIntentId: string;
  people: { name: string; email: string }[];
}): Promise<"refund" | "skip"> {
  return prisma.$transaction(async (tx) => {
    await lockEventEntries(tx, opts.eventId);
    const existing = await tx.registration.findMany({
      where: { stripePaymentIntentId: opts.paymentIntentId },
      select: { status: true, stripeRefundId: true },
    });
    if (existing.length > 0) return refusalStillOwed(existing) ? "refund" : "skip";
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
        stripeRefundId: null,
      })),
    });
    return "refund";
  });
}

async function finishRefusedRefund(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  // Re-read under no assumption about why it was refused: an event cancelled
  // while the athlete was paying also gets Startline's fee back to the payer's
  // side, exactly as a cancellation refunds every other entry.
  const claimed = await prisma.registration.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id },
    select: { event: { select: { status: true } } },
  });
  const refundId = await refundRefusedPayment(paymentIntent, {
    returnApplicationFee: claimed?.event?.status === "CANCELLED",
  });
  if (!refundId) return;
  await prisma.registration.updateMany({
    where: { stripePaymentIntentId: paymentIntent.id, stripeRefundId: null },
    data: { stripeRefundId: refundId },
  });
}

type BookableEvent = {
  status: string;
  registrationType: string;
  feeStructure: string;
  waves: unknown;
  organiserId: string;
  organiser: { status: string };
};

/** Why this payment cannot become entries, or null when it still can. */
function paymentRefusalReason(
  event: BookableEvent | null,
  organiserId: string,
  paymentIntent: Stripe.PaymentIntent,
  participants: CompactParticipant[],
): string | null {
  if (!event || event.organiserId !== organiserId) return "unknown or mismatched event";
  if (
    (event.status !== "APPROVED" && event.status !== "IN_PROGRESS") ||
    event.registrationType !== "startline"
  ) {
    return "event not bookable";
  }
  if (event.organiser.status !== "APPROVED") return "organisation suspended";
  if (paymentIntent.currency !== "aud") return "unexpected currency";
  if (participants.length === 0) return "no participant data";

  const waves = Array.isArray(event.waves)
    ? event.waves as { label: string; price: string }[]
    : [];
  const priced = participants.map((participant) => {
    const label = participant.wav || paymentIntent.metadata.waveLabel || null;
    const wave = label ? waves.find((item) => item.label === label) : undefined;
    if (!wave) return null;
    const priceCents = Math.round(parseFloat(wave.price || "0") * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) return null;
    const { platformFeeCents } = calculateTotalWithFee(priceCents, event.feeStructure);
    return event.feeStructure === "athlete" ? priceCents + platformFeeCents : priceCents;
  });
  const expectedTotalCents = priced.reduce<number>((sum, cents) => sum + (cents ?? 0), 0);
  if (paymentIntent.amount_received !== expectedTotalCents || priced.some((cents) => cents == null)) {
    return "amount does not match pricing";
  }
  return null;
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

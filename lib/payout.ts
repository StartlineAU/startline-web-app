import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export type PayoutEligibleEvent = {
  id: string;
  title: string;
  eventDate: string;
  endDate: string | null;
  organiser: { id: string; orgName: string | null; stripeAccountId: string | null };
  netCents: number;
};

export interface PayoutRegistration {
  amountCents: number;
  platformFeeCents: number;
  feeStructure: string;
}

/**
 * What the organiser's connected account actually holds for one entry.
 *
 * Checkout always takes the platform fee as an application fee, so the
 * organiser's balance is the ticket price when the athlete paid the fee on top,
 * and the ticket price minus the fee when the organiser absorbed it. Reading
 * platformFeeCents as part of the organiser's share would pay out money the
 * connected account never received (issue #251).
 *
 * An unrecognised structure is treated as organiser-absorbed, matching
 * calculateTotalWithFee: that is the safer direction when the snapshot is odd.
 */
export function registrationPayoutCents(registration: PayoutRegistration): number {
  return registration.feeStructure === "athlete"
    ? registration.amountCents
    : Math.max(0, registration.amountCents - registration.platformFeeCents);
}

/** Net payout for a set of confirmed entries, using each entry's own snapshot. */
export function registrationsPayoutCents(registrations: PayoutRegistration[]): number {
  return registrations.reduce(
    (sum, registration) => sum + registrationPayoutCents(registration),
    0,
  );
}

/**
 * Events whose payout can be run today: the event has finished, the organiser
 * has an onboarded Stripe Express account, and we haven't already paid them.
 */
export async function getPayoutEligibleEvents(): Promise<PayoutEligibleEvent[]> {
  const today = new Date().toISOString().split("T")[0];

  const events = await prisma.event.findMany({
    where: {
      registrationType: "startline",
      payoutTriggered: false,
      organiser: { stripeOnboardingComplete: true, stripeAccountId: { not: null } },
      OR: [
        { endDate: { not: null, lt: today } },
        { endDate: null, eventDate: { lt: today } },
      ],
    },
    select: {
      id: true, title: true, eventDate: true, endDate: true,
      organiser: { select: { id: true, orgName: true, stripeAccountId: true } },
      registrations: {
        where: { status: "CONFIRMED" },
        select: { amountCents: true, platformFeeCents: true, feeStructure: true },
      },
    },
  });

  return events
    .map((event) => ({
      ...event,
      registrations: undefined,
      netCents: registrationsPayoutCents(event.registrations),
    }))
    .filter((event) => event.netCents > 0);
}

/**
 * Push the organiser's full net earnings for an event from their Stripe
 * Express balance to their nominated bank account, then mark the event paid.
 *
 * The platform fee was already withheld at charge time (application_fee_amount),
 * so an athlete-paid entry leaves the ticket price in the connected account and
 * an organiser-paid entry leaves the ticket price minus the fee. The payout
 * reads each entry's own snapshot rather than re-deriving the split from the
 * event, so historical entries pay out exactly what their charge transferred.
 */
export async function runPayoutForEvent(eventId: string): Promise<{ netCents: number }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true, title: true, payoutTriggered: true,
      organiser: { select: { id: true, stripeAccountId: true } },
      registrations: {
        where: { status: "CONFIRMED" },
        select: { amountCents: true, platformFeeCents: true, feeStructure: true },
      },
    },
  });

  if (!event) throw new Error("Event not found.");
  if (event.payoutTriggered) throw new Error("Payout already triggered for this event.");
  if (!event.organiser.stripeAccountId) throw new Error("Organiser has no Stripe account.");

  const netCents = registrationsPayoutCents(event.registrations);
  if (netCents <= 0) throw new Error("No confirmed registrations to pay out.");

  await getStripe().payouts.create(
    { amount: netCents, currency: "aud" },
    { stripeAccount: event.organiser.stripeAccountId }
  );

  await prisma.event.update({
    where: { id: eventId },
    data: { payoutTriggered: true, payoutAmountCents: netCents, payoutAt: new Date() },
  });

  return { netCents };
}

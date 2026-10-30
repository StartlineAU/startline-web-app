import { NextRequest, NextResponse } from "next/server";
import { PayoutAttemptStatus, PayoutStatus } from "@prisma/client";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";
import { PAYOUT_LEASE_MS } from "@/lib/payout";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { z } from "zod";

const reconcileSchema = z.discriminatedUnion("resolution", [
  z.object({
    eventId: z.string().min(1).max(255),
    resolution: z.literal("link"),
    stripePayoutId: z.string().min(1).max(255),
  }),
  z.object({
    eventId: z.string().min(1).max(255),
    resolution: z.literal("no_payout"),
    confirm: z.literal(true),
  }),
]);

type Operation = {
  id: string;
  eventId: string;
  stripeAccountId: string;
  amountCents: number;
  currency: string;
  status: PayoutStatus;
  stripePayoutId: string | null;
  updatedAt: Date;
};

async function findOperation(eventId: string): Promise<Operation | null> {
  return prisma.payoutOperation.findUnique({
    where: { eventId },
    select: {
      id: true,
      eventId: true,
      stripeAccountId: true,
      amountCents: true,
      currency: true,
      status: true,
      stripePayoutId: true,
      updatedAt: true,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = reconcileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Provide a resolution: link an existing payout, or confirm no payout with confirm: true.",
      },
      { status: 400 },
    );
  }

  const { eventId, resolution } = parsed.data;
  const operation = await findOperation(eventId).catch((err) => {
    console.error("Payout reconciliation lookup failed:", err);
    return undefined;
  });

  if (operation === undefined) {
    return NextResponse.json({ error: "Payout record unavailable." }, { status: 503 });
  }
  if (!operation) {
    return NextResponse.json({ error: "Payout record not found." }, { status: 404 });
  }

  if (resolution === "link") {
    return linkPayout(session.sub, operation, parsed.data.stripePayoutId);
  }
  return confirmNoPayout(session.sub, operation);
}

async function linkPayout(
  adminId: string,
  operation: Operation,
  stripePayoutId: string,
): Promise<NextResponse> {
  if (operation.status === PayoutStatus.SUBMITTED) {
    if (operation.stripePayoutId === stripePayoutId) {
      return NextResponse.json({
        ok: true,
        eventId: operation.eventId,
        netCents: operation.amountCents,
        stripePayoutId,
        alreadyProcessed: true,
      });
    }
    return NextResponse.json(
      { error: "This event already has a different Stripe payout recorded." },
      { status: 409 },
    );
  }

  if (
    operation.status !== PayoutStatus.SUBMITTING
    && operation.status !== PayoutStatus.NEEDS_RECONCILIATION
  ) {
    return NextResponse.json(
      { error: "Only an in-progress or unresolved payout can be reconciled." },
      { status: 409 },
    );
  }

  let payout;
  try {
    payout = await getStripe().payouts.retrieve(
      stripePayoutId,
      {},
      { stripeAccount: operation.stripeAccountId },
    );
  } catch (err) {
    console.error("Could not retrieve the Stripe payout for reconciliation:", err);
    return NextResponse.json(
      { error: "Could not read that payout from Stripe. Check the ID and account." },
      { status: 502 },
    );
  }

  const unusable =
    payout.status === "failed"
    || payout.status === "canceled"
    || payout.amount !== operation.amountCents
    || payout.currency.toLowerCase() !== operation.currency.toLowerCase();

  if (unusable) {
    return NextResponse.json(
      {
        error: "That Stripe payout does not match this event's amount and currency, or it did not succeed.",
      },
      { status: 409 },
    );
  }

  try {
    await prisma.$transaction([
      prisma.payoutAttempt.updateMany({
        where: {
          operationId: operation.id,
          status: { in: [PayoutAttemptStatus.STARTED, PayoutAttemptStatus.UNKNOWN] },
        },
        data: {
          status: PayoutAttemptStatus.SUCCEEDED,
          stripePayoutId,
          errorCategory: null,
          errorMessage: null,
        },
      }),
      prisma.payoutOperation.update({
        where: { id: operation.id },
        data: {
          status: PayoutStatus.SUBMITTED,
          stripePayoutId,
          lastError: null,
        },
      }),
      prisma.event.update({
        where: { id: operation.eventId },
        data: {
          payoutTriggered: true,
          payoutAmountCents: operation.amountCents,
          payoutAt: new Date(),
        },
      }),
    ]);
  } catch (err) {
    console.error("Could not record the reconciled payout:", err);
    return NextResponse.json(
      { error: "Could not record the reconciled payout. Nothing was changed." },
      { status: 503 },
    );
  }

  await writeAuditLog({
    adminId,
    action: "PAYOUT_RECONCILED",
    targetType: "event",
    targetId: operation.eventId,
    meta: { resolution: "link", stripePayoutId, amountCents: operation.amountCents },
  });

  return NextResponse.json({
    ok: true,
    eventId: operation.eventId,
    netCents: operation.amountCents,
    stripePayoutId,
    alreadyProcessed: false,
  });
}

async function confirmNoPayout(
  adminId: string,
  operation: Operation,
): Promise<NextResponse> {
  if (operation.status === PayoutStatus.SUBMITTED) {
    return NextResponse.json(
      { error: "This payout is already recorded as submitted." },
      { status: 409 },
    );
  }

  // A request that is still inside its lease could reach Stripe after the
  // admin clears it. Wait until the lease expires, then reconcile.
  if (
    operation.status === PayoutStatus.SUBMITTING
    && Date.now() - operation.updatedAt.getTime() < PAYOUT_LEASE_MS
  ) {
    return NextResponse.json(
      { error: "This payout request is still in progress. Wait a moment and refresh." },
      { status: 409 },
    );
  }

  try {
    await prisma.$transaction([
      prisma.payoutAttempt.updateMany({
        where: {
          operationId: operation.id,
          status: { in: [PayoutAttemptStatus.STARTED, PayoutAttemptStatus.UNKNOWN] },
        },
        data: {
          status: PayoutAttemptStatus.FAILED,
          errorCategory: "NO_PAYOUT_CONFIRMED",
          errorMessage: "An admin checked Stripe and confirmed no payout was created.",
        },
      }),
      prisma.payoutOperation.update({
        where: { id: operation.id },
        data: {
          status: PayoutStatus.FAILED,
          lastError: "An admin confirmed no payout was created.",
        },
      }),
    ]);
  } catch (err) {
    console.error("Could not clear the unresolved payout:", err);
    return NextResponse.json(
      { error: "Could not update the payout record. Nothing was changed." },
      { status: 503 },
    );
  }

  await writeAuditLog({
    adminId,
    action: "PAYOUT_RECONCILED",
    targetType: "event",
    targetId: operation.eventId,
    meta: { resolution: "no_payout", amountCents: operation.amountCents },
  });

  return NextResponse.json({
    ok: true,
    eventId: operation.eventId,
    netCents: operation.amountCents,
    alreadyProcessed: false,
    retryAvailable: true,
  });
}

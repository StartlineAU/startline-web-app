import { NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { organiserResponseDue } from "@/lib/refund-ticket-rules";
import { entryPaidCents } from "@/lib/stripe-refunds";

// GET — refund tickets raised against this organisation's events.
export async function GET() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;

  const tickets = await prisma.supportTicket.findMany({
    where: { organiserId: auth.session.sub, requestType: "refund" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, name: true, email: true, eventName: true, eventDate: true,
      eventId: true, reason: true, status: true, createdAt: true,
      organiserDecision: true, organiserDecidedAt: true, organiserNote: true,
      adminDecisionKind: true, adminDecidedAt: true, adminNote: true,
      registrationId: true, policyRefundPercent: true, policyRefundCents: true,
      organiserReason: true, refundType: true, refundCents: true, refundIssuedAt: true,
      refundError: true,
      registration: {
        select: { amountCents: true, platformFeeCents: true, feeStructure: true, athleteName: true },
      },
    },
  });

  return NextResponse.json({
    tickets: tickets.map(({ registration, ...t }) => ({
      ...t,
      organiserResponseDue: organiserResponseDue(t),
      // What a full refund would return: everything the entry paid (#492).
      fullRefundCents: registration ? entryPaidCents(registration) : null,
      entryAthleteName: registration?.athleteName ?? null,
    })),
  });
}

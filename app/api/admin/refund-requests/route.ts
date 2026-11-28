import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/amplify-server";
import prisma from "@/lib/prisma";
import { organiserResponseDue } from "@/lib/refund-ticket-rules";
import { entryPaidCents } from "@/lib/stripe-refunds";

// GET — every refund ticket: what the organiser decided, and when its window to
// decide closes, so Startline can issue approved refunds and step in on silence.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const tickets = await prisma.supportTicket.findMany({
    where: { requestType: "refund" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, name: true, email: true, eventName: true, eventDate: true,
      eventId: true, organiserId: true, reason: true, status: true, createdAt: true,
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

  const now = new Date();
  return NextResponse.json({
    tickets: tickets.map(({ registration, ...t }) => {
      const due = organiserResponseDue(t);
      // Startline can decide an open ticket itself once the window has passed.
      return {
        ...t,
        organiserResponseDue: due,
        organiserWindowPassed: now >= due,
        fullRefundCents: registration ? entryPaidCents(registration) : null,
        entryAthleteName: registration?.athleteName ?? null,
      };
    }),
  });
}

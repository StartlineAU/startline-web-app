import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { idParams } from "@/lib/schemas";
import { canOrganiserDecide } from "@/lib/refund-ticket-rules";
import {
  APPROVE_REASONS,
  DECLINE_REASONS,
  REFUND_NOTE_MAX,
  isApproveReason,
  refundNoteRequired,
  refundTypeFor,
} from "@/lib/refund-decision-reasons";
import {
  approvalBlocker,
  issueTicketRefund,
  notifyApprovedWithoutEntry,
  restoreDeclinedEntry,
} from "@/lib/refund-ticket-outcome";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    reason: z.enum(APPROVE_REASONS),
    note: z.string().max(REFUND_NOTE_MAX).optional(),
  }),
  z.object({
    action: z.literal("decline"),
    reason: z.enum(DECLINE_REASONS),
    note: z.string().max(REFUND_NOTE_MAX).optional(),
  }),
]);

// PATCH — the organisation's decision on a refund ticket. This is the decision
// (#570): Startline overrides only as a recorded exception. The reason picks
// how much goes back (#492), and approving a ticket raised from an entry issues
// the refund straight away (lib/refund-ticket-outcome.ts).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a reason for your decision." }, { status: 400 });
  }
  const { action, reason } = parsed.data;
  const note = parsed.data.note?.trim() || null;
  if (refundNoteRequired(reason) && !note) {
    return NextResponse.json(
      {
        error: action === "decline"
          ? "Add a note telling the athlete why."
          : "Add a note saying why you are refunding outside your policy.",
      },
      { status: 400 },
    );
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { organiserId: true, status: true, registrationId: true, policyRefundCents: true },
  });
  if (!ticket || ticket.organiserId !== auth.session.sub) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!canOrganiserDecide(ticket)) {
    return NextResponse.json({ error: "This request has already been decided." }, { status: 409 });
  }

  const refundType = action === "approve" && isApproveReason(reason) ? refundTypeFor(reason) : null;
  if (refundType) {
    const blocker = approvalBlocker(ticket, refundType);
    if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  }

  const status = action === "approve" ? "APPROVED" : "DECLINED";
  // Conditional on OPEN so an admin decision that lands in between is not
  // overwritten. The loser of the race gets the same 409 as a late click.
  const written = await prisma.supportTicket.updateMany({
    where: { id, status: "OPEN" },
    data: {
      status,
      organiserDecision: status,
      organiserDecidedById: auth.session.sub,
      organiserDecidedAt: new Date(),
      organiserNote: note,
      organiserReason: reason,
      refundType,
    },
  });
  if (written.count !== 1) {
    return NextResponse.json({ error: "This request has already been decided." }, { status: 409 });
  }

  if (status === "DECLINED") {
    await restoreDeclinedEntry(id);
    return NextResponse.json({ id, status });
  }
  if (!ticket.registrationId) {
    // Not linked to an entry: Startline matches it and issues it by hand.
    await notifyApprovedWithoutEntry(id);
    return NextResponse.json({ id, status, issued: false });
  }

  const issued = await issueTicketRefund(id, { firstAttempt: true });
  return issued.ok
    ? NextResponse.json({ id, status: "REFUNDED", refundCents: issued.refundCents })
    : NextResponse.json({ id, status, issued: false, refundError: issued.error });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/amplify-server";
import prisma from "@/lib/prisma";
import { idParams } from "@/lib/schemas";
import { writeAuditLog } from "@/lib/audit";
import { evaluateAdminAction } from "@/lib/refund-ticket-rules";
import {
  ORGANISER_RECIPIENTS_SELECT,
  organiserNotificationRecipients,
} from "@/lib/organiser-notification-recipients";
import { sendRefundOverrideEmails } from "@/lib/email";

const bodySchema = z.object({
  action: z.enum(["approve", "decline", "refunded"]),
  note: z.string().max(2000).optional(),
  /** Decide over the organiser's head. Needs a note; audited; the organiser is told. */
  override: z.boolean().optional(),
});

// PATCH — Startline acting on a refund ticket. The organiser's decision stands
// (#570): `refunded` records that Startline issued the money for an approved
// request; approve/decline is allowed only once the organiser's window has
// passed, or as an explicit override (lib/refund-ticket-rules.ts).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true, status: true, organiserDecision: true, createdAt: true,
      eventName: true, name: true, organiserId: true, eventId: true,
    },
  });
  if (!ticket) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const verdict = evaluateAdminAction(ticket, parsed.data, new Date());
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.error }, { status: verdict.httpStatus });
  }

  // Conditional on the status read above, so an organiser decision that lands
  // in between is not silently overwritten.
  const written = await prisma.supportTicket.updateMany({
    where: { id, status: ticket.status },
    data: verdict.kind
      ? {
          status: verdict.status,
          adminDecisionKind: verdict.kind,
          adminDecidedById: session.sub,
          adminDecidedAt: new Date(),
          adminNote: verdict.note,
        }
      : { status: verdict.status },
  });
  if (written.count !== 1) {
    return NextResponse.json(
      { error: "This request changed a moment ago. Refresh and try again." },
      { status: 409 },
    );
  }

  await writeAuditLog({
    adminId: session.sub,
    action: verdict.auditAction,
    targetType: "support_ticket",
    targetId: id,
    meta: {
      eventName: ticket.eventName,
      previousStatus: ticket.status,
      organiserDecision: ticket.organiserDecision,
      status: verdict.status,
      ...(verdict.note ? { note: verdict.note } : {}),
    },
  });

  if (verdict.notifyOrganiser && ticket.organiserId) {
    await notifyOrganiserOfOverride({
      organiserId: ticket.organiserId,
      eventId: ticket.eventId,
      eventTitle: ticket.eventName ?? "an event",
      athleteName: ticket.name,
      organiserDecision: ticket.organiserDecision,
      decision: verdict.status === "APPROVED" ? "approved" : "declined",
      note: verdict.note ?? "",
    }).catch((err) => console.error("Refund override notify failed:", err));
  }

  return NextResponse.json({ id, status: verdict.status });
}

async function notifyOrganiserOfOverride(input: {
  organiserId: string;
  eventId: string | null;
  eventTitle: string;
  athleteName: string;
  organiserDecision: string | null;
  decision: "approved" | "declined";
  note: string;
}) {
  const organiser = await prisma.organiser.findUnique({
    where: { id: input.organiserId },
    select: { id: true, ...ORGANISER_RECIPIENTS_SELECT },
  });
  if (!organiser) return;

  await prisma.notification.create({
    data: {
      organiserId: organiser.id,
      eventId: input.eventId,
      type: "REFUND_TICKET_OVERRIDE",
      title: "Refund decision changed",
      body: `Startline ${input.decision} ${input.athleteName}'s refund request for ${input.eventTitle}. Reason: ${input.note}`,
    },
  });

  const organiserDecision =
    input.organiserDecision === "APPROVED" ? "approved"
    : input.organiserDecision === "DECLINED" ? "declined"
    : null;
  await sendRefundOverrideEmails(organiserNotificationRecipients(organiser), {
    athleteName: input.athleteName,
    eventTitle: input.eventTitle,
    organiserDecision,
    decision: input.decision,
    note: input.note,
  });
}

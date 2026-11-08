import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/amplify-server";
import prisma from "@/lib/prisma";
import { idParams } from "@/lib/schemas";
import { writeAuditLog } from "@/lib/audit";

const bodySchema = z.object({
  action: z.enum(["approve", "decline", "refunded"]),
  note: z.string().max(2000).optional(),
});

// PATCH — Startline's decision. `refunded` is set once the Stripe refund has
// been issued from the registrations page.
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
    select: { id: true, status: true, eventName: true },
  });
  if (!ticket) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const status =
    parsed.data.action === "approve" ? "APPROVED"
    : parsed.data.action === "decline" ? "DECLINED"
    : "REFUNDED";

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      status,
      decidedById: session.sub,
      decidedAt: new Date(),
      decisionNote: parsed.data.note?.trim() || null,
    },
    select: { id: true, status: true },
  });

  await writeAuditLog({
    adminId: session.sub,
    action: `REFUND_TICKET_${status}`,
    targetType: "support_ticket",
    targetId: id,
    meta: { eventName: ticket.eventName },
  });

  return NextResponse.json(updated);
}

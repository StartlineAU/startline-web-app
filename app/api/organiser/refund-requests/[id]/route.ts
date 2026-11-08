import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { idParams } from "@/lib/schemas";

const bodySchema = z.object({
  action: z.enum(["approve", "decline"]),
  note: z.string().max(2000).optional(),
});

// PATCH — the organisation's decision on a refund ticket. Startline still
// issues the refund: this records whether the organiser supports it.
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
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { organiserId: true, status: true },
  });
  if (!ticket || ticket.organiserId !== auth.session.sub) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (ticket.status !== "OPEN") {
    return NextResponse.json({ error: "This request has already been reviewed." }, { status: 409 });
  }

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      status: parsed.data.action === "approve" ? "APPROVED" : "DECLINED",
      decidedById: auth.session.sub,
      decidedAt: new Date(),
      decisionNote: parsed.data.note?.trim() || null,
    },
    select: { id: true, status: true },
  });

  return NextResponse.json(updated);
}

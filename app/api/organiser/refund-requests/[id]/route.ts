import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { idParams } from "@/lib/schemas";
import { canOrganiserDecide } from "@/lib/refund-ticket-rules";

const bodySchema = z.object({
  action: z.enum(["approve", "decline"]),
  note: z.string().max(2000).optional(),
});

// PATCH — the organisation's decision on a refund ticket. This is the decision
// (#570): Startline issues the refund for an approved request and overrides
// only as a recorded exception.
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
  if (!canOrganiserDecide(ticket)) {
    return NextResponse.json({ error: "This request has already been decided." }, { status: 409 });
  }

  const status = parsed.data.action === "approve" ? "APPROVED" : "DECLINED";
  // Conditional on OPEN so an admin decision that lands in between is not
  // overwritten. The loser of the race gets the same 409 as a late click.
  const written = await prisma.supportTicket.updateMany({
    where: { id, status: "OPEN" },
    data: {
      status,
      organiserDecision: status,
      organiserDecidedById: auth.session.sub,
      organiserDecidedAt: new Date(),
      organiserNote: parsed.data.note?.trim() || null,
    },
  });
  if (written.count !== 1) {
    return NextResponse.json({ error: "This request has already been decided." }, { status: 409 });
  }

  return NextResponse.json({ id, status });
}

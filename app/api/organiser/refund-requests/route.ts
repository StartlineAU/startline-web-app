import { NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";

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
      eventId: true, reason: true, status: true, decisionNote: true,
      decidedAt: true, createdAt: true,
    },
  });

  return NextResponse.json({ tickets });
}

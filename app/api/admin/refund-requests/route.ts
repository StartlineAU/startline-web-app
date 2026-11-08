import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/amplify-server";
import prisma from "@/lib/prisma";

// GET — every refund ticket, so Startline can review what organisers decided.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const tickets = await prisma.supportTicket.findMany({
    where: { requestType: "refund" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, name: true, email: true, eventName: true, eventDate: true,
      eventId: true, organiserId: true, reason: true, status: true,
      decisionNote: true, decidedAt: true, createdAt: true,
    },
  });

  return NextResponse.json({ tickets });
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true, isPinned: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { isPinned: !event.isPinned },
      select: { id: true, isPinned: true },
    });

    writeAuditLog({
      adminId: session.sub,
      action: updated.isPinned ? "PIN_EVENT" : "UNPIN_EVENT",
      targetType: "event",
      targetId: id,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Admin pin toggle error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

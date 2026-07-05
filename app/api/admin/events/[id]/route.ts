import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true, title: true, status: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    await prisma.event.delete({ where: { id } });

    writeAuditLog({
      adminId: session.sub,
      action: "DELETE_EVENT",
      targetType: "event",
      targetId: id,
      meta: { title: event.title, status: event.status },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin delete event error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

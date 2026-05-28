import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getOrganiserSession } from "@/lib/amplify-server";

const prisma = new PrismaClient();

// GET /api/organiser/notifications
// Returns the 30 most recent notifications; includes unread count in header
export async function GET() {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const notifications = await prisma.notification.findMany({
      where:   { organiserId: session.sub },
      orderBy: { createdAt: "desc" },
      take:    30,
      select:  { id: true, type: true, title: true, body: true, eventId: true, read: true, createdAt: true },
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// PATCH /api/organiser/notifications
// Body: { ids?: string[] } — if ids omitted, marks ALL as read
export async function PATCH(req: NextRequest) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({})) as { ids?: string[] };

    await prisma.notification.updateMany({
      where: {
        organiserId: session.sub,
        ...(body.ids?.length ? { id: { in: body.ids } } : {}),
      },
      data: { read: true },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

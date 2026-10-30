import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const markReadSchema = z.object({ ids: z.array(z.string().min(1).max(255)).optional() });

// Notifications belong to the organisation, so every member used to see them.
// The owner can now keep them to owners (Organiser.notifyManagers).
async function managerIsExcluded(session: { sub: string; role: string }): Promise<boolean> {
  if (session.role === "OWNER") return false;
  const organiser = await prisma.organiser.findUnique({
    where:  { id: session.sub },
    select: { notifyManagers: true },
  });
  return organiser?.notifyManagers === false;
}

// GET /api/organiser/notifications
// Returns the 30 most recent notifications; includes unread count in header
export async function GET() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    if (await managerIsExcluded(session)) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const notifications = await prisma.notification.findMany({
      where:   { organiserId: session.sub },
      orderBy: { createdAt: "desc" },
      take:    30,
      select:  { id: true, type: true, title: true, body: true, eventId: true, read: true, createdAt: true },
    });

    const unreadCount = notifications.filter((n: { read: boolean }) => !n.read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// PATCH /api/organiser/notifications
// Body: { ids?: string[] } — if ids omitted, marks ALL as read
export async function PATCH(req: NextRequest) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const parsed = markReadSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const ids = parsed.data.ids;

    // Read state is shared across the organisation, so a manager who cannot
    // see the notifications must not be able to clear them for the owner.
    if (await managerIsExcluded(session)) return NextResponse.json({ ok: true });

    await prisma.notification.updateMany({
      where: {
        organiserId: session.sub,
        ...(ids?.length ? { id: { in: ids } } : {}),
      },
      data: { read: true },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

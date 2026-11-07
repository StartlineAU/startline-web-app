import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";
import { EVENT_CHANGE_HISTORY_ORDER, serializeEventChange } from "@/lib/event-change-log";

// GET /api/admin/events/[id]/changes — the event's change log, newest first,
// with who made each change. Read-only, like the organiser's view of it.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const rows = await prisma.eventChange.findMany({
      where: { eventId: id },
      orderBy: EVENT_CHANGE_HISTORY_ORDER,
      take: 200,
    });
    return NextResponse.json({ changes: rows.map((row) => serializeEventChange(row, "admin")) });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

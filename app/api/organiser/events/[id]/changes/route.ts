import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { idParams } from "@/lib/schemas";
import { EVENT_CHANGE_HISTORY_ORDER, serializeEventChange } from "@/lib/event-change-log";

// GET /api/organiser/events/[id]/changes — the event's change log, newest
// first. Read-only: there is deliberately no route that edits or deletes a row.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const event = await prisma.event.findUnique({ where: { id }, select: { organiserId: true } });
    if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (event.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const rows = await prisma.eventChange.findMany({
      where: { eventId: id },
      orderBy: EVENT_CHANGE_HISTORY_ORDER,
      take: 200,
    });
    return NextResponse.json({ changes: rows.map((row) => serializeEventChange(row, "organiser")) });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

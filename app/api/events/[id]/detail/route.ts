import { NextResponse } from "next/server";
import { getEventDetail } from "@/lib/event-detail";

/**
 * The event information screen's data, for the panel the events listing shows
 * beside its results (issue #309). Same payload the /events/[id] page builds,
 * so the two cannot drift.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = await getEventDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(detail, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}

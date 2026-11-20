import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/amplify-server";
import { loadAthleteTicket } from "@/lib/athlete-ticket";
import { idParams } from "@/lib/schemas";

/**
 * GET /api/user/tickets/[eventId] — the signed-in athlete's ticket for one
 * event, shown in the Activity overlay (#552). 404 when they hold no entry for
 * it, so the route never confirms another athlete's bib or wave.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = idParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  try {
    const ticket = await loadAthleteTicket(session, parsed.data.id);
    if (!ticket) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(ticket);
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

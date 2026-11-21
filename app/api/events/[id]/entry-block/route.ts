import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";
import { BLOCKED_ENTRY_MESSAGE, isBlockedByOrganiser } from "@/lib/organiser-blocks";

export const dynamic = "force-dynamic";

/**
 * GET — whether the signed-in athlete is on this event's organisation block
 * list (#571). The registration page asks before showing the form, so a
 * blocked athlete is told up front rather than after filling everything in.
 * Kept off the public availability route because the answer is per person.
 *
 * Signed out answers `{ blocked: false }`: a guest is checked by email when
 * they submit.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = idParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ blocked: false });

    const event = await prisma.event.findUnique({
      where: { id: parsed.data.id },
      select: { organiserId: true },
    });
    if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const blocked = await isBlockedByOrganiser(event.organiserId, {
      userIds: [session.sub],
      emails: [session.email],
    });
    return NextResponse.json(blocked ? { blocked: true, message: BLOCKED_ENTRY_MESSAGE } : { blocked: false });
  } catch (err) {
    console.error("Entry block check error:", err);
    return NextResponse.json({ error: "Could not check this event." }, { status: 503 });
  }
}

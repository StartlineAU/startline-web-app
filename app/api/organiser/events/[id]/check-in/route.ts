import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { idParams } from "@/lib/schemas";
import {
  CHECK_IN_LEAD_OPTIONS,
  checkInOpensAtFor,
  checkInStartsAt,
  checkInWindow,
  checkInWindowJson,
  type CheckInOpeningChoice,
} from "@/lib/check-in-window";

// "now", "default", or one of the offered lead times in minutes. Anything else
// is refused so the dashboard and the API cannot drift apart.
const bodySchema = z.object({
  open: z.union([
    z.literal("now"),
    z.literal("default"),
    z.number().int().refine(
      (n) => (CHECK_IN_LEAD_OPTIONS as readonly number[]).includes(n),
      "Unsupported lead time.",
    ),
  ]),
});

const EVENT_SELECT = {
  organiserId: true,
  status: true,
  eventDate: true,
  endDate: true,
  startTime: true,
  endTime: true,
  timeZone: true,
  state: true,
  startsAtUtc: true,
  endsAtUtc: true,
  checkInOpensAt: true,
} as const;

/**
 * PATCH /api/organiser/events/[id]/check-in
 *
 * Lets the organiser open athlete check-in earlier than the default 60 minutes
 * before start (#543), or put it back to the default.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  let json: unknown;
  try { json = await req.json(); } catch { json = null; }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Choose when check-in opens." }, { status: 400 });

  try {
    const event = await prisma.event.findUnique({ where: { id }, select: EVENT_SELECT });
    if (!event)                            return NextResponse.json({ error: "Not found." },  { status: 404 });
    if (event.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    // Only a published event that has not finished takes check-ins at all.
    const current = checkInWindow(event);
    const startsAt = checkInStartsAt(event);
    if (current.state === "closed") {
      return NextResponse.json({ error: "This event has finished, so check-in is closed." }, { status: 409 });
    }
    if (current.state === "unavailable" || !startsAt) {
      return NextResponse.json({ error: "Check-in is only available for published events." }, { status: 409 });
    }

    const checkInOpensAt = checkInOpensAtFor(parsed.data.open as CheckInOpeningChoice, startsAt);
    const updated = await prisma.event.update({
      where: { id },
      data: { checkInOpensAt },
      select: EVENT_SELECT,
    });

    return NextResponse.json({ checkIn: checkInWindowJson(checkInWindow(updated)) });
  } catch (err) {
    console.error("Updating check-in opening failed:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

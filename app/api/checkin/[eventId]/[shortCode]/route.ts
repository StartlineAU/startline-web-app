import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { checkinParams } from "@/lib/schemas";
import { checkInWindow } from "@/lib/check-in-window";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string; shortCode: string }> },
) {
  const parsed = checkinParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid check-in link." }, { status: 400 });
  const { eventId, shortCode } = parsed.data;

  // The shortCode is the event's unguessable check-in code. Resolving by it
  // (not eventId alone) means a mistyped or fabricated link gets a 404.
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      checkInCode: shortCode,
      status: { in: ["APPROVED", "IN_PROGRESS", "ARCHIVED"] },
    },
    select: {
      title: true, eventDate: true, endDate: true,
      startTime: true, endTime: true, timeZone: true,
      startsAtUtc: true, endsAtUtc: true, status: true,
      venue: true, city: true, state: true,
    },
  });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const registrationSelect = {
    id: true, athleteName: true, waveLabel: true, bibNumber: true,
    checkedInAt: true,
  } as const;

  // Match the signed-in athlete to their registration by verified email first
  // (precise — covers group bookings where a buyer registered others), then by
  // userId for guests whose email differs. Doing it in one OR query let the
  // database return any of the buyer's group entries.
  let registration = await prisma.registration.findFirst({
    where: {
      eventId,
      status: "CONFIRMED",
      athleteEmail: { equals: session.email, mode: "insensitive" },
    },
    select: registrationSelect,
  });
  if (!registration) {
    registration = await prisma.registration.findFirst({
      where: { eventId, status: "CONFIRMED", userId: session.sub },
      select: registrationSelect,
    });
  }

  const window = checkInWindow({
    eventDate: event.eventDate,
    endDate: event.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    timeZone: event.timeZone,
    state: event.state,
    status: event.status,
    startsAtUtc: event.startsAtUtc,
    endsAtUtc: event.endsAtUtc,
  });

  return NextResponse.json({
    event,
    registration: registration ?? null,
    checkIn: {
      state: window.state,
      opensAt: window.opensAt?.toISOString() ?? null,
      closesAt: window.closesAt?.toISOString() ?? null,
    },
  });
}

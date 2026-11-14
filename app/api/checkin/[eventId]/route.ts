import { NextResponse } from "next/server";
import { entryBib, type TeamLink } from "@/lib/team-entries";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { z } from "zod";
import { checkInWindow, type CheckInState } from "@/lib/check-in-window";

const eventIdParams = z.object({ eventId: z.string().min(1).max(255) });
const checkInBody = z.object({
  registrationId: z.string().min(1).max(255).optional(),
});

const EVENT_SELECT = {
  title: true,
  eventDate: true,
  endDate: true,
  startTime: true,
  endTime: true,
  timeZone: true,
  startsAtUtc: true,
  endsAtUtc: true,
  state: true,
  venue: true,
  city: true,
  status: true,
} as const;

const REGISTRATION_SELECT = {
  id: true,
  athleteName: true,
  waveLabel: true,
  bibNumber: true,
  checkedInAt: true,
  teamId: true,
  team: { select: { name: true, bibNumber: true } },
} as const;

/** A team member shows the team's bib and name. */
function present<T extends TeamLink & { teamId: string | null }>(row: T | null) {
  if (!row) return null;
  const { team, teamId: _teamId, ...rest } = row;
  return { ...rest, bibNumber: entryBib(row), teamName: team?.name ?? null };
}

type CheckInEvent = {
  title: string;
  eventDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  timeZone: string;
  startsAtUtc: Date | null;
  endsAtUtc: Date | null;
  state: string;
  venue: string;
  city: string;
  status: string;
};

function checkInPayload(event: CheckInEvent) {
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

  return {
    state: window.state as CheckInState,
    opensAt: window.opensAt?.toISOString() ?? null,
    closesAt: window.closesAt?.toISOString() ?? null,
  };
}

/** The athlete's own registration for this event, optionally by id. */
async function findRegistration(
  eventId: string,
  session: { sub: string; email: string },
  registrationId?: string,
) {
  if (registrationId) {
    return prisma.registration.findFirst({
      where: {
        id: registrationId,
        eventId,
        status: "CONFIRMED",
        OR: [
          { athleteEmail: { equals: session.email, mode: "insensitive" } },
          { userId: session.sub },
        ],
      },
      select: REGISTRATION_SELECT,
    });
  }

  // Prefer the verified email: a buyer can own several entries in the same
  // event, and matching by userId first could check in a different athlete.
  const byEmail = await prisma.registration.findFirst({
    where: {
      eventId,
      status: "CONFIRMED",
      athleteEmail: { equals: session.email, mode: "insensitive" },
    },
    select: REGISTRATION_SELECT,
  });
  if (byEmail) return byEmail;

  // Guests whose account email differs from the one they registered with.
  return prisma.registration.findFirst({
    where: { eventId, status: "CONFIRMED", userId: session.sub },
    select: REGISTRATION_SELECT,
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const parsed = eventIdParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  const { eventId } = parsed.data;

  const registrationId =
    new URL(req.url).searchParams.get("registrationId")?.trim() || undefined;

  const event = await prisma.event.findFirst({
    where: { id: eventId, status: { in: ["APPROVED", "IN_PROGRESS", "ARCHIVED"] } },
    select: EVENT_SELECT,
  });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const registration = await findRegistration(eventId, session, registrationId);
  if (registrationId && !registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  return NextResponse.json({
    event,
    registration: present(registration),
    checkIn: checkInPayload(event),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = eventIdParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  const { eventId } = parsed.data;

  const body = await req.json().catch(() => null);
  const parsedBody = checkInBody.safeParse(body);
  const registrationId = parsedBody.success ? parsedBody.data.registrationId : undefined;

  const event = await prisma.event.findFirst({
    where: { id: eventId, status: { in: ["APPROVED", "IN_PROGRESS", "ARCHIVED"] } },
    select: EVENT_SELECT,
  });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const registration = await findRegistration(eventId, session, registrationId);
  if (!registration) {
    return NextResponse.json({ error: "You are not registered for this event." }, { status: 404 });
  }

  // Already checked in stays idempotent, even if the window has since closed.
  if (registration.checkedInAt) {
    return NextResponse.json({ checkedInAt: registration.checkedInAt });
  }

  const checkIn = checkInPayload(event);
  if (checkIn.state !== "open") {
    return NextResponse.json(
      {
        error: checkIn.state === "before"
          ? "Check-in isn't open yet."
          : "Check-in is closed for this event.",
        checkIn,
      },
      { status: 409 },
    );
  }

  // A team checks in together: any member's scan checks in the whole team.
  const checkedInAt = new Date();
  await prisma.registration.updateMany({
    where: registration.teamId
      ? { eventId, teamId: registration.teamId, status: "CONFIRMED", checkedInAt: null }
      : { id: registration.id },
    data: { checkedInAt },
  });

  return NextResponse.json({ checkedInAt });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { idParams } from "@/lib/schemas";
import { checkInWindow, checkInWindowJson } from "@/lib/check-in-window";
import { entryBib } from "@/lib/team-entries";
import { parseTicketQrPayload } from "@/lib/ticket-qr";

const scanSchema = z.object({
  qr: z.string().min(1).max(200),
});

const EVENT_SELECT = {
  id: true,
  organiserId: true,
  title: true,
  status: true,
  eventDate: true,
  endDate: true,
  startTime: true,
  endTime: true,
  timeZone: true,
  state: true,
  startsAtUtc: true,
  endsAtUtc: true,
  checkInLeadMinutes: true,
} as const;

const REGISTRATION_SELECT = {
  id: true,
  athleteName: true,
  waveLabel: true,
  bibNumber: true,
  checkedInAt: true,
  status: true,
  detailsPending: true,
  team: { select: { name: true, bibNumber: true } },
} as const;

function eventCheckIn(event: {
  eventDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  timeZone: string;
  state: string;
  status: string;
  startsAtUtc: Date | null;
  endsAtUtc: Date | null;
  checkInLeadMinutes: number | null;
}) {
  return checkInWindow(event);
}

async function ownedEvent(eventId: string, organiserId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: EVENT_SELECT,
  });
  if (!event) return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  if (event.organiserId !== organiserId) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { event };
}

function presentRegistration(row: {
  id: string;
  athleteName: string;
  waveLabel: string | null;
  bibNumber: string | null;
  checkedInAt: Date | null;
  status: string;
  detailsPending: boolean;
  team: { name: string; bibNumber: string | null } | null;
}) {
  const { team, detailsPending, ...rest } = row;
  return {
    ...rest,
    bibNumber: entryBib(row),
    teamName: team?.name ?? null,
    detailsPending,
  };
}

/** The scan screen's header: the event, its window and live attendance counts. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;

  const parsed = idParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const owned = await ownedEvent(parsed.data.id, auth.session.sub);
  if (owned.error) return owned.error;
  const event = owned.event!;

  if (!["APPROVED", "IN_PROGRESS", "ARCHIVED"].includes(event.status)) {
    return NextResponse.json(
      { error: "Attendance is only available for published events." },
      { status: 409 },
    );
  }

  const [confirmed, checkedIn] = await Promise.all([
    prisma.registration.count({ where: { eventId: event.id, status: "CONFIRMED" } }),
    prisma.registration.count({
      where: { eventId: event.id, status: "CONFIRMED", checkedInAt: { not: null } },
    }),
  ]);

  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      status: event.status,
      checkIn: checkInWindowJson(eventCheckIn(event)),
    },
    counts: { confirmed, checkedIn },
  });
}

/** Check in one entry from the organiser's gate scanner. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const parsedBody = scanSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Scan a ticket QR." }, { status: 400 });
  }

  const token = parseTicketQrPayload(parsedBody.data.qr);
  if (!token) {
    return NextResponse.json(
      { error: "This QR is not a Startline ticket.", code: "INVALID_TICKET" },
      { status: 400 },
    );
  }

  const owned = await ownedEvent(parsedParams.data.id, auth.session.sub);
  if (owned.error) return owned.error;
  const event = owned.event!;

  const registration = await prisma.registration.findFirst({
    where: { eventId: event.id, ticketToken: token },
    select: REGISTRATION_SELECT,
  });
  if (!registration) {
    return NextResponse.json(
      { error: "This ticket is not for this event.", code: "INVALID_TICKET" },
      { status: 404 },
    );
  }

  if (registration.status !== "CONFIRMED") {
    return NextResponse.json(
      {
        error: "This entry is no longer active.",
        code: "NOT_ACTIVE",
        registration: presentRegistration(registration),
      },
      { status: 409 },
    );
  }

  if (registration.detailsPending) {
    return NextResponse.json(
      {
        error: "This team place still needs the athlete's details.",
        code: "DETAILS_PENDING",
        registration: presentRegistration(registration),
      },
      { status: 409 },
    );
  }

  const window = eventCheckIn(event);
  if (window.state !== "open") {
    return NextResponse.json(
      {
        error:
          window.state === "before"
            ? "Check-in is not open yet."
            : "Check-in is closed for this event.",
        code: window.state === "before" ? "CHECK_IN_BEFORE" : "CHECK_IN_CLOSED",
        checkIn: checkInWindowJson(window),
        registration: presentRegistration(registration),
      },
      { status: 409 },
    );
  }

  const checkedInAt = new Date();
  const claimed = await prisma.registration.updateMany({
    where: {
      id: registration.id,
      eventId: event.id,
      status: "CONFIRMED",
      checkedInAt: null,
    },
    data: { checkedInAt },
  });

  if (claimed.count === 0) {
    const current = await prisma.registration.findUnique({
      where: { id: registration.id },
      select: REGISTRATION_SELECT,
    });
    if (current?.checkedInAt) {
      return NextResponse.json({
        result: "already_checked_in",
        checkedInAt: current.checkedInAt,
        registration: presentRegistration(current),
      });
    }
    return NextResponse.json(
      {
        error: "This entry is no longer active.",
        code: "NOT_ACTIVE",
        registration: current ? presentRegistration(current) : null,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    result: "checked_in",
    checkedInAt,
    registration: presentRegistration(registration),
  });
}

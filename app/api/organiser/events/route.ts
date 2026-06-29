import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { archivePastEvents } from "@/lib/archive-events";
import {
  buildEventCreateData,
  eventInclude,
  parseEventWritePayload,
  toEventResponse,
  validateEventPayload,
} from "@/lib/event-data";

export async function GET() {
  await archivePastEvents();
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const events = await prisma.event.findMany({
      where:   { organiserId: session.sub },
      orderBy: { createdAt: "desc" },
      include: eventInclude.listing,
    });
    return NextResponse.json(events.map((e) => toEventResponse(e)));
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const body = await req.json();
  const { submit } = body as { submit?: boolean };
  const payload = parseEventWritePayload(body);

  const validationError = validateEventPayload(payload, !!submit);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const eventStatus = submit
    ? (session.verified ? "APPROVED" : "PENDING")
    : "DRAFT";

  try {
    const event = await prisma.event.create({
      data: buildEventCreateData(session.sub, eventStatus, payload),
      include: eventInclude.full,
    });

    return NextResponse.json({ id: event.id, status: event.status });
  } catch (err) {
    console.error("Event create error:", err);
    return NextResponse.json({ error: "Failed to save event." }, { status: 500 });
  }
}

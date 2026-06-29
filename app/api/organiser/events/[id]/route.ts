import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import {
  buildEventUpdateData,
  eventInclude,
  eventResponseToWritePayload,
  mergeEventPayload,
  parseEventWritePayload,
  toEventResponse,
  validateEventPayload,
} from "@/lib/event-data";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: eventInclude.full,
    });
    if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (event.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    return NextResponse.json(toEventResponse(event));
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { submit } = body as { submit?: boolean };
  const payload = parseEventWritePayload(body);

  try {
    const existing = await prisma.event.findUnique({
      where:  { id },
      include: eventInclude.full,
    });

    if (!existing)
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (existing.organiserId !== session.sub)
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (existing.status !== "DRAFT")
      return NextResponse.json({ error: "Only draft events can be updated this way." }, { status: 409 });

    let payload = parseEventWritePayload(body);
    if (submit) {
      payload = mergeEventPayload(eventResponseToWritePayload(toEventResponse(existing)), payload);
    }

    const validationError = validateEventPayload(payload, !!submit);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...buildEventUpdateData(payload),
        status: submit ? "PENDING" : "DRAFT",
      },
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (err) {
    console.error("Event update error:", err);
    return NextResponse.json({ error: "Failed to update event." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    const existing = await prisma.event.findUnique({
      where:  { id },
      select: { organiserId: true },
    });

    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Event delete error:", err);
    return NextResponse.json({ error: "Failed to delete event." }, { status: 500 });
  }
}

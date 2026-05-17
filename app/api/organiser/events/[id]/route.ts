import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getOrganiserSession } from "@/lib/amplify-server";

const prisma = new PrismaClient();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (event.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// PATCH /api/organiser/events/[id] — update an existing draft
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { submit, ...data } = body;

  try {
    const existing = await prisma.event.findUnique({
      where:  { id },
      select: { organiserId: true, status: true },
    });

    if (!existing)
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (existing.organiserId !== session.sub)
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (existing.status !== "DRAFT")
      return NextResponse.json({ error: "Only draft events can be updated this way." }, { status: 409 });

    if (submit) {
      const required = ["title", "discipline", "eventDate", "startTime", "venue", "city", "state", "format", "level", "registrationUrl"];
      for (const field of required) {
        if (!data[field]) return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
      }
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        title:             data.title             ?? undefined,
        discipline:        data.discipline        ?? undefined,
        tagline:           data.tagline           ?? undefined,
        description:       data.description       ?? undefined,
        eventDate:         data.eventDate         ?? undefined,
        endDate:           data.endDate           ?? null,
        startTime:         data.startTime         ?? undefined,
        endTime:           data.endTime           || null,
        venue:             data.venue             ?? undefined,
        address:           data.address           ?? undefined,
        city:              data.city              ?? undefined,
        state:             data.state             ?? undefined,
        format:            data.format            ?? undefined,
        level:             data.level             ?? undefined,
        categories:        data.categories        ?? undefined,
        cap:               data.cap               ?? null,
        minAge:            data.minAge            ?? undefined,
        waves:             data.waves             ?? undefined,
        inclusions:        data.inclusions        ?? undefined,
        extras:            data.extras            ?? undefined,
        activations:       data.activations       ?? undefined,
        refundPolicy:      data.refundPolicy      ?? undefined,
        registrationUrl:   data.registrationUrl   ?? undefined,
        accessibilityInfo: data.accessibilityInfo ?? undefined,
        coverImageUrl:     data.coverImageUrl     ?? undefined,
        status:            submit ? "PENDING" : "DRAFT",
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

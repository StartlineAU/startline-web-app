import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getOrganiserSession } from "@/lib/amplify-server";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const events = await prisma.event.findMany({
      where:   { organiserId: session.sub },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, discipline: true, city: true, state: true,
        eventDate: true, startTime: true, status: true, createdAt: true,
        waves: true, registrationUrl: true, cap: true, isPinned: true,
        coverImageUrl: true, registrationCount: true,
      },
    });
    return NextResponse.json(events);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const body = await req.json();
  const { submit } = body;

  if (submit) {
    const required = ["title", "discipline", "eventDate", "startTime", "endTime", "venue", "city", "state", "format", "level", "registrationUrl"];
    for (const field of required) {
      if (!body[field]) return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
    }
  } else {
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "A title is required to save a draft." }, { status: 400 });
    }
  }

  try {
    const event = await prisma.event.create({
      data: {
        organiserId:      session.sub,
        status:           submit ? "PENDING" : "DRAFT",
        title:            body.title,
        discipline:       body.discipline        ?? "",
        tagline:          body.tagline           ?? null,
        description:      body.description       ?? null,
        eventDate:        body.eventDate         ?? "",
        endDate:          body.endDate           ?? null,
        startTime:        body.startTime         ?? "",
        endTime:          body.endTime           ?? "",
        venue:            body.venue             ?? "",
        address:          body.address           ?? null,
        city:             body.city              ?? "",
        state:            body.state             ?? "",
        format:           body.format            ?? "",
        level:            body.level             ?? "",
        categories:       body.categories        ?? [],
        cap:              body.cap               ?? null,
        minAge:           body.minAge            ?? 16,
        waves:            body.waves             ?? [],
        inclusions:       body.inclusions        ?? null,
        extras:           body.extras            ?? null,
        activations:      body.activations       ?? null,
        refundPolicy:     body.refundPolicy      ?? null,
        registrationUrl:  body.registrationUrl   ?? null,
        accessibilityInfo: body.accessibilityInfo ?? null,
        coverImageUrl:    body.coverImageUrl      ?? null,
      },
    });

    return NextResponse.json({ id: event.id, status: event.status });
  } catch (err) {
    console.error("Event create error:", err);
    return NextResponse.json({ error: "Failed to save event." }, { status: 500 });
  }
}

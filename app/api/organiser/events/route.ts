import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getOrganiserSession } from "@/lib/auth";

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
        eventDate: true, status: true, createdAt: true,
        waves: true, registrationUrl: true, cap: true,
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
  if (session.status !== "APPROVED") {
    return NextResponse.json({ error: "Your account must be approved before listing events." }, { status: 403 });
  }

  const body = await req.json();
  const { submit, ...data } = body;

  const required = ["title", "discipline", "eventDate", "startTime", "endTime", "venue", "city", "state", "format", "level", "registrationUrl"];
  for (const field of required) {
    if (!data[field]) {
      return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
    }
  }

  const event = await prisma.event.create({
    data: {
      ...data,
      organiserId: session.sub,
      categories:  data.categories  ?? [],
      waves:       data.waves        ?? [],
      status:      submit ? "PENDING" : "DRAFT",
    },
  });

  return NextResponse.json({ id: event.id, status: event.status });
}

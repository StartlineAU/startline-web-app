import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAthleteSession } from "@/lib/amplify-server";

export async function GET() {
  const session = await getAthleteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const athlete = await prisma.athlete.findUnique({
    where:  { id: session.sub },
    select: { id: true, email: true, name: true },
  });
  return NextResponse.json(athlete);
}

export async function PUT(req: Request) {
  const session = await getAthleteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const { name } = await req.json();
  const athlete = await prisma.athlete.update({
    where:  { id: session.sub },
    data:   { name: name?.trim() || null },
    select: { id: true, email: true, name: true },
  });
  return NextResponse.json(athlete);
}

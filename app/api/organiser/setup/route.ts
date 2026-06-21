import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";

export async function POST(req: Request) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const { orgName } = await req.json();
  if (!orgName?.trim()) {
    return NextResponse.json({ error: "Organisation name is required." }, { status: 400 });
  }

  const existing = await prisma.organiser.findUnique({
    where: { userId: session.sub },
  });
  if (existing) {
    return NextResponse.json({ error: "You already have an organiser profile." }, { status: 409 });
  }

  try {
    const organiser = await prisma.organiser.create({
      data: {
        userId: session.sub,
        email: session.email,
        orgName: orgName.trim(),
        verified: false,
        status: "APPROVED",
        abn: "",
        photos: [],
      },
      select: { id: true, orgName: true },
    });

    return NextResponse.json(organiser);
  } catch (err) {
    console.error("Organiser setup error:", err);
    return NextResponse.json({ error: "Failed to create organiser profile." }, { status: 500 });
  }
}

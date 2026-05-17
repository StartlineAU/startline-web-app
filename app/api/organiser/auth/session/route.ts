import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { getServerSession } from "@/lib/amplify-server";

const prisma = new PrismaClient();

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    await prisma.organiser.upsert({
      where:  { cognitoSub: session.sub },
      update: { email: session.email },
      create: {
        cognitoSub: session.sub,
        email:      session.email,
        status:     "APPROVED",
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Session upsert error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";
export async function POST() {
  const session = await getServerSession();

  if (!session || !session.groups.includes("admin-nonprod-users")) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    await prisma.admin.upsert({
      where:  { cognitoSub: session.sub },
      update: { email: session.email },
      create: { cognitoSub: session.sub, email: session.email },
      select: { id: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin session upsert error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

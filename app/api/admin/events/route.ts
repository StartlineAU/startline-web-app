import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";

  const events = await prisma.event.findMany({
    where:   status === "all" ? {} : { status: status as never },
    orderBy: { createdAt: "asc" },
    include: {
      organiser: {
        select: { id: true, orgName: true, email: true, contactName: true },
      },
    },
  });

  return NextResponse.json(events);
}

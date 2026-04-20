import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") ?? "PENDING_REVIEW";

  const organisers = await prisma.organiser.findMany({
    where:   status === "all" ? {} : { status: status as never },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, email: true, status: true, orgName: true, contactName: true,
      phone: true, abn: true, website: true, instagram: true, facebook: true,
      bio: true, logoUrl: true, insuranceUrl: true, pastEventsUrl: true,
      certifications: true, adminNotes: true, rejectionReason: true,
      createdAt: true, reviewedAt: true,
      _count: { select: { events: true } },
    },
  });

  return NextResponse.json(organisers);
}

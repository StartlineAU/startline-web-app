import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAdminSession } from "@/lib/amplify-server";

const prisma = new PrismaClient();

const VALID_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "ARCHIVED"] as const;
type EventStatus = (typeof VALID_STATUSES)[number];

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusParam = (searchParams.get("status") ?? "PENDING").toUpperCase();
  const status: EventStatus = (VALID_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as EventStatus)
    : "PENDING";

  try {
    const events = await prisma.event.findMany({
      where:   { status },
      orderBy: { createdAt: "desc" },
      select: {
        id:             true,
        title:          true,
        discipline:     true,
        city:           true,
        state:          true,
        eventDate:      true,
        startTime:      true,
        status:         true,
        createdAt:      true,
        coverImageUrl:  true,
        rejectionReason: true,
        reviewedAt:     true,
        organiser: {
          select: {
            id:          true,
            orgName:     true,
            contactName: true,
            email:       true,
          },
        },
      },
    });
    return NextResponse.json(events);
  } catch (err) {
    console.error("Admin events fetch error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

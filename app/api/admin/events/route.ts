import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
const VALID_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "ARCHIVED"] as const;
type EventStatus = (typeof VALID_STATUSES)[number];

const EVENT_SELECT = {
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
} as const;

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusParam = (searchParams.get("status") ?? "PENDING").toUpperCase();
  const status: EventStatus = (VALID_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as EventStatus)
    : "PENDING";

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const skip = (page - 1) * limit;

  try {
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where:   { status },
        orderBy: { createdAt: "desc" },
        select:  EVENT_SELECT,
        skip,
        take: limit,
      }),
      prisma.event.count({ where: { status } }),
    ]);

    const response = NextResponse.json({
      events,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    console.error("Admin events fetch error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

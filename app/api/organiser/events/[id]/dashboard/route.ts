import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getOrganiserSession } from "@/lib/amplify-server";

const prisma = new PrismaClient();

// Startline platform fee: 3% + $1 per registration
const PLATFORM_FEE_PERCENT = 0.03;
const PLATFORM_FEE_FIXED   = 1.00;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event)                            return NextResponse.json({ error: "Not found." },  { status: 404 });
    if (event.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (event.status !== "APPROVED")       return NextResponse.json({ error: "Dashboard only available for live events." }, { status: 409 });

    // Estimate payout using lowest wave price × registrationCount
    // Real registration breakdowns require the Registration model (Phase 2)
    const waves = (event.waves as { label: string; price: string; qty?: number }[]) ?? [];
    const lowestPrice = waves.length
      ? Math.min(...waves.map(w => parseFloat(w.price || "0")))
      : 0;

    const count    = event.registrationCount ?? 0;
    const gross    = lowestPrice * count;
    const fees     = count > 0 ? (gross * PLATFORM_FEE_PERCENT) + (count * PLATFORM_FEE_FIXED) : 0;
    const netPayout = Math.max(0, gross - fees);

    const announcements = await prisma.announcement.findMany({
      where:   { eventId: id },
      orderBy: { createdAt: "desc" },
      select:  { id: true, title: true, body: true, createdAt: true },
    });

    return NextResponse.json({
      event: {
        id:                event.id,
        title:             event.title,
        discipline:        event.discipline,
        eventDate:         event.eventDate,
        endDate:           event.endDate,
        startTime:         event.startTime,
        endTime:           event.endTime,
        venue:             event.venue,
        city:              event.city,
        state:             event.state,
        cap:               event.cap,
        registrationCount: event.registrationCount,
        coverImageUrl:     event.coverImageUrl,
        waves,
        feeStructure:      event.feeStructure,
        categories:        event.categories,
      },
      payout: {
        registrationCount: count,
        lowestTicketPrice: lowestPrice,
        grossRevenue:      gross,
        platformFees:      fees,
        estimatedPayout:   netPayout,
        feeStructure:      event.feeStructure, // "athlete" | "organiser"
        note: "Estimates based on lowest ticket price × registration count. Actual amounts depend on ticket tier mix.",
      },
      announcements,
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

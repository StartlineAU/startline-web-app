import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { archivePastEvents } from "@/lib/archive-events";
import { PLATFORM_FEE_PERCENT, PLATFORM_FEE_FIXED_CENTS } from "@/lib/platform-fee";
import { eventInclude, getWaves, toEventResponse } from "@/lib/event-data";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    await archivePastEvents();
    const event = await prisma.event.findUnique({
      where: { id },
      include: eventInclude.full,
    });

    if (!event)                            return NextResponse.json({ error: "Not found." },  { status: 404 });
    if (event.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (event.status !== "APPROVED")       return NextResponse.json({ error: "Dashboard only available for live events." }, { status: 409 });

    const eventResponse = toEventResponse(event);
    const waves = getWaves(eventResponse);
    const lowestPrice = waves.length
      ? Math.min(...waves.map(w => parseFloat(w.price || "0")))
      : 0;

    const [registrations, registrationCount] = await Promise.all([
      prisma.registration.findMany({
        where:   { eventId: id, status: "CONFIRMED" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, athleteName: true, athleteEmail: true, category: true,
          waveLabel: true, amountCents: true, platformFeeCents: true, createdAt: true,
        },
      }),
      prisma.registration.count({ where: { eventId: id, status: "CONFIRMED" } }),
    ]);

    const count = registrationCount;
    const hasRealData = count > 0;

    let gross: number;
    let fees: number;
    if (hasRealData) {
      gross = registrations.reduce((sum, r) => sum + r.amountCents, 0) / 100;
      fees  = registrations.reduce((sum, r) => sum + r.platformFeeCents, 0) / 100;
    } else {
      gross = lowestPrice * count;
      fees  = count > 0 ? (gross * PLATFORM_FEE_PERCENT) + (count * PLATFORM_FEE_FIXED_CENTS / 100) : 0;
    }
    const netPayout = Math.max(0, gross - fees);

    const recentRegistrations = registrations.slice(0, 20).map(r => ({
      id:         r.id,
      name:       r.athleteName,
      email:      r.athleteEmail,
      category:   r.category,
      wave:       r.waveLabel,
      amount:     r.amountCents / 100,
      createdAt:  r.createdAt,
    }));

    const announcements = await prisma.announcement.findMany({
      where:   { eventId: id },
      orderBy: { createdAt: "desc" },
      select:  { id: true, title: true, body: true, createdAt: true },
    });

    const feeStructure = event.tickets?.feeStructure ?? "athlete";

    return NextResponse.json({
      event: {
        id:                event.id,
        title:             event.basics?.title ?? "",
        discipline:        event.format?.discipline ?? "",
        eventDate:         event.schedule?.eventDate ?? "",
        endDate:           event.schedule?.endDate ?? null,
        startTime:         event.schedule?.startTime ?? "",
        endTime:           event.schedule?.endTime ?? null,
        venue:             event.schedule?.venue ?? "",
        city:              event.schedule?.city ?? "",
        state:             event.schedule?.state ?? "",
        cap:               event.format?.cap ?? null,
        registrationCount: count,
        coverImageUrl:     event.details?.coverImageUrl ?? null,
        waves,
        feeStructure,
        categories:        eventResponse.format?.categories ?? [],
      },
      payout: {
        registrationCount: count,
        lowestTicketPrice: lowestPrice,
        grossRevenue:      gross,
        platformFees:      fees,
        estimatedPayout:   netPayout,
        feeStructure,
        isEstimate:        !hasRealData,
        note: hasRealData
          ? "Based on confirmed registrations."
          : "Estimate based on lowest ticket price × registration count. Actual amounts depend on ticket tier mix.",
      },
      recentRegistrations,
      announcements,
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

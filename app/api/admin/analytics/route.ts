import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const [
      eventsByStatus,
      confirmedCount,
      revenueAgg,
      platformFeeAgg,
      topEvents,
      organisersByStatus,
      totalUsers,
      recentMonths,
    ] = await Promise.all([
      prisma.event.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.registration.count({ where: { status: "CONFIRMED" } }),
      prisma.registration.aggregate({
        where: { status: "CONFIRMED" },
        _sum: { amountCents: true },
      }),
      prisma.registration.aggregate({
        where: { status: "CONFIRMED" },
        _sum: { platformFeeCents: true },
      }),
      prisma.event.findMany({
        where: { status: "APPROVED" },
        orderBy: { registrations: { _count: "desc" } },
        take: 5,
        select: {
          id: true,
          title: true,
          city: true,
          state: true,
          eventDate: true,
          _count: { select: { registrations: true } },
        },
      }),
      prisma.organiser.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.user.count(),
      prisma.$queryRaw<{ month: string; count: bigint }[]>`
        SELECT
          TO_CHAR("createdAt", 'YYYY-MM') AS month,
          COUNT(*)::bigint               AS count
        FROM registrations
        WHERE "createdAt" >= NOW() - INTERVAL '6 months'
          AND status = 'CONFIRMED'
        GROUP BY month
        ORDER BY month ASC
      `,
    ]);

    const statusMap         = Object.fromEntries(eventsByStatus.map((r)    => [r.status,  r._count.id]));
    const organiserStatusMap = Object.fromEntries(organisersByStatus.map((r) => [r.status, r._count.id]));

    const res = NextResponse.json({
      events: {
        draft:    statusMap["DRAFT"]    ?? 0,
        pending:  statusMap["PENDING"]  ?? 0,
        approved: statusMap["APPROVED"] ?? 0,
        rejected: statusMap["REJECTED"] ?? 0,
        archived: statusMap["ARCHIVED"] ?? 0,
      },
      registrations: {
        total:          confirmedCount,
        revenueAud:     (revenueAgg._sum.amountCents    ?? 0) / 100,
        platformFeeAud: (platformFeeAgg._sum.platformFeeCents ?? 0) / 100,
      },
      topEvents: topEvents.map((e) => ({
        id:                e.id,
        title:             e.title,
        city:              e.city,
        state:             e.state,
        eventDate:         e.eventDate,
        registrationCount: e._count.registrations,
      })),
      organisers: {
        active:    organiserStatusMap["APPROVED"]  ?? 0,
        suspended: organiserStatusMap["SUSPENDED"] ?? 0,
      },
      users: { total: totalUsers },
      registrationsByMonth: recentMonths.map((r) => ({
        month: r.month,
        count: Number(r.count),
      })),
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    console.error("Admin analytics error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

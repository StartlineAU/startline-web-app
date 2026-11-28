import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { idParams } from "@/lib/schemas";
import { ACTIVE_ORGANISER_WHERE, registrationOpenAt } from "@/lib/event-lifecycle";
import { confirmedUnitsByWave, teamSizeOf } from "@/lib/team-tickets";
import { HOLDS_PLACE_WHERE } from "@/lib/registration-status";

export const dynamic = "force-dynamic";

/**
 * Live ticket availability for an event's registration page: the event cap and
 * confirmed (paid) counts, both overall and per tier. Mirrors the server-side
 * capacity guard in /api/checkout so the client can show sold-out tiers and
 * stop the buyer before they fill out a form for tickets that no longer exist.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }
  const { id } = parsedParams.data;

  const event = await prisma.event.findUnique({
    where: { id, ...ACTIVE_ORGANISER_WHERE },
    select: {
      id: true, cap: true, waves: true, status: true, registrationType: true,
      startsAtUtc: true, endsAtUtc: true,
    },
  });

  if (!event || !registrationOpenAt(event) || event.registrationType !== "startline") {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  // Pending refund requests still hold their place (lib/registration-status.ts).
  const confirmedWhere = { eventId: id, ...HOLDS_PLACE_WHERE };
  const [confirmed, grouped] = await Promise.all([
    prisma.registration.count({ where: confirmedWhere }),
    prisma.registration.groupBy({
      by: ["waveLabel", "teamId"],
      where: confirmedWhere,
      _count: { _all: true },
    }),
  ]);

  // Per tier: tickets, or teams for a team tier. `confirmed` overall is people,
  // which is what the event cap counts.
  const confirmedByWave = confirmedUnitsByWave(grouped);

  const waves = (event.waves as { label: string; qty?: number; teamSize?: number }[] | null) ?? [];

  return NextResponse.json({
    cap: event.cap,
    confirmed,
    waves: waves.map((w) => ({
      label: w.label,
      qty: typeof w.qty === "number" ? w.qty : null,
      confirmed: confirmedByWave[w.label] ?? 0,
      teamSize: teamSizeOf(w),
    })),
  });
}

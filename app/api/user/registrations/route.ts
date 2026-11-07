import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import {
  daysUntil,
  describeTiers,
  parseTiers,
  refundAmountCents,
  refundPercentFor,
} from "@/lib/refund-policy";
import { checkInWindow } from "@/lib/check-in-window";
import { entryPaidCents } from "@/lib/stripe-refunds";
import { describeChangeValue, type EventFieldChange } from "@/lib/event-change-log";

/** GET — confirmed registrations for the signed-in athlete (wave + bib for Activity). */
export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const registrations = await prisma.registration.findMany({
    where: {
      // Show live entries plus any with a refund in flight, so the athlete can see
      // the pending state rather than having the card vanish on request.
      status: { in: ["CONFIRMED", "REFUND_REQUESTED", "REFUNDED"] },
      OR: [
        { userId: session.sub },
        { athleteEmail: { equals: session.email, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      eventId: true,
      status: true,
      athleteName: true,
      startWaveLabel: true,
      bibNumber: true,
      checkedInAt: true,
      // Money and policy, so Activity can quote the refund before the athlete
      // commits rather than asking them to request one blind.
      amountCents: true,
      platformFeeCents: true,
      feeStructure: true,
      refundType: true,
      fullRefundUntil: true,
      fullRefundChangeId: true,
      refundPercent: true,
      refundAmountCents: true,
      refundOutsidePolicy: true,
      event: {
        select: {
          id: true,
          title: true,
          discipline: true,
          eventDate: true,
          endDate: true,
          startTime: true,
          endTime: true,
          timeZone: true,
          startsAtUtc: true,
          endsAtUtc: true,
          status: true,
          city: true,
          state: true,
          coverImageUrl: true,
          refundTiers: true,
        },
      },
    },
    take: 50,
  });

  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();

  // What changed, for entries holding a full-refund entitlement, so the athlete
  // sees why they can have everything back rather than just that they can.
  const changeIds = [...new Set(
    registrations
      .filter((r) => r.status === "CONFIRMED" && r.fullRefundUntil && r.fullRefundUntil.getTime() > now)
      .map((r) => r.fullRefundChangeId)
      .filter((id): id is string => !!id),
  )];
  const changeRows = changeIds.length
    ? await prisma.eventChange.findMany({
        where: { id: { in: changeIds } },
        select: { id: true, changes: true, createdAt: true },
      })
    : [];
  const changesById = new Map(
    changeRows.map((c) => [
      c.id,
      {
        changedAt: c.createdAt.toISOString(),
        lines: (Array.isArray(c.changes) ? (c.changes as unknown as EventFieldChange[]) : [])
          .filter((line) => line.material)
          .map((line) => ({
            label: line.label,
            from: describeChangeValue(line.field, line.from),
            to: describeChangeValue(line.field, line.to),
          })),
      },
    ]),
  );

  return NextResponse.json({
    registrations: registrations.map((r) => {
      // What this entry's payer handed over; the fee only when they paid it.
      const paidCents = entryPaidCents(r);
      const fullRefundOpen =
        r.status === "CONFIRMED" && paidCents > 0 &&
        r.fullRefundUntil != null && r.fullRefundUntil.getTime() > now;
      const tiers = parseTiers(r.event.refundTiers);
      const days = daysUntil(r.event.eventDate, today);
      const window = checkInWindow({
        eventDate: r.event.eventDate,
        endDate: r.event.endDate,
        startTime: r.event.startTime,
        endTime: r.event.endTime,
        timeZone: r.event.timeZone,
        state: r.event.state,
        status: r.event.status,
        startsAtUtc: r.event.startsAtUtc,
        endsAtUtc: r.event.endsAtUtc,
      });
      return {
        id: r.id,
        eventId: r.eventId,
        status: r.status,
        athleteName: r.athleteName,
        wave: r.startWaveLabel,
        bibNumber: r.bibNumber,
        checkedInAt: r.checkedInAt?.toISOString() ?? null,
        checkInState: window.state,
        checkInOpensAt: window.opensAt?.toISOString() ?? null,
        checkInClosesAt: window.closesAt?.toISOString() ?? null,
        timeZone: r.event.timeZone,
        paidCents,
        // Once a refund is in flight the frozen snapshot wins, so the athlete is
        // never shown a different number than the one they agreed to.
        refundAmountCents: r.refundAmountCents ?? (fullRefundOpen ? paidCents : refundAmountCents(tiers, paidCents, days)),
        refundPercent: r.refundPercent ?? (fullRefundOpen ? 100 : refundPercentFor(tiers, days)),
        refundType: r.refundType,
        outsidePolicy: r.refundOutsidePolicy,
        ticketCents: r.amountCents,
        feeCents: paidCents - r.amountCents,
        // Set while the organiser's change entitles this entry to everything back.
        fullRefund: fullRefundOpen
          ? {
              until: r.fullRefundUntil!.toISOString(),
              change: (r.fullRefundChangeId && changesById.get(r.fullRefundChangeId)) || null,
            }
          : null,
        policyLines: describeTiers(tiers),
        daysUntilEvent: days,
        event: r.event,
      };
    }),
  });
}

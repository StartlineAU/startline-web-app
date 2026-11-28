import { NextResponse } from "next/server";
import { athleteRaceFields } from "@/lib/race-features";
import { entryBib } from "@/lib/team-entries";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import {
  changeOfMindQuote,
  daysUntil,
  describeTiers,
  parseTiers,
  policyToday,
} from "@/lib/refund-policy";
import { checkInWindow } from "@/lib/check-in-window";
import { entryPaidCents } from "@/lib/stripe-refunds";
import { isSuggestedByEmail } from "@/lib/profile-history";
import { canRequestRefund, isOwnEntry } from "@/lib/own-entry";

/** GET — confirmed registrations for the signed-in athlete (wave + bib for Activity). */
export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const registrations = await prisma.registration.findMany({
    where: {
      // Show live entries plus any with a refund in flight, so the athlete can see
      // the pending state rather than having the card vanish on request. A
      // removal by the organiser shows too, so it is never a silent disappearance.
      status: { in: ["CONFIRMED", "REFUND_REQUESTED", "REFUNDED", "REMOVED"] },
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
      athleteEmail: true,
      soldRefundTiers: true,
      userId: true,
      athleteUserId: true,
      startWaveLabel: true,
      bibNumber: true,
      team: { select: { name: true, bibNumber: true, size: true } },
      detailsPending: true,
      checkedInAt: true,
      amountCents: true,
      platformFeeCents: true,
      feeStructure: true,
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
          checkInLeadMinutes: true,
          status: true,
          city: true,
          state: true,
          coverImageUrl: true,
          refundTiers: true,
          waveMode: true,
          bibMode: true,
        },
      },
    },
    take: 50,
  });

  // Counted the way the refund form counts it (Sydney date, the policy the
  // entry was sold under, the 24-hour cutoff), so Activity never quotes a
  // different number from the one the request records.
  const now = new Date();
  const today = policyToday(now);

  return NextResponse.json({
    registrations: registrations.map((r) => {
      // What this entry's payer handed over; the fee only when they paid it.
      const paidCents = entryPaidCents(r);
      const tiers = parseTiers(r.soldRefundTiers ?? r.event.refundTiers);
      const days = daysUntil(r.event.eventDate, today);
      const quote = changeOfMindQuote(
        {
          amountCents: r.amountCents,
          soldRefundTiers: r.soldRefundTiers,
          eventRefundTiers: r.event.refundTiers,
          eventDate: r.event.eventDate,
          startsAtUtc: r.event.startsAtUtc,
        },
        now,
      );
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
        checkInLeadMinutes: r.event.checkInLeadMinutes,
      });
      const race = athleteRaceFields(r.event, { startWaveLabel: r.startWaveLabel, bibNumber: entryBib(r) });
      return {
        id: r.id,
        eventId: r.eventId,
        status: r.status,
        athleteName: r.athleteName,
        // Private until the organiser shares them (#566). A team entry
        // carries the team's bib.
        wave: race.wave,
        bibNumber: race.bib,
        teamName: r.team?.name ?? null,
        teamSize: r.team?.size ?? null,
        // A team place bought "details later": Activity asks for its member.
        detailsPending: r.detailsPending,
        // Race history is opt-in (#598): an entry someone else bought under
        // this address is offered, never added for them.
        onProfile: r.status === "CONFIRMED" && r.athleteUserId === session.sub,
        canAddToProfile: isSuggestedByEmail(r, { id: session.sub, email: session.email }),
        // A group purchase lists every place the buyer paid for. The athlete
        // and the buyer can each ask for a place's refund.
        ownEntry: isOwnEntry(r, session),
        canRefund: canRequestRefund(r, session),
        checkedInAt: r.checkedInAt?.toISOString() ?? null,
        checkInState: window.state,
        checkInOpensAt: window.opensAt?.toISOString() ?? null,
        checkInClosesAt: window.closesAt?.toISOString() ?? null,
        timeZone: r.event.timeZone,
        paidCents,
        // Once a refund is in flight the frozen snapshot wins, so the athlete is
        // never shown a different number than the one they agreed to.
        // A cancelled event owes everything back, whatever the policy said.
        refundAmountCents: r.event.status === "CANCELLED"
          ? paidCents
          // Change of mind returns a share of the ticket price, never the booking fee.
          : r.refundAmountCents ?? quote.cents,
        eventCancelled: r.event.status === "CANCELLED",
        refundPercent: r.refundPercent ?? quote.percent,
        outsidePolicy: r.refundOutsidePolicy,
        ticketCents: r.amountCents,
        feeCents: paidCents - r.amountCents,
        policyLines: describeTiers(tiers),
        daysUntilEvent: days,
        event: r.event,
      };
    }),
  });
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";
import { idParams } from "@/lib/schemas";
import { RefundError, issueEntryRefund, refundEntrySelect } from "@/lib/issue-entry-refund";
import { refundWithinCutoff } from "@/lib/refund-policy";
import { entryPaidCents } from "@/lib/stripe-refunds";
import { TEAM_HELD_STATUSES } from "@/lib/team-tickets";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const registration = await prisma.registration.findUnique({
      where: { id },
      select: {
        ...refundEntrySelect,
        teamId: true,
        event: { select: { id: true, title: true, startsAtUtc: true } },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    // Change-of-mind refunds stop 24 hours before the start. A free entry has
    // nothing to refund, and a cancellation is not a refund.
    const paid = registration.amountCents + registration.platformFeeCents > 0;
    if (paid && refundWithinCutoff(registration.event.startsAtUtc)) {
      return NextResponse.json(
        { error: "Refunds are not available within 24 hours of the event start." },
        { status: 409 },
      );
    }

    // A team entry already refunded, with teammates still holding places, is
    // a team refund that stopped part-way. Asking again finishes it rather
    // than failing on this entry's status.
    const resumingTeam =
      registration.status === "REFUNDED" &&
      !!registration.teamId &&
      (await prisma.registration.count({
        where: { teamId: registration.teamId, id: { not: id }, status: { in: TEAM_HELD_STATUSES } },
      })) > 0;

    let result: Awaited<ReturnType<typeof issueEntryRefund>> | null = null;
    if (!resumingTeam) {
      result = await issueEntryRefund(registration);
      // Logged before the teammates are touched: this refund has happened
      // whatever happens to theirs.
      await writeAuditLog({
        adminId: session.sub,
        action: "REFUND_REGISTRATION",
        targetType: "registration",
        targetId: id,
        meta: result.method === "free"
          ? { method: "free", athleteName: registration.athleteName }
          : {
              stripeRefundId: result.refundId,
              refundCents: result.refundCents,
              amountCents: registration.amountCents,
              athleteName: registration.athleteName,
            },
      });
    }

    // A team is refunded as one: every other member still holding a place is
    // refunded too, at the same share of what they paid as this entry got.
    const team = registration.teamId
      ? await refundTeammates(registration.teamId, registration.id, registration.refundPercent)
      : { refunded: [], failed: [] };
    for (const mate of team.refunded) {
      await writeAuditLog({
        adminId: session.sub,
        action: "REFUND_REGISTRATION",
        targetType: "registration",
        targetId: mate.id,
        meta: { teamRefundOf: id, refundCents: mate.refundCents, athleteName: mate.athleteName },
      });
    }

    const body = {
      ok: true,
      ...(result?.method === "free" ? { method: "free" } : result ? { refundId: result.refundId } : {}),
      teamRefunded: team.refunded.map((m) => m.id),
      teamFailed: team.failed,
    };
    if (team.failed.length > 0) {
      // This entry (and any teammates listed) are refunded. The rest are not,
      // and refunding this entry again picks them up.
      return NextResponse.json(
        {
          ...body,
          ok: false,
          error: `Could not refund ${team.failed.map((f) => f.athleteName).join(", ")}: ${team.failed[0].error} Refund this entry again to retry the rest of the team.`,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof RefundError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Admin refund error:", err);
    return NextResponse.json({ error: "Refund failed." }, { status: 503 });
  }
}

/**
 * Refund every other member of a team whose place is still held. A member with
 * no frozen refund quote takes the same percentage as the team's refund (this
 * entry's, or an earlier member's when resuming); with no percentage on record
 * they get back what they paid.
 *
 * Each member is its own Stripe refund with its own idempotency key, and one
 * failing does not stop the rest, so a retry only has the failures left to do.
 */
async function refundTeammates(
  teamId: string,
  excludeId: string,
  percent: number | null,
): Promise<{
  refunded: { id: string; athleteName: string; refundCents: number }[];
  failed: { id: string; athleteName: string; error: string }[];
}> {
  const teamPercent = percent ?? (
    await prisma.registration.findFirst({
      where: { teamId, status: "REFUNDED", refundPercent: { not: null } },
      select: { refundPercent: true },
    })
  )?.refundPercent ?? null;

  const mates = await prisma.registration.findMany({
    where: { teamId, id: { not: excludeId }, status: { in: TEAM_HELD_STATUSES } },
    select: refundEntrySelect,
  });
  const refunded: { id: string; athleteName: string; refundCents: number }[] = [];
  const failed: { id: string; athleteName: string; error: string }[] = [];
  for (const mate of mates) {
    try {
      let entry = mate;
      if (mate.refundAmountCents == null && teamPercent != null) {
        const refundAmountCents = Math.round((entryPaidCents(mate) * teamPercent) / 100);
        entry = await prisma.registration.update({
          where: { id: mate.id },
          data: { refundAmountCents, refundPercent: teamPercent },
          select: refundEntrySelect,
        });
      }
      const result = await issueEntryRefund(entry);
      refunded.push({ id: mate.id, athleteName: mate.athleteName, refundCents: result.refundCents });
    } catch (err) {
      console.error("Team refund failed for", mate.id, err);
      failed.push({
        id: mate.id,
        athleteName: mate.athleteName,
        error: err instanceof RefundError ? err.message : "Stripe did not accept the refund.",
      });
    }
  }
  return { refunded, failed };
}

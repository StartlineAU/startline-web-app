import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";
import { idParams } from "@/lib/schemas";
import { RefundError, issueEntryRefund, refundEntrySelect } from "@/lib/issue-entry-refund";
import { refundWithinCutoff } from "@/lib/refund-policy";
import { entryPaidCents } from "@/lib/stripe-refunds";

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

    const result = await issueEntryRefund(registration);

    // A team is refunded as one: every other member still holding a place is
    // refunded too, at the same share of what they paid as this entry got.
    // Each member is its own Stripe refund with its own idempotency key, so a
    // retry after a partial failure picks up where it stopped.
    const teamRefunds = registration.teamId
      ? await refundTeammates(registration.teamId, registration.id, registration.refundPercent)
      : [];
    for (const mate of teamRefunds) {
      await writeAuditLog({
        adminId: session.sub,
        action: "REFUND_REGISTRATION",
        targetType: "registration",
        targetId: mate.id,
        meta: { teamRefundOf: id, refundCents: mate.refundCents, athleteName: mate.athleteName },
      });
    }

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

    return result.method === "free"
      ? NextResponse.json({ ok: true, method: "free", teamRefunded: teamRefunds.length })
      : NextResponse.json({ ok: true, refundId: result.refundId, teamRefunded: teamRefunds.length });
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
 * no frozen refund quote takes the same percentage as the entry that started
 * the refund; with no percentage on record they get back what they paid.
 */
async function refundTeammates(
  teamId: string,
  excludeId: string,
  percent: number | null,
): Promise<{ id: string; athleteName: string; refundCents: number }[]> {
  const mates = await prisma.registration.findMany({
    where: { teamId, id: { not: excludeId }, status: { in: ["CONFIRMED", "REFUND_REQUESTED"] } },
    select: refundEntrySelect,
  });
  const done: { id: string; athleteName: string; refundCents: number }[] = [];
  for (const mate of mates) {
    let entry = mate;
    if (mate.refundAmountCents == null && percent != null) {
      const refundAmountCents = Math.round((entryPaidCents(mate) * percent) / 100);
      entry = await prisma.registration.update({
        where: { id: mate.id },
        data: { refundAmountCents, refundPercent: percent },
        select: refundEntrySelect,
      });
    }
    const result = await issueEntryRefund(entry);
    done.push({ id: mate.id, athleteName: mate.athleteName, refundCents: result.refundCents });
  }
  return done;
}

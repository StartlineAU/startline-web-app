import prisma from "@/lib/prisma";
import { RefundError, issueEntryRefund, refundEntrySelect } from "@/lib/issue-entry-refund";
import { entryPaidCents } from "@/lib/stripe-refunds";
import { TEAM_HELD_STATUSES } from "@/lib/team-tickets";

export interface TeamRefundResult {
  refunded: { id: string; athleteName: string; refundCents: number }[];
  failed: { id: string; athleteName: string; error: string }[];
}

/**
 * How much each teammate gets back:
 * - `percent`: the same share of the ticket price as the team's refund. A
 *   member with no frozen quote takes this entry's percentage (or an earlier
 *   member's when resuming); with no percentage on record they get back what
 *   they paid.
 * - `full`: everything they paid, booking fee included (#492).
 */
export type TeamRefundMode = { kind: "percent"; percent: number | null } | { kind: "full" };

/**
 * Refund every other member of a team whose place is still held. A team is
 * refunded as one.
 *
 * Each member is its own Stripe refund with its own idempotency key, and one
 * failing does not stop the rest, so a retry only has the failures left to do.
 */
export async function refundTeammates(
  teamId: string,
  excludeId: string,
  mode: TeamRefundMode,
): Promise<TeamRefundResult> {
  const teamPercent =
    mode.kind === "full"
      ? 100
      : mode.percent ??
        (
          await prisma.registration.findFirst({
            where: { teamId, status: "REFUNDED", refundPercent: { not: null } },
            select: { refundPercent: true },
          })
        )?.refundPercent ??
        null;

  const mates = await prisma.registration.findMany({
    where: { teamId, id: { not: excludeId }, status: { in: TEAM_HELD_STATUSES } },
    select: refundEntrySelect,
  });
  const refunded: TeamRefundResult["refunded"] = [];
  const failed: TeamRefundResult["failed"] = [];
  for (const mate of mates) {
    try {
      let entry = mate;
      if (mode.kind === "full") {
        entry = await prisma.registration.update({
          where: { id: mate.id },
          data: { refundAmountCents: entryPaidCents(mate), refundPercent: 100 },
          select: refundEntrySelect,
        });
      } else if (mate.refundAmountCents == null && teamPercent != null) {
        // The same share of the ticket price; the booking fee is not refunded.
        const refundAmountCents = Math.round((mate.amountCents * teamPercent) / 100);
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

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { RefundTier } from "@/lib/refund-policy";

/**
 * Save the organisation's change-of-mind policy and apply it to every listing.
 * Entries that have not yet had a policy frozen keep the tiers the event
 * showed before this save, so a later change does not rewrite what they paid against.
 */
export async function saveOrganisationRefundPolicy(
  organiserId: string,
  refundTiers: RefundTier[],
  refundPolicy: string | null,
) {
  await prisma.$transaction(async (tx) => {
    // Freeze every listing's current tiers onto its unfrozen entries in one
    // statement. This used to be one update per event, so an organisation with
    // many listings paid a round trip for each inside the transaction.
    await tx.$executeRaw`
      UPDATE registrations AS r
      SET "soldRefundTiers" = COALESCE(NULLIF(e."refundTiers", 'null'::jsonb), '[]'::jsonb)
      FROM events AS e
      WHERE r."eventId" = e.id
        AND e."organiserId" = ${organiserId}
        AND r."soldRefundTiers" IS NULL
    `;
    await tx.organiser.update({
      where: { id: organiserId },
      data: {
        refundTiers: refundTiers as unknown as Prisma.InputJsonValue,
        refundPolicy,
      },
    });
    await tx.event.updateMany({
      where: { organiserId },
      data: {
        refundTiers: refundTiers as unknown as Prisma.InputJsonValue,
        refundPolicy,
      },
    });
  });
}

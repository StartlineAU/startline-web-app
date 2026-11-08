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
  const events = await prisma.event.findMany({
    where: { organiserId },
    select: { id: true, refundTiers: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const event of events) {
      await tx.registration.updateMany({
        where: { eventId: event.id, soldRefundTiers: { equals: Prisma.DbNull } },
        data: { soldRefundTiers: (event.refundTiers ?? []) as Prisma.InputJsonValue },
      });
    }
    await tx.organiser.update({
      where: { id: organiserId },
      data: {
        refundTiers: refundTiers as unknown as Prisma.InputJsonValue,
        refundPolicy,
      },
    });
    if (events.length > 0) {
      await tx.event.updateMany({
        where: { organiserId },
        data: {
          refundTiers: refundTiers as unknown as Prisma.InputJsonValue,
          refundPolicy,
        },
      });
    }
  });
}

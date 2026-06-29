import type { PrismaClient } from "@prisma/client";

/** Persist scheduleSlots / cutoffDate via SQL — works even if Prisma client is stale. */
export async function syncEventScheduleFields(
  prisma: PrismaClient,
  eventId: string,
  multipleTimeSlots: boolean,
  scheduleSlots: unknown,
  cutoffDate: string | null | undefined,
  eventDate: string,
): Promise<void> {
  const slots = multipleTimeSlots ? (scheduleSlots ?? []) : [];
  const cutoff = multipleTimeSlots ? (cutoffDate ?? eventDate ?? null) : null;

  await prisma.$executeRawUnsafe(
    `UPDATE "events" SET "scheduleSlots" = $1::jsonb, "cutoffDate" = $2, "updatedAt" = NOW() WHERE id = $3`,
    JSON.stringify(slots),
    cutoff,
    eventId,
  );
}

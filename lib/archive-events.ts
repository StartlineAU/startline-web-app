import prisma from "@/lib/prisma";

export async function archivePastEvents(): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const result = await prisma.$executeRaw`
    UPDATE "events" e
    SET status = 'ARCHIVED', "updatedAt" = NOW()
    FROM "event_schedules" s
    WHERE e.id = s."eventId"
    AND e.status = 'APPROVED'
    AND (
      s."endDate" IS NOT NULL AND s."endDate" < ${today}
      OR
      s."endDate" IS NULL AND s."eventDate" < ${today}
    )
  `;
  return result;
}

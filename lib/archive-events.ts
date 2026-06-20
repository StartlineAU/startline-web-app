import prisma from "@/lib/prisma";

export async function archivePastEvents(): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const result = await prisma.$executeRaw`
    UPDATE "events"
    SET status = 'ARCHIVED', "updatedAt" = NOW()
    WHERE status = 'APPROVED'
    AND (
      "endDate" IS NOT NULL AND "endDate" < ${today}
      OR
      "endDate" IS NULL AND "eventDate" < ${today}
    )
  `;
  return result;
}

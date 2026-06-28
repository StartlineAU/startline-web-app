import prisma from "@/lib/prisma";
import { levelFromPoints, POINTS_PER_REGISTRATION } from "@/lib/user-level";

export async function awardRegistrationPoints(
  userId: string,
  registrationId: string,
): Promise<void> {
  const existing = await prisma.pointsLedger.findUnique({
    where: { registrationId },
  });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    await tx.pointsLedger.create({
      data: {
        userId,
        amount: POINTS_PER_REGISTRATION,
        reason: "event_registration",
        registrationId,
      },
    });

    const user = await tx.user.update({
      where: { id: userId },
      data: { points: { increment: POINTS_PER_REGISTRATION } },
      select: { points: true },
    });

    await tx.user.update({
      where: { id: userId },
      data: { level: levelFromPoints(user.points) },
    });
  });
}

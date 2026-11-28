import prisma from "@/lib/prisma";
import { unclaimedByEmailWhere } from "@/lib/profile-history";

/**
 * Pin entries someone else bought under this account's verified email to the
 * account (#592). A buyer who names a team member later, or enters a friend,
 * only has the address to go on; once it matches, the race belongs to the
 * account, so a later email change does not take it off their profile.
 *
 * The same rows the profile already shows as theirs, so this grants nothing
 * new: it only makes the match permanent. Best-effort: a failure is logged
 * and the email match keeps working.
 */
export async function claimEntriesByEmail(
  user: { id: string; email: string | null | undefined },
  db: Pick<typeof prisma, "registration"> = prisma,
): Promise<number> {
  const email = user.email?.trim();
  if (!user.id || !email) return 0;
  try {
    const { count } = await db.registration.updateMany({
      where: unclaimedByEmailWhere({ id: user.id, email }),
      data: { athleteUserId: user.id },
    });
    return count;
  } catch (err) {
    console.error("Claiming entries by email failed:", err);
    return 0;
  }
}

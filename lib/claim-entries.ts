import prisma from "@/lib/prisma";
import { lockEventEntries } from "@/lib/event-entry-lock";
import { isSuggestedByEmail } from "@/lib/profile-history";
import { entryClaimMatches, readEntryClaim } from "@/lib/entry-claim-token";

/**
 * Adding a race to your own profile, and taking it off again (#598).
 *
 * A profile lists only entries whose `athleteUserId` is the account. Nothing
 * sets that on someone's behalf: the athlete adds an entry here, either from
 * Activity (it was bought under their email by someone else) or from the link
 * in its confirmation email (the address may not be the one they sign in with).
 */

export type ClaimOutcome = "claimed" | "already-yours" | "taken" | "duplicate" | "not-allowed" | "not-found";
export type UnclaimOutcome = "removed" | "not-found";

type Db = Pick<typeof prisma, "$transaction">;

/**
 * Add one entry to the account's race history.
 *
 * Allowed when the entry is offered to the account by email (Activity), or the
 * caller holds a valid link for the entry as it stands now. Runs under the
 * event's entry lock, so two adds cannot both pass the one-race-per-event check.
 */
export async function claimEntry(
  opts: { registrationId: string; user: { id: string; email: string }; token?: string | null },
  db: Db = prisma,
): Promise<ClaimOutcome> {
  const { registrationId, user } = opts;
  const link = opts.token ? readEntryClaim(opts.token) : null;
  // A token for another entry is refused outright, before any read.
  if (opts.token && (!link || link.registrationId !== registrationId)) return "not-allowed";

  return db.$transaction(async (tx) => {
    const found = await tx.registration.findUnique({
      where: { id: registrationId },
      select: { eventId: true },
    });
    if (!found) return "not-found" as const;
    await lockEventEntries(tx, found.eventId);

    // Re-read under the lock: a swap or another claim may have just landed.
    const row = await tx.registration.findUnique({
      where: { id: registrationId },
      select: {
        id: true, eventId: true, status: true, userId: true, athleteUserId: true,
        athleteEmail: true, detailsPending: true,
      },
    });
    if (!row) return "not-found" as const;

    const byEmail = isSuggestedByEmail(row, user);
    const byLink = link !== null && entryClaimMatches(link, row);
    if (row.athleteUserId === user.id) return "already-yours" as const;
    // The email offer stays private: anyone else is told the entry is not there.
    if (!byEmail && !byLink) return opts.token ? "not-allowed" as const : "not-found" as const;
    if (row.athleteUserId) return "taken" as const;
    if (row.status !== "CONFIRMED" || row.detailsPending) return "not-allowed" as const;

    // One person races once per event.
    const already = await tx.registration.findFirst({
      where: { eventId: row.eventId, athleteUserId: user.id, status: "CONFIRMED" },
      select: { id: true },
    });
    if (already) return "duplicate" as const;

    const { count } = await tx.registration.updateMany({
      where: { id: row.id, athleteUserId: null },
      data: { athleteUserId: user.id },
    });
    return count === 1 ? "claimed" as const : "taken" as const;
  });
}

/** Take an entry off the account's race history. Only ever the caller's own. */
export async function unclaimEntry(
  opts: { registrationId: string; userId: string },
  db: Pick<typeof prisma, "registration"> = prisma,
): Promise<UnclaimOutcome> {
  const { count } = await db.registration.updateMany({
    where: { id: opts.registrationId, athleteUserId: opts.userId },
    data: { athleteUserId: null },
  });
  return count === 1 ? "removed" : "not-found";
}

import type { Prisma } from "@prisma/client";

/**
 * Whose entry is this? On a group or team purchase the buyer holds every
 * entry under their account (`userId`), but only one of them is theirs to
 * race. A refund is asked for by the athlete the place belongs to, so the
 * buyer's `userId` never counts: the entry must be linked to the account as
 * its athlete, or carry the account's email as the athlete's.
 *
 * A team place still waiting for its member's details carries the buyer's
 * email as a stand-in; it is not the buyer's own entry.
 */
export function isOwnEntry(
  entry: { athleteUserId: string | null; athleteEmail: string; detailsPending: boolean },
  account: { sub: string; email: string },
): boolean {
  if (entry.athleteUserId) return entry.athleteUserId === account.sub;
  return !entry.detailsPending && entry.athleteEmail.toLowerCase() === account.email.toLowerCase();
}

/** The same rule as `isOwnEntry`, as a Prisma filter. */
export function ownEntryWhere(account: { sub: string; email: string }): Prisma.RegistrationWhereInput {
  return {
    OR: [
      { athleteUserId: account.sub },
      {
        athleteUserId: null,
        detailsPending: false,
        athleteEmail: { equals: account.email, mode: "insensitive" },
      },
    ],
  };
}

/**
 * Who may ask for a refund on an entry: the athlete whose place it is, or the
 * account that paid for it. On a group purchase the buyer can act for the
 * places they bought, because the money goes back to their card whoever asks.
 */
export function canRequestRefund(
  entry: { userId: string | null; athleteUserId: string | null; athleteEmail: string; detailsPending: boolean },
  account: { sub: string; email: string },
): boolean {
  return entry.userId === account.sub || isOwnEntry(entry, account);
}

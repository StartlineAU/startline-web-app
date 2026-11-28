import type { Prisma, RegistrationStatus } from "@prisma/client";

/**
 * Single source of truth for which registration statuses occupy a spot — in the
 * event's overall cap and in a start wave's capacity. Every capacity count in the
 * app should filter by this set so the numbers agree everywhere.
 *
 * Only CONFIRMED (paid = registered) counts by status alone. A REFUNDED entry,
 * or a free entry the athlete cancelled (REFUND_REQUESTED with no ticket), has
 * vacated its spot and must NOT be added here.
 */
export const CAPACITY_COUNTING_STATUSES: RegistrationStatus[] = ["CONFIRMED"];

export function countsAgainstCapacity(status: RegistrationStatus): boolean {
  return CAPACITY_COUNTING_STATUSES.includes(status);
}

/**
 * Entries that hold a place: confirmed ones, plus a paid entry whose refund
 * request is still undecided or approved but not yet refunded (#492). The
 * athlete is told their place is held until the money moves, and a decline puts
 * the entry back to CONFIRMED, so selling the place in between would overbook.
 *
 * Use this, not a bare status filter, for every count that enforces capacity.
 */
export const HOLDS_PLACE_WHERE: Prisma.RegistrationWhereInput = {
  OR: [
    { status: { in: CAPACITY_COUNTING_STATUSES } },
    { status: "REFUND_REQUESTED", supportTickets: { some: { status: { in: ["OPEN", "APPROVED"] } } } },
  ],
};

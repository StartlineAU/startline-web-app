import prisma from "@/lib/prisma";

/**
 * Deleting an event used to cascade to every entry on it and to its payout
 * record, wiping the only trace of money that had been charged and paid out.
 * An event that has ever taken an entry is kept, whoever asks: its entries are
 * athletes' history and the financial record. The foreign keys are RESTRICT as
 * well, so a delete that races a new entry fails in the database instead.
 */
export const EVENT_HAS_ENTRIES_ERROR =
  "This event has taken entries, so its records have to be kept and it can't be deleted. Contact Startline support if it needs to be withdrawn.";

/** The subset of `eventIds` that have at least one registration, in any status. */
export async function eventIdsWithEntries(eventIds: string[]): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();
  const rows = await prisma.registration.groupBy({
    by: ["eventId"],
    where: { eventId: { in: eventIds } },
  });
  return new Set(rows.map((row) => row.eventId));
}

/** A Prisma foreign key violation: the RESTRICT above refused the delete. */
export function isForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2003"
  );
}

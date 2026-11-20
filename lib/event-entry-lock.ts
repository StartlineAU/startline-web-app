import type { Prisma } from "@prisma/client";

/**
 * Serialise every write that can add a CONFIRMED entry to one event.
 *
 * Capacity is checked by counting CONFIRMED rows and then inserting. Under
 * Postgres' default READ COMMITTED isolation two transactions can both count
 * 99 of 100 and both insert, overselling the event. Taking this transaction
 * scoped advisory lock first makes the count-then-insert atomic per event. It
 * is released when the transaction commits or rolls back.
 */
export async function lockEventEntries(tx: Prisma.TransactionClient, eventId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`event-entries:${eventId}`}))`;
}

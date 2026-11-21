import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Organisation block lists (#571).
 *
 * A block belongs to one organisation and covers every event it runs. It
 * matches the account when the person has one, and always the email, because
 * a guest checkout under a blocked address creates no link to the account.
 * A platform-wide ban stays an admin action (User.isBanned).
 */

/** What a blocked person is told. Deliberately says nothing about why. */
export const BLOCKED_ENTRY_MESSAGE = "You can't enter this event. Contact the organiser.";

type Db = PrismaClient | Prisma.TransactionClient;

export function normalizeBlockEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export interface BlockIdentities {
  userIds?: (string | null | undefined)[];
  emails?: (string | null | undefined)[];
}

/**
 * The first block on this organisation that matches any of the people given,
 * or null. Empty identities never match.
 */
export async function findOrganiserBlock(
  organiserId: string,
  identities: BlockIdentities,
  db: Db = prisma,
): Promise<{ id: string; email: string } | null> {
  const userIds = [...new Set((identities.userIds ?? []).filter((id): id is string => Boolean(id)))];
  const emails = new Set((identities.emails ?? []).map(normalizeBlockEmail).filter(Boolean));
  if (userIds.length === 0 && emails.size === 0) return null;

  // A block added by address before the person had an account carries no
  // userId, so the accounts' own emails are matched as well.
  if (userIds.length > 0) {
    const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { email: true } });
    for (const u of users) {
      const e = normalizeBlockEmail(u.email);
      if (e) emails.add(e);
    }
  }

  const or: Prisma.OrganiserBlockWhereInput[] = [];
  if (userIds.length > 0) or.push({ userId: { in: userIds } });
  if (emails.size > 0) or.push({ email: { in: [...emails] } });

  return db.organiserBlock.findFirst({
    where: { organiserId, OR: or },
    select: { id: true, email: true },
  });
}

export async function isBlockedByOrganiser(
  organiserId: string,
  identities: BlockIdentities,
  db: Db = prisma,
): Promise<boolean> {
  return Boolean(await findOrganiserBlock(organiserId, identities, db));
}

/**
 * Add a person to the block list, or refresh the entry already there. The
 * account is looked up from the email when none is given, so a block added by
 * address alone still catches the account's signed-in entries.
 */
export async function upsertOrganiserBlock(
  input: {
    organiserId: string;
    email: string;
    userId?: string | null;
    name?: string | null;
    note?: string | null;
    createdByEmail: string;
  },
  db: Db = prisma,
) {
  const email = normalizeBlockEmail(input.email);
  if (!email) throw new Error("A block needs an email address.");

  let userId = input.userId ?? null;
  if (!userId) {
    const user = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  return db.organiserBlock.upsert({
    where: { organiserId_email: { organiserId: input.organiserId, email } },
    create: {
      organiserId: input.organiserId,
      email,
      userId,
      name: input.name?.trim() || null,
      note: input.note?.trim() || null,
      createdByEmail: input.createdByEmail,
    },
    update: {
      // Keep an earlier account link if this call has none.
      ...(userId ? { userId } : {}),
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    },
  });
}

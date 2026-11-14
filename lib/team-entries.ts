import prisma from "@/lib/prisma";

/**
 * The first of `names` already used by a team in this event that still has a
 * confirmed or refund-pending member, or null. Case-insensitive.
 */
export async function findTakenTeamNames(
  eventId: string,
  names: string[],
  db: Pick<typeof prisma, "team"> = prisma,
): Promise<string | null> {
  if (names.length === 0) return null;
  const existing = await db.team.findMany({
    where: {
      eventId,
      OR: names.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })),
      members: { some: { status: { in: ["CONFIRMED", "REFUND_REQUESTED"] } } },
    },
    select: { name: true },
  });
  if (existing.length === 0) return null;
  const takenKeys = new Set(existing.map((t) => t.name.toLowerCase()));
  return names.find((n) => takenKeys.has(n.toLowerCase())) ?? existing[0].name;
}

/** What a registration row needs to show its team. */
export interface TeamLink {
  bibNumber: string | null;
  team?: { id?: string; name: string; bibNumber: string | null } | null;
}

/** A team member's bib is the team's; anyone else's is their own. */
export function entryBib(row: TeamLink): string | null {
  return row.team ? row.team.bibNumber : row.bibNumber;
}

/**
 * Every registration that shares a team with one of `registrationIds`,
 * including those ids themselves, keyed by the id asked about. An entry with
 * no team maps to just itself. Race-day writes (start wave, check-in, result)
 * go to the whole list so a team moves as one.
 */
export async function teammatesOf(
  eventId: string,
  registrationIds: string[],
  db: Pick<typeof prisma, "registration"> = prisma,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(registrationIds.map((id) => [id, [id]]));
  if (registrationIds.length === 0) return out;
  const rows = await db.registration.findMany({
    where: { eventId, id: { in: registrationIds }, teamId: { not: null } },
    select: { id: true, teamId: true },
  });
  if (rows.length === 0) return out;
  const teamIds = [...new Set(rows.map((r) => r.teamId as string))];
  const members = await db.registration.findMany({
    where: { eventId, teamId: { in: teamIds } },
    select: { id: true, teamId: true },
  });
  const byTeam = new Map<string, string[]>();
  for (const m of members) {
    const list = byTeam.get(m.teamId as string) ?? [];
    list.push(m.id);
    byTeam.set(m.teamId as string, list);
  }
  for (const r of rows) out.set(r.id, byTeam.get(r.teamId as string) ?? [r.id]);
  return out;
}

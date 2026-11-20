import prisma from "@/lib/prisma";
import { TEAM_HELD_STATUSES, teamSizeOf, teamTierChangeError } from "@/lib/team-tickets";

export { TEAM_HELD_STATUSES, holdsTeamPlace } from "@/lib/team-tickets";

/**
 * The first of `names` already used by a team in this event that still has a
 * confirmed or refund-pending member, or null. Case-insensitive.
 */
export async function findTakenTeamNames(
  eventId: string,
  names: string[],
  db: Pick<typeof prisma, "team"> = prisma,
  /** A team renaming itself does not clash with its own name. */
  excludeTeamId?: string,
): Promise<string | null> {
  if (names.length === 0) return null;
  const existing = await db.team.findMany({
    where: {
      eventId,
      ...(excludeTeamId ? { id: { not: excludeTeamId } } : {}),
      OR: names.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })),
      members: { some: { status: { in: TEAM_HELD_STATUSES } } },
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
 * Every registration that shares a team with one of `registrationIds` and
 * still holds a place there, plus the id asked about itself, keyed by that
 * id. An entry with no team maps to just itself. Race-day writes (start wave,
 * check-in, result) go to the whole list so a team moves as one; members who
 * cancelled or were refunded are left as they are.
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
    where: { eventId, teamId: { in: teamIds }, status: { in: TEAM_HELD_STATUSES } },
    select: { id: true, teamId: true },
  });
  const byTeam = new Map<string, string[]>();
  for (const m of members) {
    const list = byTeam.get(m.teamId as string) ?? [];
    list.push(m.id);
    byTeam.set(m.teamId as string, list);
  }
  for (const r of rows) {
    const mates = byTeam.get(r.teamId as string) ?? [];
    out.set(r.id, mates.includes(r.id) ? mates : [r.id, ...mates]);
  }
  return out;
}

/**
 * The reason an event edit would change a team ticket that already has
 * entries, or null. Reads entries only when the edit touches tickets or
 * format. See teamTierChangeError.
 */
export async function checkTeamTierChange(
  eventId: string,
  existing: { waves: unknown; format: string | null },
  next: { waves?: unknown; format?: string | null },
): Promise<string | null> {
  if (next.waves === undefined && next.format === undefined) return null;
  const nextWaves = next.waves === undefined ? existing.waves : next.waves;
  const nextFormat = next.format === undefined ? existing.format : next.format;
  // No team tier before or after: nothing a sale could be holding to a size.
  const hasTeamTier = (waves: unknown) =>
    Array.isArray(waves) && waves.some((w) => teamSizeOf(w as { teamSize?: unknown }) !== null);
  if (!hasTeamTier(existing.waves) && !hasTeamTier(nextWaves)) return null;
  const grouped = await prisma.registration.groupBy({
    by: ["waveLabel"],
    where: { eventId, status: { in: TEAM_HELD_STATUSES }, waveLabel: { not: null } },
  });
  return teamTierChangeError({
    previousWaves: existing.waves,
    nextWaves,
    nextFormat,
    labelsWithEntries: grouped.map((g) => g.waveLabel as string),
  });
}

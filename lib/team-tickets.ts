/**
 * Team tickets (#541).
 *
 * A ticket tier in Event.waves becomes a team ticket when it carries a
 * `teamSize` of 2 or more. Its `price` stays per person, so a team costs
 * price x teamSize and every member is charged (and refunded) as their own
 * entry. Its `qty` counts teams, not people.
 *
 * Pure and client-safe: the editor, the register page, checkout, the webhook
 * and the confirm transaction all read team tiers through here.
 */

export const MIN_TEAM_SIZE = 2;
export const MAX_TEAM_SIZE = 10;
export const MAX_TEAM_NAME_LENGTH = 60;

/**
 * Statuses of a member who still holds a team place. A cancelled or refunded
 * member has left the team: race-day writes skip them and they no longer
 * reserve the team's name.
 */
export const TEAM_HELD_STATUSES = ["CONFIRMED", "REFUND_REQUESTED"] as ("CONFIRMED" | "REFUND_REQUESTED")[];

export function holdsTeamPlace(status: string): boolean {
  return (TEAM_HELD_STATUSES as string[]).includes(status);
}

export interface TeamTierLike {
  label: string;
  qty?: number;
  teamSize?: unknown;
}

/** The tier's team size, or null for an individual ticket. */
export function teamSizeOf(wave: { teamSize?: unknown } | null | undefined): number | null {
  const raw = wave?.teamSize;
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isInteger(n)) return null;
  if (n < MIN_TEAM_SIZE || n > MAX_TEAM_SIZE) return null;
  return n;
}

/** Places one unit of this tier takes against the event's people cap. */
export function peoplePerUnit(wave: { teamSize?: unknown } | null | undefined): number {
  return teamSizeOf(wave) ?? 1;
}

/** "Pairs", "Teams of 4", for showing next to a team tier. */
export function teamSizeLabel(size: number): string {
  return size === 2 ? "Pairs" : `Teams of ${size}`;
}

/** One entry in an order, as far as team grouping is concerned. */
export interface TeamOrderEntry {
  waveLabel: string | null;
  /** Index into the order's team names. Set only on team-ticket members. */
  team?: number;
}

/** A team in an order: its name, tier and the order indexes of its members. */
export interface OrderTeam {
  index: number;
  name: string;
  waveLabel: string;
  size: number;
  members: number[];
}

export type OrderTeamsResult = { teams: OrderTeam[] } | { error: string };

export function normaliseTeamName(name: unknown): string {
  return typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
}

/**
 * Check an order's team structure against the event's tiers and group the
 * members. Every member of a team-ticket tier must name a team; every team
 * has exactly the tier's team size, one tier, and a unique, non-blank name;
 * individual tickets name no team.
 *
 * Runs on checkout and again on the webhook, since PaymentIntent metadata is
 * client-influenced.
 */
export function groupOrderTeams(
  entries: TeamOrderEntry[],
  waves: TeamTierLike[],
  teamNames: unknown[],
): OrderTeamsResult {
  const sizeByLabel = new Map(waves.map((w) => [w.label, teamSizeOf(w)]));
  const teams = new Map<number, OrderTeam>();

  for (let i = 0; i < entries.length; i++) {
    const { waveLabel, team } = entries[i];
    const size = waveLabel ? sizeByLabel.get(waveLabel) ?? null : null;
    if (size == null) {
      if (team != null) return { error: "An individual ticket cannot belong to a team." };
      continue;
    }
    if (team == null || !Number.isInteger(team) || team < 0 || team >= teamNames.length) {
      return { error: `Every member of a "${waveLabel}" team needs a team.` };
    }
    const existing = teams.get(team);
    if (existing) {
      if (existing.waveLabel !== waveLabel) {
        return { error: "Every member of a team must be on the same ticket." };
      }
      existing.members.push(i);
    } else {
      teams.set(team, {
        index: team,
        name: normaliseTeamName(teamNames[team]),
        waveLabel: waveLabel as string,
        size,
        members: [i],
      });
    }
  }

  if (teams.size !== teamNames.length) {
    return { error: "Every team in the order needs members." };
  }

  const seen = new Set<string>();
  const ordered = [...teams.values()].sort((a, b) => a.index - b.index);
  for (const team of ordered) {
    if (!team.name) return { error: "Every team needs a name." };
    if (team.name.length > MAX_TEAM_NAME_LENGTH) {
      return { error: `Team names can be at most ${MAX_TEAM_NAME_LENGTH} characters.` };
    }
    const key = team.name.toLowerCase();
    if (seen.has(key)) return { error: `Two teams in this order are called "${team.name}".` };
    seen.add(key);
    if (team.members.length !== team.size) {
      return {
        error: `"${team.name}" needs exactly ${team.size} members (it has ${team.members.length}).`,
      };
    }
  }

  return { teams: ordered };
}

/**
 * Units this order takes from each tier: tickets for an individual tier,
 * teams for a team tier.
 */
export function requestedUnitsByWave(entries: TeamOrderEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const teamsSeen = new Set<string>();
  for (const { waveLabel, team } of entries) {
    if (!waveLabel) continue;
    if (team != null) {
      const key = `${waveLabel}\u0000${team}`;
      if (teamsSeen.has(key)) continue;
      teamsSeen.add(key);
    }
    counts[waveLabel] = (counts[waveLabel] ?? 0) + 1;
  }
  return counts;
}

/** One row of `registration.groupBy({ by: ["waveLabel", "teamId"] })`. */
export interface ConfirmedGroupRow {
  waveLabel: string | null;
  teamId: string | null;
  _count: { _all: number };
}

/**
 * Confirmed units per tier: each individual entry is one, each team with at
 * least one confirmed member is one however many members it has.
 */
export function confirmedUnitsByWave(rows: ConfirmedGroupRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!row.waveLabel) continue;
    counts[row.waveLabel] = (counts[row.waveLabel] ?? 0) + (row.teamId ? 1 : row._count._all);
  }
  return counts;
}

/**
 * Why an edit to an event's tickets would break teams already entered, or
 * null when it is safe.
 *
 * A tier's team size is fixed once it has entries: teams already sold were
 * built to the old size, tier capacity counts them as teams, and checkout
 * would start holding new teams to a different size than the old ones. That
 * includes switching a tier between individual and team. A new ticket is the
 * way to sell a different size.
 *
 * An event whose format ends up Individual cannot keep team tickets either;
 * the payload schema catches that when the edit sends `waves`, and this
 * catches a format-only edit.
 */
export function teamTierChangeError(opts: {
  previousWaves: unknown;
  nextWaves: unknown;
  nextFormat?: string | null;
  /** Tier labels with at least one entry still holding a place. */
  labelsWithEntries: Iterable<string>;
}): string | null {
  const sizes = (waves: unknown) => {
    const out = new Map<string, number | null>();
    if (!Array.isArray(waves)) return out;
    for (const w of waves) {
      if (w && typeof w === "object" && typeof (w as { label?: unknown }).label === "string") {
        out.set((w as { label: string }).label, teamSizeOf(w as { teamSize?: unknown }));
      }
    }
    return out;
  };
  const before = sizes(opts.previousWaves);
  const after = sizes(opts.nextWaves);

  for (const label of opts.labelsWithEntries) {
    if (!before.has(label) || !after.has(label)) continue;
    const was = before.get(label) ?? null;
    const now = after.get(label) ?? null;
    if (was === now) continue;
    const describe = (n: number | null) => (n ? `teams of ${n}` : "individual");
    return `"${label}" already has entries as ${describe(was)}, so it cannot change to ${describe(now)}. Add a new ticket instead.`;
  }

  if (opts.nextFormat === "individual" && [...after.values()].some((n) => n !== null)) {
    return "An individual event cannot sell team tickets. Change the format to Team or Individual & Team, or remove the team size.";
  }
  return null;
}

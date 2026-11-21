/**
 * Team results (#541). A team is ranked as one, so its distance, time and
 * placement are shared by every member. Personal best and top result describe
 * a person and stay on the row they were set on.
 *
 * Pure: the results route uses it, and the unit tests cover it directly.
 */

export const TEAM_RESULT_FIELDS = [
  ["resultDistance", "distance"],
  ["resultTime", "time"],
  ["resultPlacement", "placement"],
] as const;

type ResultData = Record<string, unknown>;

/** The shared (team-level) fields of one row's update. */
export function pickTeamResult<T extends ResultData>(data: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [field] of TEAM_RESULT_FIELDS) {
    if (field in data) out[field as keyof T] = data[field] as T[keyof T];
  }
  return out;
}

/**
 * Two rows in one batch that land on the same team but disagree on a shared
 * field. Writing both would leave the team with whichever came last, so the
 * caller refuses the batch. Rows that agree, or set different fields, pass.
 *
 * `teammates` maps each row's registration id to its whole team (itself
 * included), as teammatesOf returns it.
 */
export function findTeamResultConflict(
  updates: { id: string; data: ResultData }[],
  teammates: Map<string, string[]>,
): { registrationIds: [string, string]; field: string; label: string } | null {
  const seen = new Map<string, { id: string; value: unknown }>();
  for (const u of updates) {
    const members = teammates.get(u.id) ?? [u.id];
    if (members.length < 2) continue;
    const team = [...members].sort().join(",");
    for (const [field, label] of TEAM_RESULT_FIELDS) {
      if (!(field in u.data)) continue;
      const key = `${team}|${field}`;
      const value = u.data[field] ?? null;
      const prev = seen.get(key);
      if (prev && prev.id !== u.id && prev.value !== value) {
        return { registrationIds: [prev.id, u.id], field, label };
      }
      seen.set(key, { id: u.id, value });
    }
  }
  return null;
}

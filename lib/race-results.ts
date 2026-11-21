/**
 * Pure validation for organiser-entered race results. No DB, no React — the
 * dialog, the CSV importer and the API route all share one definition of what
 * counts as a finish time, so a result can never reach an athlete's public
 * profile in a format nobody can read.
 */

/**
 * `m:ss`, `mm:ss`, `h:mm:ss` or `hh:mm:ss`, with optional `.s`–`.sss` fractional
 * seconds. Minutes and seconds must be 00-59; hours are free (ultras run long).
 */
const RACE_TIME = /^(?:(\d{1,3}):)?([0-5]?\d):([0-5]\d)(?:\.(\d{1,3}))?$/;

export function isValidRaceTime(input: string): boolean {
  return RACE_TIME.test(input.trim());
}

/**
 * Trim and zero-pad a finish time to a consistent shape, or null if unreadable.
 * `41:5` is a typo, not a time — it is rejected rather than guessed at.
 */
export function normaliseRaceTime(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const m = RACE_TIME.exec(raw);
  if (!m) return null;
  const [, hours, minutes, seconds, fraction] = m;
  const mm = hours ? minutes.padStart(2, "0") : minutes.replace(/^0(?=\d)/, "");
  const base = hours ? `${hours}:${mm}:${seconds}` : `${mm}:${seconds}`;
  return fraction ? `${base}.${fraction}` : base;
}

/** Total seconds for a valid race time, or null. Useful for sorting/ranking. */
export function raceTimeToSeconds(input: string): number | null {
  const m = RACE_TIME.exec(input.trim());
  if (!m) return null;
  const [, hours, minutes, seconds, fraction] = m;
  const whole =
    (hours ? parseInt(hours, 10) : 0) * 3600 +
    parseInt(minutes, 10) * 60 +
    parseInt(seconds, 10);
  return fraction ? whole + Number(`0.${fraction}`) : whole;
}

/** "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "101st". */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * The finishing position in a stored placement: "43rd" → 43, "12th / 340" →
 * 12, "8" → 8. Null for anything without a leading positive number.
 */
export function placementNumber(stored: string | null | undefined): number | null {
  const m = /^\s*(\d+)/.exec(stored ?? "");
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 ? n : null;
}

/**
 * Organisers type a bare position; athletes read an ordinal. A number alone
 * ("43") becomes "43rd"; anything else ("12th / 340") is kept as written.
 */
export function normalisePlacement(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    return n >= 1 ? ordinal(n) : null;
  }
  return raw;
}

export interface RaceTimeParts {
  hours: number;
  minutes: number;
  seconds: number;
}

/** Split a stored finish time into whole hours, minutes and seconds (fractions dropped). */
export function raceTimeParts(stored: string | null | undefined): RaceTimeParts {
  const total = stored ? raceTimeToSeconds(stored) : null;
  if (total == null) return { hours: 0, minutes: 0, seconds: 0 };
  const whole = Math.floor(total);
  return { hours: Math.floor(whole / 3600), minutes: Math.floor((whole % 3600) / 60), seconds: whole % 60 };
}

/** Build a stored finish time from parts: "48:22" under an hour, "1:08:22" over. Null for 0:00:00. */
export function raceTimeFromParts({ hours, minutes, seconds }: RaceTimeParts): string | null {
  if (hours === 0 && minutes === 0 && seconds === 0) return null;
  const ss = String(seconds).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${ss}`
    : `${minutes}:${ss}`;
}

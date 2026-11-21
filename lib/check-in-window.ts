import { eventUtcWindow, type EventTimeInput } from "./event-time";

/** Check-in opens this long before the event starts. */
export const CHECK_IN_OPENS_MINUTES_BEFORE = 60;

/** Event statuses that can accept a check-in at all. */
const LIVE_EVENT_STATUSES = new Set(["APPROVED", "IN_PROGRESS"]);

export type CheckInState = "before" | "open" | "closed" | "unavailable";

/**
 * The earlier openings an organiser can pick, in minutes before the start.
 * "Open now" is the other choice; it is not a lead time.
 */
export const CHECK_IN_LEAD_OPTIONS = [60, 120, 24 * 60, 7 * 24 * 60] as const;
export type CheckInLeadMinutes = (typeof CHECK_IN_LEAD_OPTIONS)[number];

export interface CheckInWindowInput extends EventTimeInput {
  status?: string | null;
  startsAtUtc?: Date | string | null;
  endsAtUtc?: Date | string | null;
  /** The organiser's own opening time (#543). Null keeps the default. */
  checkInOpensAt?: Date | string | null;
}

export interface CheckInWindow {
  state: CheckInState;
  /** When check-in becomes available, in UTC. Null when the event has no usable start. */
  opensAt: Date | null;
  /** When check-in stops, in UTC. This is the event end. */
  closesAt: Date | null;
  /** True when the organiser moved the opening earlier than the default. */
  custom: boolean;
}

export function asDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * The window an athlete can check themselves in.
 *
 * It opens 60 minutes before the event starts and stays open until the event
 * ends. An organiser can open it earlier (`checkInOpensAt`), never later: if
 * the event is later moved earlier, the default still wins, so a stale custom
 * time can never keep athletes out once the usual window has begun. The derived UTC fields are preferred; older rows without them fall back
 * to the venue-local date/time and timezone. Any row we cannot read fails
 * closed rather than allowing an early check-in.
 */
export function checkInWindow(
  event: CheckInWindowInput,
  now: Date = new Date(),
): CheckInWindow {
  const fallback = eventUtcWindow(event);
  const startsAt = asDate(event.startsAtUtc) ?? fallback.startsAtUtc;
  const closesAt = asDate(event.endsAtUtc) ?? fallback.endsAtUtc;
  const defaultOpensAt = defaultCheckInOpensAt(startsAt);
  const chosen = asDate(event.checkInOpensAt);
  const custom = !!(chosen && defaultOpensAt && chosen < defaultOpensAt);
  const opensAt = custom ? chosen : defaultOpensAt;

  if (!opensAt || !closesAt) {
    return { state: "unavailable", opensAt, closesAt, custom: false };
  }

  // A finished event reads as closed even after the lifecycle sweep renames it
  // ARCHIVED. A pending, rejected or draft event is not a check-in target.
  if (now >= closesAt) return { state: "closed", opensAt, closesAt, custom };
  if (event.status && !LIVE_EVENT_STATUSES.has(event.status)) {
    return { state: "unavailable", opensAt, closesAt, custom };
  }

  if (now < opensAt) return { state: "before", opensAt, closesAt, custom };
  return { state: "open", opensAt, closesAt, custom };
}

/** The opening used when the organiser has not chosen one. */
export function defaultCheckInOpensAt(startsAt: Date | null): Date | null {
  return startsAt
    ? new Date(startsAt.getTime() - CHECK_IN_OPENS_MINUTES_BEFORE * 60 * 1000)
    : null;
}

/** The event start in UTC, preferring the derived field. */
export function checkInStartsAt(event: CheckInWindowInput): Date | null {
  return asDate(event.startsAtUtc) ?? eventUtcWindow(event).startsAtUtc;
}

/** What an organiser picks on the dashboard: open now, a lead time, or the default. */
export type CheckInOpeningChoice = "now" | "default" | CheckInLeadMinutes;

/**
 * The `checkInOpensAt` to store for an organiser's choice. Null means "use the
 * default", which is also what any choice no earlier than the default becomes,
 * so the stored field only ever holds a real override.
 */
export function checkInOpensAtFor(
  choice: CheckInOpeningChoice,
  startsAt: Date,
  now: Date = new Date(),
): Date | null {
  if (choice === "default") return null;
  const opensAt = choice === "now"
    ? now
    : new Date(startsAt.getTime() - choice * 60 * 1000);
  const fallback = defaultCheckInOpensAt(startsAt);
  return fallback && opensAt < fallback ? opensAt : null;
}

/** The check-in window as the API sends it. */
export function checkInWindowJson(window: CheckInWindow) {
  return {
    state: window.state,
    opensAt: window.opensAt?.toISOString() ?? null,
    closesAt: window.closesAt?.toISOString() ?? null,
    custom: window.custom,
  };
}

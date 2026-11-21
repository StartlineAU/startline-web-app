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
  /**
   * How many minutes before the start the organiser opened check-in (#543).
   * Null keeps the default. A lead, not a time, so it follows the event when
   * its start moves.
   */
  checkInLeadMinutes?: number | null;
}

export interface CheckInWindow {
  state: CheckInState;
  /** When check-in becomes available, in UTC. Null when the event has no usable start. */
  opensAt: Date | null;
  /** When check-in stops, in UTC. This is the event end. */
  closesAt: Date | null;
  /** True when the organiser moved the opening earlier than the default. */
  custom: boolean;
  /** Minutes before the start that check-in opens. */
  leadMinutes: number;
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
 * ends. An organiser can open it earlier (`checkInLeadMinutes`), never later.
 * The opening is held as a lead before the start, so when the event's time
 * changes the opening moves with it. The derived UTC fields are preferred; older rows without them fall back
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
  const leadMinutes = effectiveLeadMinutes(event.checkInLeadMinutes);
  const custom = leadMinutes > CHECK_IN_OPENS_MINUTES_BEFORE;
  const opensAt = startsAt ? new Date(startsAt.getTime() - leadMinutes * 60 * 1000) : null;

  if (!opensAt || !closesAt) {
    return { state: "unavailable", opensAt, closesAt, custom: false, leadMinutes };
  }

  // A finished event reads as closed even after the lifecycle sweep renames it
  // ARCHIVED. A pending, rejected or draft event is not a check-in target.
  if (now >= closesAt) return { state: "closed", opensAt, closesAt, custom, leadMinutes };
  if (event.status && !LIVE_EVENT_STATUSES.has(event.status)) {
    return { state: "unavailable", opensAt, closesAt, custom, leadMinutes };
  }

  if (now < opensAt) return { state: "before", opensAt, closesAt, custom, leadMinutes };
  return { state: "open", opensAt, closesAt, custom, leadMinutes };
}

/** The stored lead, never shorter than the default and never unreadable. */
function effectiveLeadMinutes(stored: number | null | undefined): number {
  return typeof stored === "number" && Number.isFinite(stored) && stored > CHECK_IN_OPENS_MINUTES_BEFORE
    ? Math.round(stored)
    : CHECK_IN_OPENS_MINUTES_BEFORE;
}

/** The event start in UTC, preferring the derived field. */
export function checkInStartsAt(event: CheckInWindowInput): Date | null {
  return asDate(event.startsAtUtc) ?? eventUtcWindow(event).startsAtUtc;
}

/** What an organiser picks on the dashboard: open now, a lead time, or the default. */
export type CheckInOpeningChoice = "now" | "default" | CheckInLeadMinutes;

/**
 * The `checkInLeadMinutes` to store for an organiser's choice. Null means "use
 * the default", which is also what any choice no earlier than the default
 * becomes, so the stored field only ever holds a real override.
 *
 * "Now" is stored as the lead from now to the start, so it too moves with the
 * event if the start time changes afterwards.
 */
export function checkInLeadMinutesFor(
  choice: CheckInOpeningChoice,
  startsAt: Date,
  now: Date = new Date(),
): number | null {
  if (choice === "default") return null;
  const lead = choice === "now"
    ? Math.ceil((startsAt.getTime() - now.getTime()) / 60000)
    : choice;
  return lead > CHECK_IN_OPENS_MINUTES_BEFORE ? lead : null;
}

/** The check-in window as the API sends it. */
export function checkInWindowJson(window: CheckInWindow) {
  return {
    state: window.state,
    opensAt: window.opensAt?.toISOString() ?? null,
    closesAt: window.closesAt?.toISOString() ?? null,
    custom: window.custom,
    leadMinutes: window.leadMinutes,
  };
}

import { eventUtcWindow, type EventTimeInput } from "./event-time";

/** Check-in opens this long before the event starts. */
export const CHECK_IN_OPENS_MINUTES_BEFORE = 60;

/** Event statuses that can accept a check-in at all. */
const LIVE_EVENT_STATUSES = new Set(["APPROVED", "IN_PROGRESS"]);

export type CheckInState = "before" | "open" | "closed" | "unavailable";

export interface CheckInWindowInput extends EventTimeInput {
  status?: string | null;
  startsAtUtc?: Date | string | null;
  endsAtUtc?: Date | string | null;
}

export interface CheckInWindow {
  state: CheckInState;
  /** When check-in becomes available, in UTC. Null when the event has no usable start. */
  opensAt: Date | null;
  /** When check-in stops, in UTC. This is the event end. */
  closesAt: Date | null;
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
 * ends. The derived UTC fields are preferred; older rows without them fall back
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
  const opensAt = startsAt
    ? new Date(startsAt.getTime() - CHECK_IN_OPENS_MINUTES_BEFORE * 60 * 1000)
    : null;

  if (!opensAt || !closesAt) {
    return { state: "unavailable", opensAt, closesAt };
  }

  // A finished event reads as closed even after the lifecycle sweep renames it
  // ARCHIVED. A pending, rejected or draft event is not a check-in target.
  if (now >= closesAt) return { state: "closed", opensAt, closesAt };
  if (event.status && !LIVE_EVENT_STATUSES.has(event.status)) {
    return { state: "unavailable", opensAt, closesAt };
  }

  if (now < opensAt) return { state: "before", opensAt, closesAt };
  return { state: "open", opensAt, closesAt };
}

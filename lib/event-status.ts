import type { UserEvent } from "@/types";

export interface EventStatus {
  label: string;
  style: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type EventPhase = "upcoming" | "in_progress" | "ended";

export interface LifecycleFields {
  status?: string;
  startsAtUtc?: string | null;
  endsAtUtc?: string | null;
}

/** Public display phase, derived without mutating the persisted status. */
export function getLifecyclePhase(event: LifecycleFields, now = Date.now()): EventPhase {
  const startsAt = event.startsAtUtc ? new Date(event.startsAtUtc).getTime() : null;
  const endsAt = event.endsAtUtc ? new Date(event.endsAtUtc).getTime() : null;

  if (event.status === "ARCHIVED" || (endsAt != null && now >= endsAt)) return "ended";
  if (event.status === "IN_PROGRESS" || (startsAt != null && now >= startsAt)) return "in_progress";
  return "upcoming";
}

export function getEventPhase(event: UserEvent, now = Date.now()): EventPhase {
  return getLifecyclePhase(event, now);
}

export function getEventStatus(event: UserEvent): EventStatus {
  const phase = getEventPhase(event);
  if (phase === "in_progress") {
    return { label: "In progress", style: "bg-amber-300 text-dark" };
  }
  if (phase === "ended") {
    return { label: "Registration Closed", style: "border border-dark-lighter text-muted" };
  }

  const daysUntil = Math.ceil(
    (new Date(event.date).getTime() - Date.now()) / MS_PER_DAY
  );
  if (daysUntil < 0)   return { label: "Registration Closed", style: "border border-dark-lighter text-muted" };
  if (daysUntil <= 14) return { label: "Selling Fast",        style: "bg-primary text-dark" };
  return                      { label: "Confirmed",           style: "border border-primary text-primary" };
}

import type { UserEvent } from "@/types";

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

  // A cancelled event is over as far as registration is concerned.
  if (event.status === "CANCELLED") return "ended";
  if (event.status === "ARCHIVED" || (endsAt != null && now >= endsAt)) return "ended";
  if (event.status === "IN_PROGRESS" || (startsAt != null && now >= startsAt)) return "in_progress";
  return "upcoming";
}

export function getEventPhase(event: UserEvent, now = Date.now()): EventPhase {
  return getLifecyclePhase(event, now);
}

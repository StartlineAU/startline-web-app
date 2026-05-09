import { FitnessEvent } from "@/types";

export interface EventStatus {
  label: string;
  /** Tailwind classes applied to the badge. */
  style: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Returns a status badge descriptor for an event based on how close it is.
 *  - Past / same day  → "Registration Closed"
 *  - Within 14 days   → "Selling Fast"
 *  - Otherwise        → "Confirmed"
 */
export function getEventStatus(event: FitnessEvent): EventStatus {
  const daysUntil = Math.ceil(
    (new Date(event.date).getTime() - Date.now()) / MS_PER_DAY
  );
  if (daysUntil < 0)   return { label: "Registration Closed", style: "border border-dark-lighter text-muted" };
  if (daysUntil <= 14) return { label: "Selling Fast",        style: "bg-primary text-dark" };
  return                      { label: "Confirmed",           style: "border border-primary text-primary" };
}

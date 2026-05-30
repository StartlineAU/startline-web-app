import type { CustomerEvent } from "@/types";

export interface EventStatus {
  label: string;
  style: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function getEventStatus(event: CustomerEvent): EventStatus {
  const daysUntil = Math.ceil(
    (new Date(event.date).getTime() - Date.now()) / MS_PER_DAY
  );
  if (daysUntil < 0)   return { label: "Registration Closed", style: "border border-dark-lighter text-muted" };
  if (daysUntil <= 14) return { label: "Selling Fast",        style: "bg-primary text-dark" };
  return                      { label: "Confirmed",           style: "border border-primary text-primary" };
}

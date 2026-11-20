/**
 * Pure capacity decision for a registration checkout. Given the event cap, the
 * per-tier quantities, and the current confirmed (paid) counts, decide whether
 * the requested order can proceed — and if not, the message to show the buyer.
 *
 * Counts reflect confirmed registrations only, so this blocks new checkouts once
 * an event or tier is full. It does not close the narrow race between concurrent
 * in-flight payments near the cap; that needs a reservation/hold system.
 */

import { teamSizeOf } from "@/lib/team-tickets";

export interface CapacityWave {
  label: string;
  /** Tickets for an individual tier, teams for a team tier. */
  qty?: number;
  teamSize?: unknown;
}

export interface CapacityCheckInput {
  /** Event-wide capacity, or null when the event is uncapped. */
  cap: number | null;
  /** Confirmed registrations (people) for the whole event. */
  confirmedTotal: number;
  /** People in this order across all tiers. */
  requestedTotal: number;
  /** Tier definitions; only those with a numeric `qty` are capped. */
  waves: CapacityWave[];
  /** Tiers used by this order. */
  usedLabels: string[];
  /** Confirmed units per tier label: entries, or teams for a team tier. */
  confirmedByWave: Record<string, number>;
  /** Units requested per tier label in this order: tickets, or teams. */
  requestedByWave: Record<string, number>;
}

export function getCapacityError(input: CapacityCheckInput): string | null {
  const { cap, confirmedTotal, requestedTotal, waves, usedLabels, confirmedByWave, requestedByWave } = input;

  if (cap != null && confirmedTotal + requestedTotal > cap) {
    const remaining = Math.max(0, cap - confirmedTotal);
    return remaining === 0
      ? "This event is sold out."
      : `Only ${remaining} spot${remaining === 1 ? "" : "s"} left for this event.`;
  }

  for (const wave of waves) {
    if (typeof wave.qty !== "number" || !usedLabels.includes(wave.label)) continue;
    const already = confirmedByWave[wave.label] ?? 0;
    const requested = requestedByWave[wave.label] ?? 0;
    if (already + requested > wave.qty) {
      const remaining = Math.max(0, wave.qty - already);
      const unit = teamSizeOf(wave) ? "team" : "ticket";
      return remaining === 0
        ? `"${wave.label}" is sold out.`
        : `Only ${remaining} "${wave.label}" ${unit}${remaining === 1 ? "" : "s"} left.`;
    }
  }

  return null;
}

/** True when any tier used by the order defines a numeric quantity cap. */
export function hasCappedWave(waves: CapacityWave[], usedLabels: string[]): boolean {
  return waves.some((w) => typeof w.qty === "number" && usedLabels.includes(w.label));
}

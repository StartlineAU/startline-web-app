import { getLifecyclePhase, type EventPhase } from "@/lib/event-status";

/**
 * Race history on an athlete's profile (#561).
 *
 * A CONFIRMED registration only means the entry went through. Whether the
 * athlete has raced comes from the event's lifecycle, so an entry for an event
 * that has not happened yet is upcoming, not "Completed".
 */

/** Event columns a history row needs, lifecycle included. */
export const PROFILE_HISTORY_EVENT_SELECT = {
  id: true,
  title: true,
  discipline: true,
  eventDate: true,
  city: true,
  state: true,
  coverImageUrl: true,
  status: true,
  startsAtUtc: true,
  endsAtUtc: true,
  organiser: { select: { id: true, orgName: true, logoUrl: true } },
} as const;

interface LifecycleEvent {
  status: string;
  startsAtUtc: Date | string | null;
  endsAtUtc: Date | string | null;
}

const iso = (d: Date | string | null) => (d instanceof Date ? d.toISOString() : d);

export function racePhase(event: LifecycleEvent, now = Date.now()): EventPhase {
  return getLifecyclePhase(
    { status: event.status, startsAtUtc: iso(event.startsAtUtc), endsAtUtc: iso(event.endsAtUtc) },
    now,
  );
}

/**
 * Tags each row with its phase and drops the raw lifecycle columns, so the
 * client never re-derives "has this happened" from its own clock.
 */
export function withRacePhase<
  R extends { event: LifecycleEvent & Record<string, unknown> },
>(registrations: R[], now = Date.now()) {
  return registrations.map((r) => {
    const { status, startsAtUtc, endsAtUtc, ...event } = r.event;
    return {
      ...r,
      phase: racePhase({ status, startsAtUtc, endsAtUtc }, now),
      event: event as Omit<R["event"], keyof LifecycleEvent>,
    };
  });
}

/** Races the athlete has actually been to: the event has ended. */
export function countCompletedRaces(registrations: { phase: EventPhase }[]): number {
  return registrations.filter((r) => r.phase === "ended").length;
}

/** What the result slot says when there is no time or placing to show. */
export function raceStatusLabel(phase: EventPhase): string {
  switch (phase) {
    case "upcoming":    return "Upcoming";
    case "in_progress": return "In progress";
    case "ended":       return "Completed";
  }
}

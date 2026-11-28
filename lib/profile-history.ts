import type { Prisma } from "@prisma/client";
import { getLifecyclePhase, type EventPhase } from "@/lib/event-status";

/**
 * Race history on an athlete's profile (#561).
 *
 * A CONFIRMED registration only means the entry went through. Whether the
 * athlete has raced comes from the event's lifecycle, so an entry for an event
 * that has not happened yet is upcoming, not "Completed".
 */

/**
 * The entries a person raced in (#592), for every profile view.
 *
 * Not `userId`: that is the buyer, so it would list an event once for every
 * ticket they paid for. Only entries recorded as theirs (`athleteUserId`) are
 * listed. That is set at checkout for the buyer's own ticket, and otherwise
 * only when the athlete adds an entry themselves (lib/claim-entries.ts), so
 * nobody can put a race on someone else's public profile by typing their
 * email into a registration form.
 */
export function profileHistoryWhere(user: { id: string }): Prisma.RegistrationWhereInput {
  return { status: "CONFIRMED", athleteUserId: user.id };
}

/**
 * Entries someone else bought under this account's email that no account has
 * added yet. Activity offers each one with "Add to my profile"; nothing is
 * added without that. The person's own purchases are left out, so a child
 * entered on a parent's address is not offered to the parent as their race.
 * `userId: null` is spelled out because SQL `NOT` would drop those rows.
 */
export function suggestedByEmailWhere(user: { id: string; email: string }): Prisma.RegistrationWhereInput {
  return {
    status: "CONFIRMED",
    athleteUserId: null,
    detailsPending: false,
    athleteEmail: { equals: user.email, mode: "insensitive" },
    OR: [{ userId: null }, { userId: { not: user.id } }],
  };
}

/** The same rule as suggestedByEmailWhere, for a row already in hand. */
export function isSuggestedByEmail(
  row: { status: string; athleteUserId: string | null; detailsPending: boolean; athleteEmail: string; userId: string | null },
  user: { id: string; email: string },
): boolean {
  return (
    row.status === "CONFIRMED" &&
    row.athleteUserId === null &&
    !row.detailsPending &&
    row.athleteEmail.trim().toLowerCase() === user.email.trim().toLowerCase() &&
    row.userId !== user.id
  );
}

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

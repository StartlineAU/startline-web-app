import type { EventStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Event lifecycle and the public discovery filter.
 *
 * Nothing in a GET request advances an event's status. The scheduled worker
 * persists transitions, while these helpers derive the same answer from the
 * stored UTC instants so a late tick cannot show a finished event as live or
 * leave an in-progress event open for registration.
 */

export type PersistedEventStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "IN_PROGRESS"
  | "REJECTED"
  | "ARCHIVED";

export interface LifecycleEvent {
  status: string;
  startsAtUtc: Date | string | null;
  endsAtUtc: Date | string | null;
}

function asDate(value: Date | string | null): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The status the event should have at `now`. States outside the published
 * lifecycle are left alone.
 */
export function effectiveEventStatus(
  event: LifecycleEvent,
  now: Date = new Date(),
): PersistedEventStatus {
  if (event.status !== "APPROVED" && event.status !== "IN_PROGRESS") {
    return event.status as PersistedEventStatus;
  }

  const endsAt = asDate(event.endsAtUtc);
  const startsAt = asDate(event.startsAtUtc);

  if (endsAt && now.getTime() >= endsAt.getTime()) return "ARCHIVED";
  if (startsAt && now.getTime() >= startsAt.getTime()) return "IN_PROGRESS";
  return "APPROVED";
}

/** Public discovery holds upcoming and currently running events, not history. */
export function isPubliclyDiscoverable(event: LifecycleEvent, now: Date = new Date()): boolean {
  const status = effectiveEventStatus(event, now);
  if (status !== "APPROVED" && status !== "IN_PROGRESS") return false;
  const endsAt = asDate(event.endsAtUtc);
  return endsAt == null || now.getTime() < endsAt.getTime();
}

/**
 * A single status rule for Prisma reads. Keep this independent of the stored
 * status so a scheduler outage cannot surface a finished event: the effective
 * window must still be open.
 */
export function publicDiscoveryWhere(now: Date = new Date()) {
  return {
    status: { in: ["APPROVED", "IN_PROGRESS"] as EventStatus[] },
    endsAtUtc: { gt: now },
  };
}

/** Events whose status is allowed to become live, before date filtering. */
export const LIVE_EVENT_STATUSES: EventStatus[] = ["APPROVED", "IN_PROGRESS"];

/** Registration closes when the event starts, even while it is still running. */
export function registrationOpenAt(
  event: LifecycleEvent,
  now: Date = new Date(),
): boolean {
  if (effectiveEventStatus(event, now) !== "APPROVED") return false;
  const startsAt = asDate(event.startsAtUtc);
  return startsAt == null || now.getTime() < startsAt.getTime();
}

/**
 * Persist every transition that is due. Both updates are conditional on the
 * previous status so concurrent workers are harmless.
 */
export async function transitionDueEvents(now: Date = new Date()) {
  const [archived, started] = await prisma.$transaction([
    prisma.event.updateMany({
      where: {
        status: { in: ["APPROVED", "IN_PROGRESS"] },
        endsAtUtc: { lte: now },
      },
      data: { status: "ARCHIVED" },
    }),
    prisma.event.updateMany({
      where: {
        status: "APPROVED",
        startsAtUtc: { lte: now },
        endsAtUtc: { gt: now },
      },
      data: { status: "IN_PROGRESS" },
    }),
  ]);

  return { archived: archived.count, started: started.count };
}

/**
 * Advance one event after an edit or approval. Conditional on the status that
 * was read, so a stale request cannot overwrite a newer transition.
 */
export async function refreshEventLifecycle(
  eventId: string,
  now: Date = new Date(),
): Promise<PersistedEventStatus | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { status: true, startsAtUtc: true, endsAtUtc: true },
  });
  if (!event) return null;

  const next = effectiveEventStatus(event, now);
  if (next !== event.status) {
    await prisma.event.updateMany({
      where: { id: eventId, status: event.status as EventStatus },
      data: { status: next as EventStatus },
    });
  }
  return next;
}

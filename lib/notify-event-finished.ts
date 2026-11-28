import prisma from "@/lib/prisma";
import { wantsNotification } from "@/lib/organiser-notification-preferences";
import {
  ORGANISER_RECIPIENTS_SELECT,
  organiserNotificationRecipients,
} from "@/lib/organiser-notification-recipients";
import { sendEventFinishedEmail } from "@/lib/email";

/**
 * "Your event has finished" for the organisation (#561).
 *
 * The lifecycle worker archives an event with a bulk update, so it cannot say
 * which events it just finished. Instead every sweep looks for archived events
 * nobody has been told about, and claims each one by setting
 * `finishedNotifiedAt` conditionally. Two overlapping sweeps therefore send one
 * notice, and events archived before this existed were backfilled as told.
 */

export interface EventFinishedCounts {
  /** Confirmed entries: athletes who were in the race. */
  entries: number;
  checkedIn: number;
  /** Entries with a time or a placing already posted. */
  withResults: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The feed entry's text. Kept here, apart from Prisma, so it can be tested. */
export function eventFinishedNotice(eventTitle: string, counts: EventFinishedCounts) {
  const { entries, checkedIn, withResults } = counts;
  const title = "Event finished";

  if (entries === 0) {
    return { title, body: `"${eventTitle}" has finished. Nobody was entered this time.` };
  }

  // Check-in is optional, so "0 checked in" usually means it wasn't used, not
  // that nobody turned up. Leave it out rather than say something alarming.
  const turnout = checkedIn > 0
    ? `${plural(entries, "athlete", "athletes")} entered and ${checkedIn} checked in.`
    : `${plural(entries, "athlete", "athletes")} entered.`;

  const results =
    withResults >= entries
      ? "Every result is posted."
      : withResults > 0
        ? `Results are posted for ${withResults} of ${entries}. Add the rest so every athlete sees their race.`
        : "Post results so athletes see their time and placing on their profile.";

  return { title, body: `"${eventTitle}" has finished. ${turnout} ${results}` };
}

/**
 * Most events a single sweep announces; the next sweep picks up the rest.
 * Each one sends an email in turn, so this keeps one worker call short.
 */
const SWEEP_LIMIT = 20;

/**
 * An event that ended longer ago than this is marked as told without saying
 * anything. "Your event has finished" a week late reads as a bug, and it only
 * happens when the worker was down or an admin moved an event into the past.
 */
export const FINISHED_NOTICE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Whether a notice for an event that ended at `endsAt` is still worth sending. */
export function finishedRecently(endsAt: Date | null, now: Date): boolean {
  if (!endsAt) return true;
  return now.getTime() - endsAt.getTime() <= FINISHED_NOTICE_WINDOW_MS;
}

/**
 * Tell each organisation about its events that have finished since the last
 * sweep. Returns how many events were announced. Failures are logged per
 * event and never stop the sweep.
 */
export async function notifyFinishedEvents(now: Date = new Date()): Promise<number> {
  const due = await prisma.event.findMany({
    where: { status: "ARCHIVED", finishedNotifiedAt: null },
    orderBy: { endsAtUtc: "asc" },
    take: SWEEP_LIMIT,
    select: { id: true },
  });

  let announced = 0;
  for (const { id } of due) {
    try {
      if (await notifyEventFinished(id, now)) announced++;
    } catch (err) {
      console.error(`Event finished notice failed for ${id}:`, err);
    }
  }
  return announced;
}

/**
 * Claim one event and send its notice. Returns true when this call sent it,
 * false when another sweep got there first, the event is not finished, it
 * finished too long ago, or the organisation has turned the notice off.
 *
 * The claim and the feed entry are one transaction: if the entry cannot be
 * written the claim rolls back and the next sweep tries again. The email goes
 * after the commit, so a retry never emails twice; a failed email is logged.
 */
export async function notifyEventFinished(eventId: string, now: Date = new Date()): Promise<boolean> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      status: true,
      endsAtUtc: true,
      finishedNotifiedAt: true,
      organiserId: true,
      organiser: {
        select: {
          notifyEventApproved: true,
          notifyEventRejected: true,
          notifyNewRegistration: true,
          notifyEventFinished: true,
          ...ORGANISER_RECIPIENTS_SELECT,
        },
      },
    },
  });
  if (!event || event.status !== "ARCHIVED" || event.finishedNotifiedAt) return false;

  const claim = () =>
    prisma.event.updateMany({
      where: { id: eventId, status: "ARCHIVED", finishedNotifiedAt: null },
      data: { finishedNotifiedAt: now },
    });

  // Claimed but silent: the organisation is not asked again on every sweep.
  if (!finishedRecently(event.endsAtUtc, now) || !wantsNotification(event.organiser, "EVENT_FINISHED")) {
    await claim();
    return false;
  }

  const confirmed = { eventId, status: "CONFIRMED" as const };
  const [entries, checkedIn, withResults] = await Promise.all([
    prisma.registration.count({ where: confirmed }),
    prisma.registration.count({ where: { ...confirmed, checkedInAt: { not: null } } }),
    prisma.registration.count({
      where: { ...confirmed, OR: [{ resultTime: { not: null } }, { resultPlacement: { not: null } }] },
    }),
  ]);
  const counts = { entries, checkedIn, withResults };

  const sent = await prisma.$transaction(async (tx) => {
    const claimed = await tx.event.updateMany({
      where: { id: eventId, status: "ARCHIVED", finishedNotifiedAt: null },
      data: { finishedNotifiedAt: now },
    });
    if (claimed.count === 0) return false;
    await tx.notification.create({
      data: {
        organiserId: event.organiserId,
        eventId,
        type: "EVENT_FINISHED",
        ...eventFinishedNotice(event.title, counts),
      },
    });
    return true;
  });
  if (!sent) return false;

  const recipients = organiserNotificationRecipients(event.organiser);
  if (recipients.length > 0) {
    await sendEventFinishedEmail(recipients, { eventId, eventTitle: event.title, ...counts }).catch((err) =>
      console.error(`Event finished email failed for ${eventId}:`, err),
    );
  }
  return true;
}

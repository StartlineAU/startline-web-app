import prisma from "@/lib/prisma";
import { describeChangeValue, type EventFieldChange } from "@/lib/event-change-log";
import { sendEventChangedEmails, type EventChangeLine } from "@/lib/email";

export interface NotifyEventChangeInput {
  eventId: string;
  changes: EventFieldChange[];
}

export type ChangeLine = EventChangeLine;

export function changeLines(changes: EventFieldChange[]): ChangeLine[] {
  return changes.map((c) => ({
    label: c.label,
    from: describeChangeValue(c.field, c.from),
    to: describeChangeValue(c.field, c.to),
  }));
}

/**
 * Tell the athletes already entered that an event's date, time, location or
 * type changed. There is no automatic refund: anyone affected is told to raise
 * it through Support, and the organiser and Startline review that.
 *
 * Called after the edit has committed. Sends are best-effort and go out in
 * Resend batches, so a large field of entrants does not hold the request open
 * for one round trip per athlete.
 */
export async function notifyEventChange(input: NotifyEventChangeInput): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true, title: true,
      organiser: { select: { orgName: true, contactName: true, email: true } },
    },
  });
  if (!event) return;

  const lines = changeLines(input.changes);
  const organiserName = event.organiser.orgName || event.organiser.contactName || event.organiser.email;

  const entrants = await prisma.registration.findMany({
    where: { eventId: event.id, status: "CONFIRMED" },
    select: { id: true, userId: true, athleteEmail: true, athleteName: true },
  });
  if (entrants.length === 0) return;

  const summary = lines.map((l) => `${l.label}: ${l.from} → ${l.to}`).join("; ");
  const userIds = [...new Set(entrants.map((e) => e.userId).filter((u): u is string => !!u))];
  try {
    await prisma.userNotification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: "EVENT_CHANGED" as const,
        title: `${event.title} has changed`,
        body:
          `${organiserName} changed this event. ${summary}. ` +
          `Your entry still stands. If it no longer works for you, ask for a refund through Support.`,
        eventId: event.id,
      })),
    });
  } catch (err) {
    console.error("Event change in-app notify failed:", err);
  }

  // One email per address, even if a family entered several athletes on it.
  const seen = new Set<string>();
  const emails: Parameters<typeof sendEventChangedEmails>[0] = [];
  for (const entrant of entrants) {
    const to = entrant.athleteEmail.trim().toLowerCase();
    if (!to || seen.has(to)) continue;
    seen.add(to);
    emails.push({
      to: entrant.athleteEmail,
      data: {
        athleteName: entrant.athleteName,
        eventId: event.id,
        eventTitle: event.title,
        organiserName,
        changes: lines,
      },
    });
  }
  try {
    await sendEventChangedEmails(emails);
  } catch (err) {
    console.error("Event change emails failed:", err);
  }
}

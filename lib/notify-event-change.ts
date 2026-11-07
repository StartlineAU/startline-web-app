import prisma from "@/lib/prisma";
import { describeChangeValue, type EventFieldChange } from "@/lib/event-change-log";
import { listAdminReviewRecipients } from "@/lib/admin-notification-recipients";
import { sendEventChangedAdminEmails, sendEventChangedEmail, type EventChangeLine } from "@/lib/email";

export interface NotifyEventChangeInput {
  eventId: string;
  changeId: string;
  changes: EventFieldChange[];
  fullRefundUntil: Date;
  /** Entrants who gained the full-refund entitlement from this change. */
  notifyEntrants: boolean;
  /** An unverified organiser changed a live event; nobody reviewed it first. */
  notifyAdmins: boolean;
}

export type ChangeLine = EventChangeLine;

export function changeLines(changes: EventFieldChange[]): ChangeLine[] {
  return changes.map((c) => ({
    label: c.label,
    from: describeChangeValue(c.field, c.from),
    to: describeChangeValue(c.field, c.to),
  }));
}

/** "Saturday 14 June 2027" in the event's own timezone. */
function formatDeadline(date: Date, timeZone: string): string {
  return date.toLocaleString("en-AU", {
    timeZone,
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

/**
 * Tell everyone who needs to know that an event's date, time, location or type
 * changed. Called after the edit has committed. Each send is best-effort and
 * isolated: the entitlement is already on the registration rows, so a failed
 * email never takes it away, and one bad address never stops the rest.
 */
export async function notifyEventChange(input: NotifyEventChangeInput): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true, title: true, timeZone: true,
      organiser: { select: { orgName: true, contactName: true, email: true } },
    },
  });
  if (!event) return;

  const lines = changeLines(input.changes);
  const deadline = formatDeadline(input.fullRefundUntil, event.timeZone);
  const organiserName = event.organiser.orgName || event.organiser.contactName || event.organiser.email;

  if (input.notifyEntrants) {
    const entrants = await prisma.registration.findMany({
      where: { eventId: event.id, fullRefundChangeId: input.changeId },
      select: { id: true, userId: true, athleteEmail: true, athleteName: true },
    });

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
            `You can keep your spot, or claim a full refund including the booking fee until ${deadline}.`,
          eventId: event.id,
        })),
      });
    } catch (err) {
      console.error("Event change in-app notify failed:", err);
    }

    // One email per address, even if a family entered several athletes on it.
    const seen = new Set<string>();
    for (const entrant of entrants) {
      const to = entrant.athleteEmail.trim().toLowerCase();
      if (!to || seen.has(to)) continue;
      seen.add(to);
      try {
        await sendEventChangedEmail(entrant.athleteEmail, {
          athleteName: entrant.athleteName,
          eventId: event.id,
          eventTitle: event.title,
          organiserName,
          changes: lines,
          fullRefundUntil: deadline,
        });
      } catch (err) {
        console.error("Event change email failed:", err);
      }
    }
  }

  if (input.notifyAdmins) {
    try {
      const recipients = await listAdminReviewRecipients();
      await sendEventChangedAdminEmails(recipients, {
        eventId: event.id,
        eventTitle: event.title,
        organiserName,
        changes: lines,
      });
    } catch (err) {
      console.error("Event change admin notify failed:", err);
    }
  }
}
